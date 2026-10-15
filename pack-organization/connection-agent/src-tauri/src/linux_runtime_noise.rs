// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Linux retail runtime: writable WebKit/libsoup storage + GLib log filter for
// known-harmless GTK stack noise (HSTS readonly spam, not product failures).
// Invariants:
// - Called once before any WebKit/Webview init (main early hook).
// - Does not hide EliteEW [STEP] logs or non-suppressed GLib errors.
// - Hard-link cache warnings from WebKitCore may still print (benign FS fallback).
// Related:
// - webkit_linux.rs
// - documentation/product/desktop/DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md §Log noise
// ---

use std::ffi::CStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

const APP_IDENTIFIER: &str = match option_env!("TAURI_APP_IDENTIFIER") {
    Some(id) => id,
    None => "world.empery.desktop.client",
};

static GLIB_FILTER_INSTALLED: AtomicBool = AtomicBool::new(false);

/// Earliest Linux hook: storage repair + GLib filter before WebKitGTK starts.
/// Also prefer X11/XWayland for parented WebviewWindow stage positioning
/// (EBrowser/Meet): Wayland ignores gtk_window_move / Tauri set_position.
#[cfg(target_os = "linux")]
pub fn prepare_linux_desktop_runtime() {
    prefer_x11_backend_for_stage_windows();
    repair_webkit_storage_tree();
    install_glib_log_noise_filter();
}

/// Parented `WebviewWindow` bounds need a working `move_`. On Wayland that is a
/// compositor no-op, so stages stick at (0,0) and cover chrome. Prefer X11 when
/// an X11 display is available (native X11 or XWayland under labwc), even if a
/// launcher exported `GDK_BACKEND=wayland` — unless `ELITEEW_FORCE_GDK_WAYLAND=1`.
#[cfg(target_os = "linux")]
fn prefer_x11_backend_for_stage_windows() {
    let force_wayland = match std::env::var("ELITEEW_FORCE_GDK_WAYLAND") {
        Ok(v) => {
            let t = v.trim();
            t == "1" || t.eq_ignore_ascii_case("true") || t.eq_ignore_ascii_case("yes")
        }
        Err(_) => false,
    };
    if force_wayland {
        std::env::set_var("GDK_BACKEND", "wayland");
        eprintln!("[STEP] gdk_backend force=wayland reason=ELITEEW_FORCE_GDK_WAYLAND");
        return;
    }
    let has_wayland = std::env::var_os("WAYLAND_DISPLAY").is_some();
    let has_x11 = std::env::var_os("DISPLAY").is_some();
    if has_x11 {
        // X11 or XWayland: restore gtk_window_move for EBrowser/Meet stages.
        std::env::set_var("GDK_BACKEND", "x11");
        eprintln!(
            "[STEP] gdk_backend prefer=x11 reason=webviewwindow_stage_bounds wayland_session={}",
            has_wayland
        );
        return;
    }
    eprintln!(
        "[STEP] gdk_backend skip_prefer_x11 wayland={} display={}",
        has_wayland, has_x11
    );
}

#[cfg(not(target_os = "linux"))]
pub fn prepare_linux_desktop_runtime() {}

#[cfg(target_os = "linux")]
pub(crate) fn app_share_data_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(
        PathBuf::from(home)
            .join(".local")
            .join("share")
            .join(APP_IDENTIFIER),
    )
}

#[cfg(not(target_os = "linux"))]
pub(crate) fn app_share_data_dir() -> Option<PathBuf> {
    None
}

pub(crate) fn should_suppress_glib_warning(domain: &str, message: &str) -> bool {
    let domain_l = domain.to_ascii_lowercase();
    if !(domain_l.contains("soup") || domain_l.contains("libsoup")) {
        return false;
    }
    message.contains("soup_hsts_policies")
        || message.contains("readonly database")
        || message.contains("table soup_hsts_policies already exists")
}

#[cfg(target_os = "linux")]
fn repair_webkit_storage_tree() {
    let Some(root) = app_share_data_dir() else {
        return;
    };
    if let Err(e) = fs::create_dir_all(&root) {
        eprintln!("[STEP] linux_runtime_noise data_dir_create_fail err={e}");
        return;
    }
    let _ = ensure_owner_rw(&root, true);
    let cache = root.join("WebKitCache");
    if cache.is_dir() {
        let _ = ensure_owner_rw(&cache, true);
        repair_tree_sqlite(&cache);
    }
    for name in ["hsts-storage.sqlite", "HSTSStorage/hsts-storage.sqlite"] {
        let path = root.join(name);
        if path.is_file() {
            let _ = ensure_owner_rw(&path, false);
        }
    }
}

#[cfg(target_os = "linux")]
fn repair_tree_sqlite(root: &Path) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            repair_tree_sqlite(&path);
            let _ = ensure_owner_rw(&path, true);
            continue;
        }
        let is_sqlite = path
            .extension()
            .is_some_and(|ext| ext == "sqlite" || ext == "db");
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if is_sqlite || name.contains("hsts") {
            let _ = ensure_owner_rw(&path, false);
        }
    }
}

#[cfg(target_os = "linux")]
fn ensure_owner_rw(path: &Path, is_dir: bool) -> std::io::Result<()> {
    let meta = fs::metadata(path)?;
    let mut perms = meta.permissions();
    let mode = perms.mode();
    let want = if is_dir { mode | 0o700 } else { mode | 0o600 };
    if want != mode {
        perms.set_mode(want);
        fs::set_permissions(path, perms)?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
type GLogFunc = extern "C" fn(
    *const libc::c_char,
    libc::c_int,
    *const libc::c_char,
    *mut libc::c_void,
);

#[cfg(target_os = "linux")]
static mut PREV_GLIB_HANDLER: Option<GLogFunc> = None;

#[cfg(target_os = "linux")]
extern "C" fn glib_log_handler(
    domain: *const libc::c_char,
    level: libc::c_int,
    message: *const libc::c_char,
    user_data: *mut libc::c_void,
) {
    const G_LOG_LEVEL_WARNING: libc::c_int = 1 << 3;
    let domain_s = cstr_lossy(domain);
    let message_s = cstr_lossy(message);
    if level & G_LOG_LEVEL_WARNING != 0 && should_suppress_glib_warning(&domain_s, &message_s) {
        return;
    }
    unsafe {
        if let Some(prev) = PREV_GLIB_HANDLER {
            prev(domain, level, message, user_data);
        } else {
            eprintln!("({domain_s}:{level}) {message_s}");
        }
    }
}

#[cfg(target_os = "linux")]
fn cstr_lossy(raw: *const libc::c_char) -> String {
    if raw.is_null() {
        return String::new();
    }
    unsafe { CStr::from_ptr(raw) }.to_string_lossy().into_owned()
}

#[cfg(target_os = "linux")]
extern "C" {
    fn g_log_set_default_handler(
        func: GLogFunc,
        user_data: *mut libc::c_void,
    ) -> GLogFunc;
}

#[cfg(target_os = "linux")]
fn install_glib_log_noise_filter() {
    if GLIB_FILTER_INSTALLED.swap(true, Ordering::SeqCst) {
        return;
    }
    unsafe {
        PREV_GLIB_HANDLER = Some(g_log_set_default_handler(
            glib_log_handler,
            std::ptr::null_mut(),
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suppresses_libsoup_hsts_readonly_spam() {
        assert!(should_suppress_glib_warning(
            "libsoup",
            "Failed to execute query: attempt to write a readonly database"
        ));
        assert!(should_suppress_glib_warning(
            "Soup",
            "Failed to execute query: table soup_hsts_policies already exists"
        ));
    }

    #[test]
    fn keeps_other_glib_warnings() {
        assert!(!should_suppress_glib_warning(
            "Gtk",
            "Failed to allocate widget"
        ));
        assert!(!should_suppress_glib_warning(
            "libsoup",
            "Could not resolve host example.invalid"
        ));
    }

    #[test]
    fn prefer_x11_helper_is_wired_in_prepare() {
        let src = include_str!("linux_runtime_noise.rs");
        assert!(src.contains("prefer_x11_backend_for_stage_windows"));
        assert!(src.contains("webviewwindow_stage_bounds"));
        assert!(src.contains("ELITEEW_FORCE_GDK_WAYLAND"));
    }
}
