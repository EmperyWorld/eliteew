// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri metadata/clear commands for sealed peer store + fixed L7 platform probe.
// Invariants:
// - Decrypted peer material is available only to Rust transport code, never IPC.
// Related:
// - capsule_store.rs · device_bind.rs · fofline_egress.rs
// ---

use crate::capsule_store;
use crate::caller_context::require_main_window;
use crate::client_defaults;
use crate::device_bind::{self, BindAssert};
use crate::fofline_egress::fofline_native_http_client;
use crate::wg::userspace::w_transport_status;
use serde::Serialize;
use tauri::{AppHandle, Window};

#[derive(Debug, Clone, Serialize)]
pub struct SealedPeerStoreView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub present: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct L7ProbeView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub status: Option<u16>,
}

pub(crate) fn app_identifier(app: &AppHandle) -> String {
    app.config().identifier.clone()
}

pub(crate) fn app_data(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

#[tauri::command]
pub fn sealed_peer_load(
    app: AppHandle,
    window: Window,
) -> Result<SealedPeerStoreView, String> {
    require_main_window(&window)?;
    Ok(match load_sealed_peer_for_transport(&app) {
        Ok(conf) if !conf.trim().is_empty() => SealedPeerStoreView {
            ok: true,
            code: "present".into(),
            message: "ok".into(),
            present: true,
        },
        Ok(_) => SealedPeerStoreView {
            ok: true,
            code: "missing".into(),
            message: "ok".into(),
            present: false,
        },
        Err(e) if e == "fingerprint_mismatch" => SealedPeerStoreView {
            ok: false,
            code: "fingerprint_mismatch".into(),
            message: "Канал привязан к другому устройству".into(),
            present: true,
        },
        Err(_) => SealedPeerStoreView {
            ok: false,
            code: "load_failed".into(),
            message: "Не удалось прочитать сохранённый канал".into(),
            present: false,
        },
    })
}

pub(crate) fn load_sealed_peer_for_transport(app: &AppHandle) -> Result<String, String> {
    let id = app_identifier(app);
    let data = app_data(app)?;
    match device_bind::assert_local(&data)? {
        BindAssert::Mismatch => {
            if let Err(error) = capsule_store::clear_peer_conf(Some(&id)) {
                eprintln!("[STEP] sealed_peer_mismatch_clear_fail err={error}");
            }
            return Err("fingerprint_mismatch".into());
        }
        BindAssert::Unbound | BindAssert::Matched => {}
    }
    match capsule_store::load_peer_conf(Some(&id)) {
        Ok(Some(c)) if !c.trim().is_empty() => {
            // Legacy plaintext peer without bind: stamp this device once.
            if matches!(device_bind::assert_local(&data)?, BindAssert::Unbound) {
                let fp = crate::device_identity::load_or_create(&data)
                    .ok()
                    .map(|i| i.machine_fingerprint);
                let lid = match crate::entitlement::load_document(
                    &data,
                    Some(&id),
                    fp.as_deref(),
                ) {
                    Ok(Some(document)) if !document.payload.license_id.trim().is_empty() => {
                        document.payload.license_id
                    }
                    Ok(_) => "legacy".into(),
                    Err(error) => {
                        eprintln!(
                            "[STEP] sealed_peer_legacy_entitlement_skip err={error}"
                        );
                        "legacy".into()
                    }
                };
                device_bind::bind_legacy_peer_if_needed(&data, Some(&lid))?;
                // Re-store as envelope on this device.
                capsule_store::store_peer_conf(&c, Some(&id))?;
                eprintln!("[STEP] sealed_peer_legacy_migration_complete");
            }
            Ok(c)
        }
        // Missing peer is a normal cold-boot state — empty string, not an error.
        Ok(_) => Ok(String::new()),
        Err(e) if e == "fingerprint_mismatch" => {
            if let Err(error) = capsule_store::clear_peer_conf(Some(&id)) {
                eprintln!("[STEP] sealed_peer_mismatch_clear_fail err={error}");
            }
            Err("fingerprint_mismatch".into())
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn sealed_peer_clear(
    app: AppHandle,
    window: Window,
) -> Result<SealedPeerStoreView, String> {
    require_main_window(&window)?;
    let id = app_identifier(&app);
    Ok(match capsule_store::clear_peer_conf(Some(&id)) {
        Ok(()) => SealedPeerStoreView {
            ok: true,
            code: "cleared".into(),
            message: "ok".into(),
            present: false,
        },
        Err(_) => SealedPeerStoreView {
            ok: false,
            code: "clear_failed".into(),
            message: "Не удалось очистить сохранённый канал".into(),
            present: false,
        },
    })
}

/// Prove L7 reachability through the same SOCKS path product traffic uses.
#[tauri::command]
pub async fn w_transport_l7_probe(
    app: AppHandle,
    window: Window,
) -> Result<L7ProbeView, String> {
    require_main_window(&window)?;
    let st = w_transport_status();
    if !st.enabled {
        return Ok(L7ProbeView {
            ok: false,
            code: "w_transport_off".into(),
            message: "Защищённый канал недоступен в этой сборке".into(),
            status: None,
        });
    }
    if !st.socks_listening {
        return Ok(L7ProbeView {
            ok: false,
            code: "socks_down".into(),
            message: "Канал не подключён".into(),
            status: None,
        });
    }
    let client = match fofline_native_http_client(12) {
        Ok(c) => c,
        Err(e) => {
            return Ok(L7ProbeView {
                ok: false,
                code: "http_client_error".into(),
                message: e,
                status: None,
            });
        }
    };
    let latest = client_defaults::resolve_recovery_latest_json_url(&app);
    let mut target = match crate::native_egress_policy::assert_eliteew_https_platform_url(&latest) {
        Ok(value) => value,
        Err(_) => {
            return Ok(L7ProbeView {
                ok: false,
                code: "platform_target_invalid".into(),
                message: "Адрес проверки канала недоступен в этой сборке".into(),
                status: None,
            });
        }
    };
    target.set_path("/api/health");
    target.set_query(None);
    target.set_fragment(None);
    match client.get(target).send().await {
        Ok(resp) => {
            let code = resp.status().as_u16();
            Ok(L7ProbeView {
                ok: true,
                code: "l7_ok".into(),
                message: "Защищённый канал подтверждён".into(),
                status: Some(code),
            })
        }
        Err(_) => Ok(L7ProbeView {
            ok: false,
            code: "l7_unreachable".into(),
            message: "Канал не подтверждён. Проверьте интернет и повторите.".into(),
            status: None,
        }),
    }
}
