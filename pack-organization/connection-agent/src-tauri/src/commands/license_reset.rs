// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Core local license factory-reset — Journey W5a critical + W5b extended.
// Invariants:
// - Local wipe only — never HTTP revoke / seat cancel.
// - Critical fail keys: entitlement | bind | peer → ok=false.
// - W5b extended steps are best-effort (cleared or skipped; never critical failed).
// - product_webview_wipe runs before w_transport_stop (kill-switch closes product).
// - w_transport_stop is best-effort (skipped on soft fail).
// - Reset requires a main-window one-shot token and authorizes exactly one restart.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.3
// ---

use serde::Serialize;
use tauri::{AppHandle, State, Window};

use crate::action_tickets::ActionTickets;
use crate::ai_secrets;
use crate::ai_third_party_settings;
use crate::capsule_store;
use crate::caller_context::require_main_window;
use crate::clipboard_history;
use crate::commands::product::wipe_product_webview;
use crate::commands::w_transport::w_transport_stop_for_app;
use crate::denylist;
use crate::device_bind;
use crate::entitlement;
use crate::notifications_store;
use crate::spa_pack;

#[derive(Debug, Clone, Serialize)]
pub struct LicenseLocalFactoryResetView {
    pub ok: bool,
    pub cleared: Vec<String>,
    pub skipped: Vec<String>,
    pub failed: Vec<String>,
    pub requires_restart: bool,
}

fn app_data(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

fn record_best_effort(
    cleared: &mut Vec<String>,
    skipped: &mut Vec<String>,
    key: &str,
    result: Result<(), String>,
) {
    match result {
        Ok(()) => {
            cleared.push(key.into());
            eprintln!("[STEP] license_local_factory_reset {key} cleared");
        }
        Err(e) => {
            skipped.push(key.into());
            eprintln!("[STEP] license_local_factory_reset {key} skipped err={e}");
        }
    }
}

/// Local wipe: W5a critical + W5b extended. Does not clear FE storage or restart.
#[tauri::command]
pub fn license_local_factory_reset_prepare(
    window: Window,
    tickets: State<'_, ActionTickets>,
) -> Result<String, String> {
    require_main_window(&window)?;
    tickets.issue_reset_ticket()
}

#[tauri::command]
pub fn license_local_factory_reset(
    app: AppHandle,
    window: Window,
    tickets: State<'_, ActionTickets>,
    confirmation_token: String,
) -> Result<LicenseLocalFactoryResetView, String> {
    require_main_window(&window)?;
    tickets.consume_reset_ticket(&confirmation_token)?;
    let mut cleared: Vec<String> = Vec::new();
    let mut skipped: Vec<String> = Vec::new();
    let mut failed: Vec<String> = Vec::new();

    eprintln!("[STEP] license_local_factory_reset begin");

    // W5b: wipe product browsing data BEFORE transport stop (kill-switch closes window).
    match wipe_product_webview(&app) {
        Ok(view) if view.wiped => {
            cleared.push("product_webview".into());
            eprintln!("[STEP] license_local_factory_reset product_webview cleared");
        }
        Ok(view) => {
            skipped.push("product_webview".into());
            eprintln!(
                "[STEP] license_local_factory_reset product_webview skipped code={}",
                view.code
            );
        }
        Err(e) => {
            skipped.push("product_webview".into());
            eprintln!("[STEP] license_local_factory_reset product_webview skipped err={e}");
        }
    }

    // Best-effort transport stop (+ product WebView kill-switch via stop_cmd).
    let stop = w_transport_stop_for_app(&app);
    if stop.ok || stop.code == "down" || !stop.socks_listening {
        cleared.push("w_transport_stop".into());
        eprintln!(
            "[STEP] license_local_factory_reset w_transport_stop cleared code={} ok={}",
            stop.code, stop.ok
        );
    } else {
        skipped.push("w_transport_stop".into());
        eprintln!(
            "[STEP] license_local_factory_reset w_transport_stop skipped code={} ok={}",
            stop.code, stop.ok
        );
    }

    let data = match app_data(&app) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[STEP] license_local_factory_reset app_data_fail err={e}");
            failed.push("entitlement".into());
            failed.push("bind".into());
            failed.push("peer".into());
            return Ok(LicenseLocalFactoryResetView {
                ok: false,
                cleared,
                skipped,
                failed,
                requires_restart: true,
            });
        }
    };

    // Critical: entitlement / bind / peer
    match entitlement::delete_document(&data) {
        Ok(()) => {
            cleared.push("entitlement".into());
            eprintln!("[STEP] license_local_factory_reset entitlement cleared");
        }
        Err(e) => {
            failed.push("entitlement".into());
            eprintln!("[STEP] license_local_factory_reset entitlement fail err={e}");
        }
    }

    match device_bind::clear(&data) {
        Ok(()) => {
            cleared.push("bind".into());
            eprintln!("[STEP] license_local_factory_reset bind cleared");
        }
        Err(e) => {
            failed.push("bind".into());
            eprintln!("[STEP] license_local_factory_reset bind fail err={e}");
        }
    }

    match capsule_store::clear_peer_conf_all_editions() {
        Ok(()) => {
            cleared.push("peer".into());
            eprintln!("[STEP] license_local_factory_reset peer cleared");
        }
        Err(e) => {
            failed.push("peer".into());
            eprintln!("[STEP] license_local_factory_reset peer fail err={e}");
        }
    }

    // W5b extended (best-effort)
    record_best_effort(
        &mut cleared,
        &mut skipped,
        "fofline_spa",
        spa_pack::remove_pack_tree(&data),
    );
    record_best_effort(
        &mut cleared,
        &mut skipped,
        "denylist",
        denylist::clear_cache(&data),
    );
    record_best_effort(
        &mut cleared,
        &mut skipped,
        "clipboard_history",
        clipboard_history::clear_all(&data),
    );
    record_best_effort(
        &mut cleared,
        &mut skipped,
        "notifications_inbox",
        notifications_store::clear(&data),
    );

    // AI settings + keyring independently; summary key for inventory locks.
    let settings_err = ai_third_party_settings::clear(&data).err();
    let key_err = ai_secrets::clear_legacy_unbound_api_key().err();
    if let Some(e) = &settings_err {
        eprintln!("[STEP] license_local_factory_reset ai_third_party_settings skipped err={e}");
    }
    if let Some(e) = &key_err {
        eprintln!("[STEP] license_local_factory_reset ai_third_party_key skipped err={e}");
    }
    if settings_err.is_none() && key_err.is_none() {
        cleared.push("ai_third_party".into());
        eprintln!("[STEP] license_local_factory_reset ai_third_party cleared");
    } else {
        skipped.push("ai_third_party".into());
        eprintln!("[STEP] license_local_factory_reset ai_third_party skipped");
    }

    if failed.is_empty() {
        if let Err(error) = tickets.issue_restart_ticket("local_factory_reset") {
            failed.push("restart_ticket".into());
            eprintln!("[STEP] license_local_factory_reset restart_ticket fail err={error}");
        }
    }
    let ok = failed.is_empty();
    eprintln!(
        "[STEP] license_local_factory_reset done ok={ok} cleared={:?} skipped={:?} failed={:?}",
        cleared, skipped, failed
    );

    Ok(LicenseLocalFactoryResetView {
        ok,
        cleared,
        skipped,
        failed,
        requires_restart: true,
    })
}
