// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri application entry: WG + identity + entitlement + updater + AI + O5 + FS bridge + tray.
// Invariants:
// - No mobile Secure Connection codepaths.
// - Offline Start requires local Ed25519 entitlement verify (O0+O1).
// - OTA uses tauri-plugin-updater; fail-closed without URL+pubkey (O2).
// - O3c–O3e: local / third_party / eliteew AI panels.
// - O5: device-local pack panels (clipboard / notifications / native offline music); no SPA Kernel mount.
// - Stage 2 FS bridge: allowlisted Import/staging only (default-deny elsewhere).
// - Window close and tray Выйти: RFC 7009 revoke, then orderly webview destroy + exit.
//   oidc-auth close is login cancel (not app quit). SPA product logout still
//   deferred-destroys the product window without quitting Hub.
// - Single-instance (tauri-plugin-single-instance): second launch focuses existing window
//   (identifier differs for FoFline vs Desktop Connected — both may run).
// - Linux: WebKitGTK graphics safe-mode forced in-binary (no user shell commands).
// - FoFline L3: custom protocol fofline-spa → verified pack under app_data.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §L3
// ---

#[cfg(all(feature = "retail", feature = "ops-system-wg"))]
compile_error!("features `retail` and `ops-system-wg` are mutually exclusive");
#[cfg(not(any(feature = "retail", feature = "ops-system-wg")))]
compile_error!("select exactly one desktop-client profile: `retail` or `ops-system-wg`");

mod action_tickets;
mod activation_gate;
mod ai_http;
mod ai_secrets;
mod ai_third_party_settings;
mod air_enroll_code;
mod air_enroll_ws;
mod capsule;
mod capsule_store;
mod capsule_v2;
mod capsule_v3;
mod caller_context;
mod clipboard_history;
mod commands;
mod client_defaults;
mod denylist;
mod ebrowser_nav_policy;
mod ebrowser_policy_fetch;
mod ebrowser_tabs;
mod device_bind;
mod device_identity;
mod device_keys;
mod dpop_crypto;
mod device_request;
mod entitlement;
mod license_gate;
mod native_oidc;
mod error;
mod fs_bridge;
mod host_network;
mod native_audio;
mod notifications_store;
mod artifact_stream;
mod file_grant;
mod fofline_egress;
mod fofline_spa_origin;
mod native_egress_policy;
mod resource_policy;
mod rpm_payload;
mod safe_archive;
mod spa_assets;
mod update_spool;
mod verified_update_plan;
mod spa_pack;
mod tray;
mod wg;
mod linux_runtime_noise;
mod webkit_linux;
#[cfg(feature = "ops-system-wg")]
mod ops;
#[cfg(feature = "ops-system-wg")]
mod ops_invoke;

use commands::ai_eliteew::{ai_eliteew_chat, ai_eliteew_status};
use commands::ai_local::{ai_local_chat, ai_local_status};
use commands::app_lifecycle::{app_restart, launcher_open_external};
use commands::ai_third_party::{
    ai_third_party_chat, ai_third_party_clear_api_key, ai_third_party_save_api_key,
    ai_third_party_save_settings, ai_third_party_status,
};
use action_tickets::ActionTickets;
use commands::air_enroll::air_enroll_exchange;
use commands::capsule::{capsule_import_channel, capsule_import_pick_file};
use commands::sealed_store::{
    sealed_peer_clear, sealed_peer_load, w_transport_l7_probe,
};
use commands::clipboard::{clipboard_read, clipboard_status, clipboard_write};
use commands::denylist::{denylist_refresh, denylist_status};
use commands::device_bind::{device_bind_ensure, device_bind_status};
use commands::device_identity::{device_identity_ensure, device_identity_status};
use commands::device_request::{device_request_prepare, device_request_status};
use commands::fs_bridge::{
    fs_bridge_list_dir, fs_bridge_read_file, fs_bridge_roots, fs_bridge_write_atomic,
};
use commands::entitlement::{
    entitlement_import_from_grant, entitlement_import_json, entitlement_status,
};
use commands::file_grant::{file_grant_issue, file_grant_pick};
use commands::health::desktop_client_ping;
use commands::host_network_cmd::{
    host_network_link_snapshot, host_network_status, host_network_wifi_connect,
    host_network_wifi_disconnect, host_network_wifi_scan, host_network_wired_apply,
};
use commands::kernel_offline::kernel_offline_open_mount;
use commands::license::license_status;
use commands::license_gate_cmd::{license_heartbeat_cmd, license_preflight_cmd};
use commands::license_reset::{
    license_local_factory_reset, license_local_factory_reset_prepare,
};
use commands::native_audio::{
    native_audio_pause, native_audio_play_from_grant, native_audio_resume, native_audio_seek,
    native_audio_set_volume, native_audio_status, native_audio_stop,
};
use commands::native_oidc::{
    native_oidc_complete, native_oidc_interactive_login, native_oidc_logout, native_oidc_refresh,
    native_oidc_start,
};
use commands::notifications::{notifications_add, notifications_dismiss, notifications_list};
use commands::product::{
    fofline_local_start_url, product_close_for_license_kill_switch_cmd, product_open,
    product_webview_wipe,
};
use commands::product_session::{product_session_logout, product_session_refresh};
use commands::video_call_meet_stage::{
    video_call_meet_stage_close, video_call_meet_stage_open, video_call_meet_stage_set_bounds,
};
use commands::ebrowser_stage::{
    ebrowser_close, ebrowser_find, ebrowser_get_chrome_snapshot, ebrowser_get_downloads,
    ebrowser_get_location, ebrowser_get_media_toggles, ebrowser_get_zoom,
    ebrowser_history_back, ebrowser_history_forward, ebrowser_navigate, ebrowser_open,
    ebrowser_refresh_policy, ebrowser_reload, ebrowser_set_bounds, ebrowser_set_media_toggles,
    ebrowser_set_zoom, ebrowser_tab_activate, ebrowser_tab_close, ebrowser_tab_create,
    ebrowser_tabs_list,
};
use commands::spa_pack::{
    fofline_spa_assets_cancel, fofline_spa_assets_sync, fofline_spa_pack_check_update,
    fofline_spa_pack_status, fofline_spa_pack_sync, SpaPackGate,
};
use commands::updater::{updater_check, updater_install};
use commands::updater_recovery::updater_recovery_install;
use commands::webkit_graphics::{webkit_graphics_reset, webkit_graphics_status};
use commands::w_transport::{
    w_transport_proxy_url_cmd, w_transport_recover_from_keyring, w_transport_start_from_keyring,
    w_transport_status_cmd, w_transport_stop_cmd, w_transport_stop_for_app,
};
#[cfg(feature = "ops-system-wg")]
use commands::w_transport::seat_channel_bring_up;
use native_audio::NativeAudioEngine;
use spa_pack::SpaPackRuntime;
use std::sync::{Arc, Mutex};
use tauri::Manager;
#[cfg(desktop)]
use tauri::WebviewWindow;

/// Public early hook for `main` — retail Linux seats never set WEBKIT_* by hand.
pub fn apply_linux_graphics_before_webview() {
    linux_runtime_noise::prepare_linux_desktop_runtime();
    webkit_linux::apply_webkit_graphics_mitigation();
}

/// Retail release: W-transport is mandatory for FoFline and Connected.
#[cfg(feature = "retail")]
pub fn ensure_w_transport_packaged_default() {
    std::env::set_var("ELITEEW_FOFLINE_W_TRANSPORT", "1");
    wg::userspace::ensure_packaged_w_transport_default();
}

/// Ops profile may explicitly switch to the system-WG portal.
#[cfg(feature = "ops-system-wg")]
pub fn ensure_w_transport_packaged_default() {
    wg::userspace::ensure_packaged_w_transport_default();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    ensure_w_transport_packaged_default();
    // Process-once with main(): second call must not treat in-process marker as unclean exit.
    webkit_linux::apply_webkit_graphics_mitigation();

    let mut builder = tauri::Builder::default();
    // Official: https://v2.tauri.app/plugin/single-instance/
    // Desktop only. Mutex/DBus keyed by bundle id — FoFline (`world.empery.fofline`)
    // and Desktop Connected (`world.empery.desktop.client`) remain independent.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_existing_main_window(app);
        }));
    }
    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Arc::new(NativeAudioEngine::new()))
        .manage(ActionTickets::default())
        .manage(SpaPackGate(Mutex::new(SpaPackRuntime::default())))
        .register_uri_scheme_protocol("fofline-spa", |ctx, request| {
            let app_data = match ctx.app_handle().path().app_data_dir() {
                Ok(p) => p,
                Err(_) => {
                    return tauri::http::Response::builder()
                        .status(500)
                        .header(
                            tauri::http::header::CONTENT_TYPE,
                            "text/plain; charset=utf-8",
                        )
                        .body(b"app data unavailable".to_vec())
                        .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()));
                }
            };
            fofline_spa_origin::respond_pack_request(&app_data, request)
        })
        .setup(|app| {
            tray::install_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::Destroyed => {
                    if window.label() == "product" {
                        commands::product_session::clear_product_logout_closing();
                    }
                }
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // During tray Quit, allow real close/destroy.
                    if tray::is_quitting() {
                        return;
                    }
                    // Short-lived Hub OIDC auth window must close, not quit the app.
                    if window.label() == crate::native_oidc::hub_login::AUTH_WINDOW_LABEL {
                        return;
                    }
                    // Product SPA logout deferred destroy — do not start a second app quit.
                    if window.label() == "product"
                        && commands::product_session::is_product_logout_closing()
                    {
                        return;
                    }
                    api.prevent_close();
                    tray::request_quit(window.app_handle());
                }
                _ => {}
            }
        });

    #[cfg(feature = "retail")]
    let builder = builder.invoke_handler(tauri::generate_handler![
            desktop_client_ping,
            host_network_status,
            host_network_link_snapshot,
            host_network_wired_apply,
            host_network_wifi_scan,
            host_network_wifi_connect,
            host_network_wifi_disconnect,
            license_status,
            license_local_factory_reset_prepare,
            license_local_factory_reset,
            device_identity_status,
            device_identity_ensure,
            device_request_prepare,
            device_request_status,
            device_bind_status,
            device_bind_ensure,
            entitlement_status,
            entitlement_import_json,
            entitlement_import_from_grant,
            file_grant_issue,
            file_grant_pick,
            capsule_import_channel,
            capsule_import_pick_file,
            air_enroll_exchange,
            license_preflight_cmd,
            license_heartbeat_cmd,
            sealed_peer_load,
            sealed_peer_clear,
            w_transport_l7_probe,
            w_transport_status_cmd,
            w_transport_proxy_url_cmd,
            w_transport_start_from_keyring,
            w_transport_recover_from_keyring,
            w_transport_stop_cmd,
            product_open,
            fofline_local_start_url,
            product_webview_wipe,
            product_close_for_license_kill_switch_cmd,
            product_session_refresh,
            product_session_logout,
            video_call_meet_stage_open,
            video_call_meet_stage_set_bounds,
            video_call_meet_stage_close,
            ebrowser_open,
            ebrowser_navigate,
            ebrowser_refresh_policy,
            ebrowser_get_location,
            ebrowser_get_chrome_snapshot,
            ebrowser_reload,
            ebrowser_history_back,
            ebrowser_history_forward,
            ebrowser_set_bounds,
            ebrowser_close,
            ebrowser_get_downloads,
            ebrowser_tabs_list,
            ebrowser_tab_create,
            ebrowser_tab_activate,
            ebrowser_tab_close,
            ebrowser_set_media_toggles,
            ebrowser_get_media_toggles,
            ebrowser_find,
            ebrowser_set_zoom,
            ebrowser_get_zoom,
            native_oidc_start,
            native_oidc_complete,
            native_oidc_refresh,
            native_oidc_logout,
            native_oidc_interactive_login,
            kernel_offline_open_mount,
            updater_check,
            updater_install,
            updater_recovery_install,
            fofline_spa_pack_status,
            fofline_spa_pack_check_update,
            fofline_spa_pack_sync,
            fofline_spa_assets_sync,
            fofline_spa_assets_cancel,
            webkit_graphics_status,
            webkit_graphics_reset,
            app_restart,
            launcher_open_external,
            ai_local_status,
            ai_local_chat,
            ai_third_party_status,
            ai_third_party_save_settings,
            ai_third_party_save_api_key,
            ai_third_party_clear_api_key,
            ai_third_party_chat,
            ai_eliteew_status,
            ai_eliteew_chat,
            denylist_status,
            denylist_refresh,
            clipboard_status,
            clipboard_read,
            clipboard_write,
            fs_bridge_roots,
            fs_bridge_list_dir,
            fs_bridge_read_file,
            fs_bridge_write_atomic,
            notifications_list,
            notifications_add,
            notifications_dismiss,
            native_audio_play_from_grant,
            native_audio_pause,
            native_audio_resume,
            native_audio_stop,
            native_audio_seek,
            native_audio_set_volume,
            native_audio_status,
        
    ]);
    #[cfg(feature = "ops-system-wg")]
    let builder = builder.invoke_handler(crate::ops_system_wg_handlers!());

    builder
        .build(tauri::generate_context!())
        .expect("error while building EliteEW desktop-client")
        .run(|app, event| match event {
            // Last WebviewWindow::destroy() emits ExitRequested { code: None }.
            // Tray apps must prevent that so we can drain WebKit/EGL before app.exit(0).
            tauri::RunEvent::ExitRequested { api, code, .. } => {
                if code.is_none() {
                    api.prevent_exit();
                    eprintln!("[STEP] tray_quit_or_last_window ExitRequested prevented code=none");
                }
            }
            tauri::RunEvent::Exit => {
                // No System Footprint: tear down userspace SOCKS + product kill-switch before exit.
                let _ = w_transport_stop_for_app(app);
                webkit_linux::end_webkit_session();
            }
            _ => {}
        });
}

/// Focus (and unhide from tray) the primary window when a second process is launched.
#[cfg(desktop)]
fn focus_existing_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("[STEP] single_instance: main window missing");
        return;
    };
    bring_window_to_foreground(&window);
}

#[cfg(desktop)]
fn bring_window_to_foreground(window: &WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}
