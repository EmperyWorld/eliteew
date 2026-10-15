// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri commands for FoFline W-transport (userspace SOCKS + boringtun handshake).
// Invariants:
// - Env-gated; does not replace wg_* system portal commands.
// - Retail start_from_keyring / recover never return WG private key to JS.
// - seat_channel_bring_up is ops-system-wg IPC only; Capsule uses seat_channel_bring_up_inner.
// - stop / socks-down status path closes product WebView (kill-switch) when gate on.
// Related:
// - crate::wg::userspace
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3 Dual-OS PoC checklist #2
// ---

use serde::Serialize;
use tauri::{AppHandle, Window};

use crate::capsule_store;
use crate::caller_context::require_main_window;
use crate::commands::product::product_close_for_w_transport_kill_switch;
use crate::commands::sealed_store::{
    app_data, app_identifier, load_sealed_peer_for_transport,
};
use crate::device_bind::{self, BindAssert};
use crate::wg::userspace::{
    w_transport_proxy_url, w_transport_start, w_transport_status, w_transport_stop, ProxyEgressPlan,
    WTransportStatus,
};

#[tauri::command]
pub fn w_transport_status_cmd(
    app: AppHandle,
    window: Window,
) -> Result<WTransportStatus, String> {
    require_main_window(&window)?;
    let st = w_transport_status();
    // Mid-session engine death / reap: refuse to leave a proxied product window open
    // against a dead SOCKS (checklist #2 kill-switch — in-tree; seat PoC still residual).
    if !st.socks_listening {
        let _ = product_close_for_w_transport_kill_switch(&app);
    }
    Ok(st)
}

#[tauri::command]
pub fn w_transport_proxy_url_cmd(window: Window) -> Result<ProxyEgressPlan, String> {
    require_main_window(&window)?;
    Ok(w_transport_proxy_url())
}

/// Start from OS keyring peer conf — WG private key never crosses into JS.
#[tauri::command]
pub fn w_transport_start_from_keyring(
    app: AppHandle,
    window: Window,
) -> Result<WTransportStatus, String> {
    require_main_window(&window)?;
    start_from_keyring(&app)
}

fn start_from_keyring(app: &AppHandle) -> Result<WTransportStatus, String> {
    let conf = load_sealed_peer_for_transport(app)?;
    if conf.trim().is_empty() {
        return Err("sealed_peer_missing".into());
    }
    w_transport_start(&conf)
}

/// Bounded in-app recovery from keyring: up to 3 attempts with backoff 1s→2s→5s.
/// Fail-closed after the last attempt — never opens public egress.
#[tauri::command]
pub async fn w_transport_recover_from_keyring(
    app: AppHandle,
    window: Window,
) -> Result<WTransportStatus, String> {
    require_main_window(&window)?;
    tauri::async_runtime::spawn_blocking(move || recover_from_keyring_sync(app))
        .await
        .map_err(|e| format!("recover_join:{e}"))?
}

fn recover_from_keyring_sync(app: AppHandle) -> Result<WTransportStatus, String> {
    use std::thread;
    use std::time::Duration;

    let backoff_secs = [1u64, 2, 5];
    let mut last_err = String::from("channel_start_failed");
    for (i, wait_s) in backoff_secs.iter().enumerate() {
        let current = w_transport_status();
        if current.ok && current.socks_listening {
            return Ok(current);
        }
        eprintln!(
            "[STEP] w_transport_recover_attempt n={} of={}",
            i + 1,
            backoff_secs.len()
        );
        match start_from_keyring(&app) {
            Ok(st) if st.ok && st.socks_listening => {
                eprintln!("[STEP] w_transport_recover_ok attempt={}", i + 1);
                return Ok(st);
            }
            Ok(st) => {
                last_err = st.code.clone();
                eprintln!(
                    "[STEP] w_transport_recover_soft_fail attempt={} code={}",
                    i + 1,
                    st.code
                );
            }
            Err(e) => {
                last_err = e.clone();
                eprintln!(
                    "[STEP] w_transport_recover_fail attempt={} err={}",
                    i + 1,
                    e
                );
                if e.contains("sealed_peer_missing") || e.contains("fingerprint_mismatch") {
                    return Err(e);
                }
            }
        }
        if i + 1 < backoff_secs.len() {
            thread::sleep(Duration::from_secs(*wait_s));
        }
    }
    let final_st = w_transport_status();
    if final_st.ok && final_st.socks_listening {
        return Ok(final_st);
    }
    eprintln!("[STEP] w_transport_recover_exhausted last={last_err}");
    let _ = product_close_for_w_transport_kill_switch(&app);
    Err(format!("channel_unstable:{last_err}"))
}

fn store_and_start(
    app: &AppHandle,
    conf_text: String,
) -> Result<WTransportStatus, String> {
    let id = app_identifier(&app);
    let data = app_data(&app)?;
    match device_bind::assert_local(&data)? {
        BindAssert::Mismatch => return Err("fingerprint_mismatch".into()),
        BindAssert::Unbound | BindAssert::Matched => {}
    }
    capsule_store::store_peer_conf(&conf_text, Some(&id))?;
    w_transport_start(&conf_text)
}

#[derive(Debug, Clone, Serialize)]
pub struct SeatChannelBringUpView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub transport: Option<WTransportStatus>,
}

/// Ops-system-wg only: plaintext seat bring-up from JS.
/// Retail Capsule path calls [`seat_channel_bring_up_inner`] in Rust (no IPC).
#[tauri::command]
pub fn seat_channel_bring_up(
    app: AppHandle,
    window: Window,
    seat_json: String,
) -> Result<SeatChannelBringUpView, String> {
    require_main_window(&window)?;
    Ok(seat_channel_bring_up_inner(&app, &seat_json))
}

pub(crate) fn seat_channel_bring_up_inner(
    app: &AppHandle,
    seat_json: &str,
) -> SeatChannelBringUpView {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(seat_json) else {
        return SeatChannelBringUpView {
            ok: false,
            code: "invalid_seat_json".into(),
            message: "Пакет доступа повреждён".into(),
            transport: None,
        };
    };
    let conf = value
        .get("wg_conf")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let Some(conf_text) = conf else {
        return SeatChannelBringUpView {
            ok: true,
            code: "no_channel".into(),
            message: "Пакет без защищённого канала".into(),
            transport: None,
        };
    };
    match store_and_start(app, conf_text) {
        Ok(st) => SeatChannelBringUpView {
            ok: st.ok,
            code: if st.ok {
                "channel_up".into()
            } else {
                st.code.clone()
            },
            message: if st.ok {
                "Защищённый канал подключён".into()
            } else {
                st.message.clone()
            },
            transport: Some(st),
        },
        Err(e) => {
            let code = if e.contains("fingerprint_mismatch") {
                "fingerprint_mismatch"
            } else if e.contains("disabled") {
                "w_transport_required"
            } else {
                "channel_start_failed"
            };
            eprintln!("[STEP] seat_channel_bring_up_fail code={code}");
            SeatChannelBringUpView {
                ok: false,
                code: code.into(),
                message: if code == "fingerprint_mismatch" {
                    "Канал привязан к другому устройству".into()
                } else if code == "w_transport_required" {
                    "Защищённый канал доступен только внутри приложения".into()
                } else {
                    "Не удалось подключить защищённый канал".into()
                },
                transport: None,
            }
        }
    }
}

pub(crate) fn w_transport_stop_for_app(app: &AppHandle) -> WTransportStatus {
    let st = w_transport_stop();
    let _ = product_close_for_w_transport_kill_switch(app);
    st
}

#[tauri::command]
pub fn w_transport_stop_cmd(
    app: AppHandle,
    window: Window,
) -> Result<WTransportStatus, String> {
    require_main_window(&window)?;
    Ok(w_transport_stop_for_app(&app))
}
