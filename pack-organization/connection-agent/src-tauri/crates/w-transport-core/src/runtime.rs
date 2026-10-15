// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// W-transport runtime: start/stop/status for local SOCKS + boringtun/smoltcp TCP-over-WG.
// Invariants:
// - Env gate required; system wg-portal path untouched.
// - CONNECT uses smoltcp dialer when tunnel is up — never public ISP fallback.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3 / W-transport
// ---

use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4};
use std::sync::{Mutex, OnceLock};
use std::sync::Arc;

use serde::Serialize;

use super::config::parse_userspace_peer_config;
use super::crypto_session::{probe_handshake_initiation, tunn_constructs};
use super::egress::ProxyEgressPlan;
use super::gate::w_transport_enabled;
use super::socks5::{Socks5Server, TunnelDialer};
use super::tcp_over_wg::{SmoltcpDialer, TransportCountersSnapshot, WgTcpTunnel};

#[derive(Debug, Clone, Serialize)]
pub struct WTransportStatus {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub enabled: bool,
    pub socks_listening: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub socks_addr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_url: Option<String>,
    pub handshake_packet_sent: bool,
    pub tcp_over_wg: String,
    pub fail_closed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counters: Option<TransportCountersSnapshot>,
}

struct Engine {
    socks: Option<Socks5Server>,
    tunnel: Option<WgTcpTunnel>,
    handshake_packet_sent: bool,
    last_message: String,
}

static ENGINE: OnceLock<Mutex<Engine>> = OnceLock::new();

fn engine() -> &'static Mutex<Engine> {
    ENGINE.get_or_init(|| {
        Mutex::new(Engine {
            socks: None,
            tunnel: None,
            handshake_packet_sent: false,
            last_message: "idle".into(),
        })
    })
}

fn reap_dead_tunnel(eng: &mut Engine) {
    let dead = eng
        .tunnel
        .as_ref()
        .map(|t| !t.is_alive())
        .unwrap_or(false);
    if dead {
        if let Some(s) = eng.socks.take() {
            s.stop();
        }
        if let Some(t) = eng.tunnel.take() {
            t.stop();
        }
        eng.handshake_packet_sent = false;
        eng.last_message = "engine_exited".into();
        eprintln!("[STEP] w_transport_engine_reaped reason=thread_exit");
    }
}

fn status_snapshot(eng: &Engine, code: &str, message: impl Into<String>, ok: bool) -> WTransportStatus {
    let tunnel_ready = eng
        .tunnel
        .as_ref()
        .map(|t| t.is_tcp_ready())
        .unwrap_or(false);
    let socks_listening = eng.socks.is_some() && tunnel_ready;
    let socks_addr = if socks_listening {
        eng.socks.as_ref().map(|s| s.listen_addr.to_string())
    } else {
        None
    };
    // Fail-closed: never advertise proxy_url when engine is not ready.
    let proxy_url = if socks_listening {
        eng.socks
            .as_ref()
            .map(|s| ProxyEgressPlan::format_socks5_url(s.listen_addr))
    } else {
        None
    };
    let tcp_over_wg = if tunnel_ready { "ready" } else { "down" };
    let counters = eng.tunnel.as_ref().map(|t| t.counters().snapshot());
    WTransportStatus {
        ok,
        code: code.into(),
        message: message.into(),
        enabled: w_transport_enabled(),
        socks_listening,
        socks_addr,
        proxy_url,
        handshake_packet_sent: eng.handshake_packet_sent,
        tcp_over_wg: tcp_over_wg.into(),
        fail_closed: w_transport_enabled(),
        counters,
    }
}

pub fn w_transport_status() -> WTransportStatus {
    if !w_transport_enabled() {
        return WTransportStatus {
            ok: false,
            code: "disabled".into(),
            message: format!(
                "W-transport disabled — set {}=1 for userspace path (retail packages inject this; =0 restores system WG)",
                super::gate::ENV_FOFLINE_W_TRANSPORT
            ),
            enabled: false,
            socks_listening: false,
            socks_addr: None,
            proxy_url: None,
            handshake_packet_sent: false,
            tcp_over_wg: "n/a".into(),
            fail_closed: false,
            counters: None,
        };
    }
    let mut eng = engine().lock().expect("w_transport engine lock");
    reap_dead_tunnel(&mut eng);
    let ok = eng.socks.is_some() && eng.tunnel.as_ref().map(|t| t.is_tcp_ready()).unwrap_or(false);
    let code = if ok { "socks_up" } else { "down" };
    let msg = eng.last_message.clone();
    status_snapshot(&eng, code, msg, ok)
}

pub fn w_transport_proxy_url() -> ProxyEgressPlan {
    if !w_transport_enabled() {
        return ProxyEgressPlan::disabled();
    }
    let mut eng = engine().lock().expect("w_transport engine lock");
    reap_dead_tunnel(&mut eng);
    let ready = eng
        .tunnel
        .as_ref()
        .map(|t| t.is_tcp_ready())
        .unwrap_or(false);
    match (&eng.socks, ready) {
        (Some(s), true) => {
            ProxyEgressPlan::socks_up(ProxyEgressPlan::format_socks5_url(s.listen_addr))
        }
        _ => ProxyEgressPlan::socks_down(
            "W-transport enabled but SOCKS/engine is down — product WebView must not open (fail-closed)",
        ),
    }
}

/// Start local SOCKS + userspace WG TCP engine from conf text.
pub fn w_transport_start(conf_text: &str) -> Result<WTransportStatus, String> {
    if !w_transport_enabled() {
        return Err(format!(
            "disabled: set {}=1 to enable W-transport (retail packages inject this)",
            super::gate::ENV_FOFLINE_W_TRANSPORT
        ));
    }
    let cfg = parse_userspace_peer_config(conf_text)
        .map_err(|e| format!("{}: {}", e.code, e.message))?;
    tunn_constructs(&cfg).map_err(|e| format!("boringtun construct: {e}"))?;

    let hs = probe_handshake_initiation(&cfg);
    if !hs.ok {
        eprintln!(
            "[STEP] w_transport_handshake_skip code={} msg={}",
            hs.code, hs.message
        );
    }

    let tunnel = WgTcpTunnel::start(&cfg)?;
    if !tunnel.is_tcp_ready() {
        tunnel.stop();
        return Err("w_transport_tcp_not_ready".into());
    }
    let dialer: Arc<dyn TunnelDialer> = Arc::new(SmoltcpDialer::from_tunnel(&tunnel)?);
    let bind = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0));
    let socks = match Socks5Server::bind_and_spawn(bind, dialer) {
        Ok(s) => s,
        Err(e) => {
            tunnel.stop();
            return Err(e);
        }
    };

    let mut eng = engine().lock().map_err(|e| format!("engine lock: {e}"))?;
    if let Some(prev) = eng.socks.take() {
        prev.stop();
    }
    if let Some(prev) = eng.tunnel.take() {
        prev.stop();
    }
    eng.handshake_packet_sent = hs.handshake_packet_sent;
    eng.last_message = format!(
        "SOCKS on {}; handshake_init={}; tcp_over_wg=ready (smoltcp dialer)",
        socks.listen_addr,
        if hs.handshake_packet_sent {
            "sent"
        } else {
            "skipped"
        }
    );
    eng.socks = Some(socks);
    eng.tunnel = Some(tunnel);
    Ok(status_snapshot(
        &eng,
        "socks_up",
        eng.last_message.clone(),
        true,
    ))
}

pub fn w_transport_stop() -> WTransportStatus {
    if !w_transport_enabled() {
        return w_transport_status();
    }
    let mut eng = engine().lock().expect("w_transport engine lock");
    if let Some(s) = eng.socks.take() {
        s.stop();
    }
    if let Some(t) = eng.tunnel.take() {
        t.stop();
    }
    eng.handshake_packet_sent = false;
    eng.last_message = "stopped".into();
    status_snapshot(&eng, "down", "W-transport stopped", false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gate::{env_test_lock, ENV_FOFLINE_W_TRANSPORT};

    const GOOD: &str = r#"
[Interface]
PrivateKey = AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEE=
Address = 10.88.89.101/32
DNS = 10.88.89.1
MTU = 1380

[Peer]
PublicKey = BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBEE=
Endpoint = 127.0.0.1:51823
AllowedIPs = 10.88.89.1/32
PersistentKeepalive = 25
"#;

    #[test]
    fn start_requires_env_gate() {
        let _g = env_test_lock();
        if w_transport_enabled() {
            return;
        }
        let err = w_transport_start(GOOD).unwrap_err();
        assert!(err.contains("disabled"), "{err}");
    }

    #[test]
    fn start_stop_when_enabled() {
        let _g = env_test_lock();
        // SAFETY: test isolation under env_test_lock.
        unsafe {
            std::env::set_var(ENV_FOFLINE_W_TRANSPORT, "1");
        }
        let st = w_transport_start(GOOD).expect("start");
        assert!(st.ok);
        assert!(st.socks_listening);
        assert_eq!(st.tcp_over_wg, "ready");
        assert!(st.proxy_url.as_ref().unwrap().starts_with("socks5://127.0.0.1:"));
        let plan = w_transport_proxy_url();
        assert_eq!(plan.code, "proxy_ready");
        assert!(plan.fail_closed);
        let down = w_transport_stop();
        assert!(!down.socks_listening);
        assert_eq!(down.tcp_over_wg, "down");
        unsafe {
            std::env::remove_var(ENV_FOFLINE_W_TRANSPORT);
        }
    }

    #[test]
    fn rejects_full_tunnel_conf() {
        let _g = env_test_lock();
        unsafe {
            std::env::set_var(ENV_FOFLINE_W_TRANSPORT, "1");
        }
        let bad = GOOD.replace("10.88.89.1/32", "0.0.0.0/0");
        let err = w_transport_start(&bad).unwrap_err();
        assert!(err.contains("full_tunnel"), "{err}");
        let _ = w_transport_stop();
        unsafe {
            std::env::remove_var(ENV_FOFLINE_W_TRANSPORT);
        }
    }
}
