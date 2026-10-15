// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// System tray: restore on click; window close and Quit revoke Keycloak then exit.
// Invariants:
// - Close on Hub/product is the same as tray Выйти: RFC 7009 revoke, local wipe,
//   orderly webview destroy, process exit (no hide-to-tray keeping refresh alive).
// - oidc-auth CloseRequested is not this path (login cancel).
// - Quit destroys WebView windows before app.exit so WebKitWebProcess can tear
//   down Mesa/EGL without racing __eglFini during sudden host exit (Fedora SEGV).
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
// ---

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

/// Set when tray Quit (or equivalent) starts orderly teardown.
static APP_QUITTING: AtomicBool = AtomicBool::new(false);

/// Pause after webview destroy so WebKitWebProcess can finish GLContext/EGL teardown
/// before the host process runs exit handlers (avoids Mesa `__eglFini` heap SEGV noise).
const QUIT_WEBVIEW_DRAIN_MS: u64 = 200;

pub fn is_quitting() -> bool {
    APP_QUITTING.load(Ordering::SeqCst)
}

fn show_main<R: Runtime>(app: &tauri::AppHandle<R>) {
    if is_quitting() {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Orderly quit: RFC 7009 revoke, then destroy webviews, then exit after a short drain.
///
/// Cause: hide-to-tray + heartbeat/refresh kept Keycloak SSO idle from firing.
/// Close and tray Выйти must tell Keycloak the token is done, then stop the process.
///
/// Mesa: `app.exit(0)` alone kills the host while WebKitWebProcess is still
/// tearing down Skia/EGL → `__eglFini` SEGV. Destroy webviews first.
pub fn request_quit<R: Runtime>(app: &tauri::AppHandle<R>) {
    if APP_QUITTING.swap(true, Ordering::SeqCst) {
        eprintln!("[STEP] tray_quit_skip reason=already_quitting");
        return;
    }
    eprintln!("[STEP] tray_quit begin revoke_then_webview_teardown");
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match app.path().app_data_dir() {
            Ok(data) => {
                let id = app.config().identifier.clone();
                crate::native_oidc::token::logout_all_clients(&data, Some(&id)).await;
            }
            Err(e) => {
                eprintln!("[STEP] tray_quit revoke_skip reason=app_data err={e}");
            }
        }
        let app_main = app.clone();
        if let Err(e) = app.run_on_main_thread(move || {
            finish_quit_teardown(&app_main);
        }) {
            eprintln!("[STEP] tray_quit teardown_schedule_fail err={e}");
            finish_quit_teardown(&app);
        }
    });
}

fn finish_quit_teardown<R: Runtime>(app: &tauri::AppHandle<R>) {
    let mut labels: Vec<String> = app.webview_windows().into_keys().collect();
    // Destroy "main" last so product/kernel webviews release first.
    labels.sort_by(|a, b| match (a.as_str() == "main", b.as_str() == "main") {
        (true, false) => std::cmp::Ordering::Greater,
        (false, true) => std::cmp::Ordering::Less,
        _ => a.cmp(b),
    });

    for label in labels {
        if let Some(w) = app.get_webview_window(&label) {
            match w.destroy() {
                Ok(()) => eprintln!("[STEP] tray_quit webview_destroyed label={label}"),
                Err(e) => {
                    eprintln!("[STEP] tray_quit webview_destroy_err label={label} err={e}")
                }
            }
        }
    }

    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(QUIT_WEBVIEW_DRAIN_MS));
        eprintln!("[STEP] tray_quit app_exit after_drain_ms={QUIT_WEBVIEW_DRAIN_MS}");
        app.exit(0);
    });
}

pub fn install_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Показать окно", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Выйти", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let Some(icon) = app.default_window_icon().cloned() else {
        // No icon in context — skip tray rather than fail app start.
        return Ok(());
    };

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("Рабочий стол EliteEW")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "quit" => request_quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}
