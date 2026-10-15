// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Boringtun Tunn construction + handshake initiation from portal peer config.
// Invariants:
// - Keys never logged; tokio-wireguard 0.1 is not used.
// - Full TCP-over-WG lives in `tcp_over_wg` (smoltcp); this module is handshake probe only.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
// ---

use std::net::UdpSocket;
use std::time::Duration;

use base64::Engine;
use boringtun::noise::{Tunn, TunnResult};
use boringtun::x25519::{PublicKey, StaticSecret};

use super::config::UserspacePeerConfig;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CryptoSessionStatus {
    pub ok: bool,
    pub code: &'static str,
    pub message: String,
    pub handshake_packet_sent: bool,
}

/// Build Tunn from peer config and send one handshake initiation UDP datagram.
/// Does not claim a completed Noise handshake with the edge (needs reply path + TCP stack).
pub fn probe_handshake_initiation(cfg: &UserspacePeerConfig) -> CryptoSessionStatus {
    let sk_bytes = match decode_key32(&cfg.private_key_b64) {
        Ok(b) => b,
        Err(e) => {
            return CryptoSessionStatus {
                ok: false,
                code: "private_key",
                message: e,
                handshake_packet_sent: false,
            };
        }
    };
    let pk_bytes = match decode_key32(&cfg.peer_public_key_b64) {
        Ok(b) => b,
        Err(e) => {
            return CryptoSessionStatus {
                ok: false,
                code: "peer_public_key",
                message: e,
                handshake_packet_sent: false,
            };
        }
    };

    let sk = StaticSecret::from(sk_bytes);
    let pk = PublicKey::from(pk_bytes);
    let keepalive = cfg.persistent_keepalive_secs;
    let mut tunn = Tunn::new(sk, pk, None, keepalive, 0, None);

    let mut buf = [0u8; 256];
    let packet = match tunn.format_handshake_initiation(&mut buf, true) {
        TunnResult::WriteToNetwork(p) => p.to_vec(),
        other => {
            return CryptoSessionStatus {
                ok: false,
                code: "handshake_format",
                message: format!("boringtun handshake format failed: {other:?}"),
                handshake_packet_sent: false,
            };
        }
    };

    let sock = match UdpSocket::bind("0.0.0.0:0") {
        Ok(s) => s,
        Err(e) => {
            return CryptoSessionStatus {
                ok: false,
                code: "udp_bind",
                message: format!("udp bind: {e}"),
                handshake_packet_sent: false,
            };
        }
    };
    let _ = sock.set_write_timeout(Some(Duration::from_secs(3)));
    match sock.send_to(&packet, cfg.endpoint) {
        Ok(n) if n == packet.len() => CryptoSessionStatus {
            ok: true,
            code: "handshake_init_sent",
            message: format!(
                "boringtun handshake initiation sent to {} ({} bytes); TCP engine owns reply/encap path",
                cfg.endpoint, n
            ),
            handshake_packet_sent: true,
        },
        Ok(n) => CryptoSessionStatus {
            ok: false,
            code: "udp_short_write",
            message: format!("udp short write {n}/{}", packet.len()),
            handshake_packet_sent: false,
        },
        Err(e) => CryptoSessionStatus {
            ok: false,
            code: "udp_send",
            message: format!("udp send to {}: {e}", cfg.endpoint),
            handshake_packet_sent: false,
        },
    }
}

/// Prove keys decode and Tunn constructs without network I/O (unit tests / preflight).
pub fn tunn_constructs(cfg: &UserspacePeerConfig) -> Result<(), String> {
    let sk = StaticSecret::from(decode_key32(&cfg.private_key_b64)?);
    let pk = PublicKey::from(decode_key32(&cfg.peer_public_key_b64)?);
    let _ = Tunn::new(sk, pk, None, cfg.persistent_keepalive_secs, 0, None);
    Ok(())
}

fn decode_key32(b64: &str) -> Result<[u8; 32], String> {
    let v = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|e| format!("base64 key: {e}"))?;
    if v.len() != 32 {
        return Err(format!("key length {} != 32", v.len()));
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&v);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::parse_userspace_peer_config;

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
    fn constructs_tunn_from_conf() {
        let cfg = parse_userspace_peer_config(GOOD).unwrap();
        tunn_constructs(&cfg).unwrap();
    }

    #[test]
    fn handshake_init_to_localhost_udp() {
        // Portal validate requires UDP 51823 — bind that port or skip if busy.
        let sink = match UdpSocket::bind("127.0.0.1:51823") {
            Ok(s) => s,
            Err(_) => return,
        };
        let cfg = parse_userspace_peer_config(GOOD).unwrap();
        let st = probe_handshake_initiation(&cfg);
        assert!(st.ok, "{}", st.message);
        assert!(st.handshake_packet_sent);
        let mut buf = [0u8; 512];
        sink.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
        let (n, _) = sink.recv_from(&mut buf).unwrap();
        assert!(n > 0);
    }
}
