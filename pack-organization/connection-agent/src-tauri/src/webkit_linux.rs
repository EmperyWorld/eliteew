// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Linux WebKitGTK graphics mitigations applied by the binary before the webview
// starts — end users must never set env vars or shell commands.
// Invariants:
// - Default (retail): neither DMABUF-off nor compositing-off — DMA-BUF path kept.
//   Unconditional WEBKIT_DISABLE_DMABUF_RENDERER=1 forces slow SHM/readback and can
//   pin ~1 CPU core under UI even with GPU compositing “kept”.
// - Escalation (sticky / ≥2 unclean): DMABUF-off + COMPOSITING_MODE=1 last resort.
// - Ops: ELITEEW_WEBKIT_FORCE_DMABUF_OFF=1 (DMABUF only); ELITEEW_WEBKIT_ALLOW_DMABUF=1
//   clears a poisoned .desktop/env DMABUF-off.
// - apply_webkit_graphics_mitigation is process-once (main + run both call it).
// - SIGINT/SIGTERM/SIGHUP unlink the session marker (async-signal-safe) so debug
//   terminal stops are not treated as WebProcess crashes.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §WebKitGTK
// - https://v2.tauri.app/develop/debug/linux-graphics/
// ---

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

const MARKER_NAME: &str = "webkit_session.marker";
/// Sticky escalate-to-compositing-off (written only after repeated unclean exits).
const COMPOSITING_OFF_FLAG: &str = "webkit_graphics_compositing_off";
/// Retired 0.4.7 flag that forced full software path for everyone — cleared on start.
const LEGACY_SAFE_MODE_FLAG: &str = "webkit_graphics_safe_mode";
/// One-shot: 0.4.8–0.4.9 called apply twice; first begin() marker looked like unclean exit.
const FALSE_ESCALATE_CLEARED_FLAG: &str = "webkit_false_escalate_cleared_0_4_10";
/// One-shot: 0.4.10 sticky from a single leftover marker (Ctrl+C / kill) → clear.
const ESCALATE_POLICY_CLEARED_FLAG: &str = "webkit_escalate_policy_0_4_11";
/// Count of unclean exits without a clean `end_webkit_session` (tray Quit / Exit).
const UNCLEAN_STRIKES_NAME: &str = "webkit_unclean_strikes";
/// Sticky escalate only after this many unclean starts without a clean exit between.
const UNCLEAN_STRIKES_BEFORE_STICKY: u32 = 2;

/// Guards against main()+run() double apply treating in-process marker as unclean exit.
static APPLY_DONE_THIS_PROCESS: AtomicBool = AtomicBool::new(false);
static SIGNAL_HANDLERS_INSTALLED: AtomicBool = AtomicBool::new(false);
/// Absolute marker path for async-signal-safe unlink on SIGINT/SIGTERM/SIGHUP.
static MARKER_CSTR: OnceLock<std::ffi::CString> = OnceLock::new();

fn env_flag_truthy(name: &str) -> bool {
    match std::env::var(name) {
        Ok(v) => {
            let t = v.trim();
            t == "1" || t.eq_ignore_ascii_case("true") || t.eq_ignore_ascii_case("yes")
        }
        Err(_) => false,
    }
}

/// Ops: keep / restore DMA-BUF (clears forced DMABUF-off from env/.desktop).
#[cfg(target_os = "linux")]
pub fn allow_dmabuf_requested() -> bool {
    env_flag_truthy("ELITEEW_WEBKIT_ALLOW_DMABUF")
}

/// Ops: force DMABUF-off without full compositing escalate (blank-window class).
#[cfg(target_os = "linux")]
pub fn force_dmabuf_off_requested() -> bool {
    env_flag_truthy("ELITEEW_WEBKIT_FORCE_DMABUF_OFF")
}

/// Backward-compatible name: true when retail should still force DMABUF-off.
/// Default is **false** (0.4.11+) — modern WebKitGTK + Wayland need DMA-BUF for FPS.
#[cfg(target_os = "linux")]
pub fn should_apply_dmabuf_mitigation() -> bool {
    if allow_dmabuf_requested() {
        return false;
    }
    force_dmabuf_off_requested()
}

#[cfg(target_os = "linux")]
fn data_dir() -> Option<PathBuf> {
    crate::linux_runtime_noise::app_share_data_dir()
}

#[cfg(target_os = "linux")]
fn marker_path() -> Option<PathBuf> {
    data_dir().map(|d| d.join(MARKER_NAME))
}

#[cfg(target_os = "linux")]
fn compositing_off_flag_path() -> Option<PathBuf> {
    data_dir().map(|d| d.join(COMPOSITING_OFF_FLAG))
}

#[cfg(target_os = "linux")]
fn legacy_safe_mode_flag_path() -> Option<PathBuf> {
    data_dir().map(|d| d.join(LEGACY_SAFE_MODE_FLAG))
}

#[cfg(target_os = "linux")]
fn unclean_strikes_path() -> Option<PathBuf> {
    data_dir().map(|d| d.join(UNCLEAN_STRIKES_NAME))
}

/// Drop 0.4.7 always-on sticky that forced compositing-off for every seat.
#[cfg(target_os = "linux")]
fn clear_legacy_full_safe_mode_flag() {
    if let Some(path) = legacy_safe_mode_flag_path() {
        if path.is_file() {
            let _ = fs::remove_file(&path);
            eprintln!(
                "[STEP] webkit_linux: cleared legacy webkit_graphics_safe_mode (was forcing 1-core software compositing)"
            );
        }
    }
}

#[cfg(target_os = "linux")]
fn false_escalate_cleared_path() -> Option<PathBuf> {
    data_dir().map(|d| d.join(FALSE_ESCALATE_CLEARED_FLAG))
}

#[cfg(target_os = "linux")]
fn escalate_policy_cleared_path() -> Option<PathBuf> {
    data_dir().map(|d| d.join(ESCALATE_POLICY_CLEARED_FLAG))
}

/// 0.4.8–0.4.9: main()+run() both applied mitigation; in-process marker → false escalate sticky.
#[cfg(target_os = "linux")]
fn clear_poisoned_double_apply_sticky() {
    let Some(stamp) = false_escalate_cleared_path() else {
        return;
    };
    if stamp.is_file() {
        return;
    }
    if let Some(path) = compositing_off_flag_path() {
        if path.is_file() {
            if let Err(e) = fs::remove_file(&path) {
                eprintln!(
                    "[STEP] webkit_linux: poisoned compositing_off clear_fail err={e} — not stamping migration"
                );
                return;
            }
            eprintln!(
                "[STEP] webkit_linux: cleared poisoned webkit_graphics_compositing_off (false escalate from double apply)"
            );
        }
    }
    if let Some(parent) = stamp.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Err(e) = fs::write(&stamp, b"1\n") {
        eprintln!("[STEP] webkit_linux: false_escalate_cleared_write_fail err={e}");
    }
}

/// 0.4.10: any leftover marker wrote sticky forever (Ctrl+C / kill / WAYLAND_DEBUG).
/// One unclean must not pin software compositing — clear sticky + strikes once.
#[cfg(target_os = "linux")]
fn clear_poisoned_single_unclean_sticky() {
    let Some(stamp) = escalate_policy_cleared_path() else {
        return;
    };
    if stamp.is_file() {
        return;
    }
    if let Some(path) = compositing_off_flag_path() {
        if path.is_file() {
            if let Err(e) = fs::remove_file(&path) {
                eprintln!(
                    "[STEP] webkit_linux: single_unclean sticky clear_fail err={e} — not stamping policy migration"
                );
                return;
            }
            eprintln!(
                "[STEP] webkit_linux: cleared webkit_graphics_compositing_off (0.4.11: sticky only after repeated unclean exits)"
            );
        }
    }
    clear_unclean_strikes();
    if let Some(parent) = stamp.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Err(e) = fs::write(&stamp, b"1\n") {
        eprintln!("[STEP] webkit_linux: escalate_policy_cleared_write_fail err={e}");
    }
}

#[cfg(target_os = "linux")]
fn read_unclean_strikes() -> u32 {
    let Some(path) = unclean_strikes_path() else {
        return 0;
    };
    let Ok(raw) = fs::read_to_string(&path) else {
        return 0;
    };
    raw.trim().parse::<u32>().unwrap_or(0)
}

#[cfg(target_os = "linux")]
fn write_unclean_strikes(n: u32) {
    let Some(path) = unclean_strikes_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Err(e) = fs::write(&path, format!("{n}\n")) {
        eprintln!("[STEP] webkit_linux: unclean_strikes_write_fail err={e}");
    }
}

#[cfg(target_os = "linux")]
fn clear_unclean_strikes() {
    if let Some(path) = unclean_strikes_path() {
        let _ = fs::remove_file(path);
    }
}

#[cfg(target_os = "linux")]
fn bump_unclean_strikes() -> u32 {
    let n = read_unclean_strikes().saturating_add(1);
    write_unclean_strikes(n);
    n
}

/// Persist escalate sticky after repeated unclean exits (likely real WebProcess class).
#[cfg(target_os = "linux")]
pub fn mark_compositing_off_sticky() {
    if let Some(path) = compositing_off_flag_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Err(e) = fs::write(&path, b"1\n") {
            eprintln!("[STEP] webkit_linux: compositing_off_flag_write_fail err={e}");
        } else {
            eprintln!("[STEP] webkit_linux: sticky compositing-off flag written (post-crash escalate)");
        }
    }
}

#[cfg(target_os = "linux")]
fn compositing_off_sticky_active() -> bool {
    compositing_off_flag_path()
        .map(|p| p.is_file())
        .unwrap_or(false)
}

/// True when this process already escalated to software compositing (~1-core lag).
#[cfg(target_os = "linux")]
fn process_escalated_compositing() -> bool {
    matches!(
        std::env::var("WEBKIT_DISABLE_COMPOSITING_MODE").as_deref(),
        Ok("1") | Ok("true") | Ok("TRUE")
    )
}

/// Seat status for in-app recovery UI (no shell `rm`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphicsRecoveryView {
    pub sticky_compositing_off: bool,
    pub process_escalated: bool,
    pub unclean_strikes: u32,
}

#[cfg(target_os = "linux")]
pub fn graphics_recovery_status() -> GraphicsRecoveryView {
    GraphicsRecoveryView {
        sticky_compositing_off: compositing_off_sticky_active(),
        process_escalated: process_escalated_compositing(),
        unclean_strikes: read_unclean_strikes(),
    }
}

#[cfg(not(target_os = "linux"))]
pub fn graphics_recovery_status() -> GraphicsRecoveryView {
    GraphicsRecoveryView {
        sticky_compositing_off: false,
        process_escalated: false,
        unclean_strikes: 0,
    }
}

/// Clear sticky escalate + unclean strikes so the next launch keeps GPU compositing.
/// Does not mutate env in this process — caller must restart for effect.
#[cfg(target_os = "linux")]
pub fn clear_graphics_sticky_for_user_recovery() -> GraphicsRecoveryView {
    let before = graphics_recovery_status();
    if let Some(path) = compositing_off_flag_path() {
        match fs::remove_file(&path) {
            Ok(()) => {
                eprintln!(
                    "[STEP] webkit_linux: user recovery cleared webkit_graphics_compositing_off"
                );
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => {
                eprintln!("[STEP] webkit_linux: user recovery sticky clear_fail err={e}");
            }
        }
    }
    clear_unclean_strikes();
    eprintln!(
        "[STEP] webkit_linux: user recovery cleared unclean_strikes (was {}); restart required to leave software compositing",
        before.unclean_strikes
    );
    graphics_recovery_status()
}

#[cfg(not(target_os = "linux"))]
pub fn clear_graphics_sticky_for_user_recovery() -> GraphicsRecoveryView {
    graphics_recovery_status()
}

/// Leftover session marker = prior process did not call `end_webkit_session`.
/// Returns true only when escalate sticky should apply for this launch.
#[cfg(target_os = "linux")]
pub fn recover_unclean_webkit_exit() -> bool {
    let Some(path) = marker_path() else {
        return false;
    };
    if !path.is_file() {
        return false;
    }
    let _ = fs::remove_file(&path);
    let strikes = bump_unclean_strikes();
    if strikes >= UNCLEAN_STRIKES_BEFORE_STICKY {
        eprintln!(
            "[STEP] webkit_linux: unclean prior exit strike={strikes}/{UNCLEAN_STRIKES_BEFORE_STICKY} — escalating to compositing-off"
        );
        mark_compositing_off_sticky();
        return true;
    }
    eprintln!(
        "[STEP] webkit_linux: unclean prior exit strike={strikes}/{UNCLEAN_STRIKES_BEFORE_STICKY} — GPU compositing kept (single Ctrl+C/kill must not force 1-core software path)"
    );
    false
}

#[cfg(target_os = "linux")]
fn remember_marker_cstr_for_signals(path: &std::path::Path) {
    if MARKER_CSTR.get().is_some() {
        return;
    }
    let Ok(c) = std::ffi::CString::new(path.to_string_lossy().as_bytes()) else {
        return;
    };
    let _ = MARKER_CSTR.set(c);
}

/// Async-signal-safe: unlink session marker then exit (avoids sticky from Ctrl+C).
#[cfg(target_os = "linux")]
extern "C" fn clear_marker_on_signal(sig: libc::c_int) {
    if let Some(c) = MARKER_CSTR.get() {
        unsafe {
            libc::unlink(c.as_ptr());
        }
    }
    unsafe {
        libc::_exit(128 + sig);
    }
}

#[cfg(target_os = "linux")]
fn install_clean_exit_signal_handlers() {
    if SIGNAL_HANDLERS_INSTALLED.swap(true, Ordering::SeqCst) {
        return;
    }
    unsafe {
        let handler = clear_marker_on_signal as *const () as libc::sighandler_t;
        libc::signal(libc::SIGINT, handler);
        libc::signal(libc::SIGTERM, handler);
        libc::signal(libc::SIGHUP, handler);
    }
    eprintln!("[STEP] webkit_linux: SIGINT/SIGTERM/SIGHUP clear session marker (no false unclean escalate)");
}

#[cfg(target_os = "linux")]
pub fn begin_webkit_session() {
    let Some(path) = marker_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    remember_marker_cstr_for_signals(&path);
    install_clean_exit_signal_handlers();
    if let Err(e) = fs::write(&path, b"running\n") {
        eprintln!("[STEP] webkit_linux: session_marker_write_fail err={e}");
    }
}

#[cfg(target_os = "linux")]
pub fn end_webkit_session() {
    if let Some(path) = marker_path() {
        let _ = fs::remove_file(path);
    }
    // Clean Exit / tray Quit forgives prior unclean strikes.
    clear_unclean_strikes();
}

/// Apply WebKitGTK workarounds before webview / WebKitWebProcess.
/// Default keeps GPU compositing; compositing-off only after crash escalate.
/// Process-once: `main` and `run` both invoke this; a second pass must not treat
/// the in-process session marker as an unclean prior exit.
#[cfg(target_os = "linux")]
pub fn apply_webkit_graphics_mitigation() {
    if APPLY_DONE_THIS_PROCESS.swap(true, Ordering::SeqCst) {
        eprintln!("[STEP] webkit_linux: apply already done this process — skip (avoid false escalate)");
        return;
    }
    apply_webkit_graphics_mitigation_inner();
}

#[cfg(all(test, target_os = "linux"))]
fn reset_apply_guard_for_tests() {
    APPLY_DONE_THIS_PROCESS.store(false, Ordering::SeqCst);
}

#[cfg(target_os = "linux")]
fn apply_webkit_graphics_mitigation_inner() {
    clear_legacy_full_safe_mode_flag();
    clear_poisoned_double_apply_sticky();
    clear_poisoned_single_unclean_sticky();
    let unclean = recover_unclean_webkit_exit();
    let escalate = unclean || compositing_off_sticky_active();
    let allow_dmabuf = allow_dmabuf_requested();
    let force_dmabuf_only = should_apply_dmabuf_mitigation();

    // SAFETY: process start / single-threaded before WebKit init; edition 2021.
    unsafe {
        if escalate && !allow_dmabuf {
            // Last resort after repeated unclean exits — expect ~1-core software path.
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        } else if force_dmabuf_only {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            std::env::remove_var("WEBKIT_DISABLE_COMPOSITING_MODE");
        } else {
            // Retail fast path: clear .desktop / prior-session poison.
            std::env::remove_var("WEBKIT_DISABLE_DMABUF_RENDERER");
            std::env::remove_var("WEBKIT_DISABLE_COMPOSITING_MODE");
        }
    }
    if escalate && !allow_dmabuf {
        eprintln!(
            "[STEP] webkit_linux: DMABUF=1 + COMPOSITING_MODE=1 (escalate after unclean exit; expect ~1-core software path)"
        );
    } else if force_dmabuf_only {
        eprintln!(
            "[STEP] webkit_linux: WEBKIT_DISABLE_DMABUF_RENDERER=1 (ELITEEW_WEBKIT_FORCE_DMABUF_OFF; GPU compositing kept)"
        );
    } else if allow_dmabuf {
        eprintln!(
            "[STEP] webkit_linux: ELITEEW_WEBKIT_ALLOW_DMABUF — DMA-BUF path kept (cleared DMABUF/COMPOSITING env)"
        );
    } else {
        eprintln!(
            "[STEP] webkit_linux: DMA-BUF path kept (default; no DMABUF-off / no COMPOSITING_MODE)"
        );
    }
    begin_webkit_session();
}

#[cfg(not(target_os = "linux"))]
pub fn apply_webkit_graphics_mitigation() {}

#[cfg(not(target_os = "linux"))]
pub fn end_webkit_session() {}

#[cfg(not(target_os = "linux"))]
pub fn begin_webkit_session() {}

#[cfg(not(target_os = "linux"))]
pub fn recover_unclean_webkit_exit() -> bool {
    false
}

#[cfg(not(target_os = "linux"))]
pub fn mark_compositing_off_sticky() {}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn clear_seat_flags() {
        if let Some(p) = compositing_off_flag_path() {
            let _ = fs::remove_file(p);
        }
        if let Some(p) = marker_path() {
            let _ = fs::remove_file(p);
        }
        clear_unclean_strikes();
        // Allow policy migration to re-run under tests that need sticky clear.
        if let Some(p) = escalate_policy_cleared_path() {
            let _ = fs::remove_file(p);
        }
    }

    #[test]
    fn mitigation_off_by_default() {
        let _g = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::remove_var("ELITEEW_WEBKIT_ALLOW_DMABUF");
            std::env::remove_var("ELITEEW_WEBKIT_FORCE_DMABUF_OFF");
        }
        assert!(!should_apply_dmabuf_mitigation());
    }

    #[test]
    fn force_dmabuf_off_ops_flag() {
        let _g = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::remove_var("ELITEEW_WEBKIT_ALLOW_DMABUF");
            std::env::set_var("ELITEEW_WEBKIT_FORCE_DMABUF_OFF", "1");
        }
        assert!(should_apply_dmabuf_mitigation());
        unsafe {
            std::env::remove_var("ELITEEW_WEBKIT_FORCE_DMABUF_OFF");
        }
    }

    #[test]
    fn allow_dmabuf_wins_over_force() {
        let _g = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::set_var("ELITEEW_WEBKIT_ALLOW_DMABUF", "1");
            std::env::set_var("ELITEEW_WEBKIT_FORCE_DMABUF_OFF", "1");
        }
        assert!(!should_apply_dmabuf_mitigation());
        unsafe {
            std::env::remove_var("ELITEEW_WEBKIT_ALLOW_DMABUF");
            std::env::remove_var("ELITEEW_WEBKIT_FORCE_DMABUF_OFF");
        }
    }

    #[test]
    fn default_keeps_dmabuf_and_compositing() {
        let _g = ENV_LOCK.lock().unwrap();
        reset_apply_guard_for_tests();
        unsafe {
            std::env::remove_var("ELITEEW_WEBKIT_ALLOW_DMABUF");
            std::env::remove_var("ELITEEW_WEBKIT_FORCE_DMABUF_OFF");
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
        clear_seat_flags();
        // Stamp policy migration so it does not race other tests' sticky.
        if let Some(stamp) = escalate_policy_cleared_path() {
            if let Some(parent) = stamp.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&stamp, b"1\n");
        }
        assert!(!should_apply_dmabuf_mitigation());
        apply_webkit_graphics_mitigation();
        assert!(
            std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none(),
            "default must clear DMABUF-off (SHM/readback lag)"
        );
        assert!(
            std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none(),
            "default must not force compositing-off (1-core software lag)"
        );
        end_webkit_session();
    }

    #[test]
    fn single_unclean_exit_keeps_gpu_compositing() {
        let _g = ENV_LOCK.lock().unwrap();
        reset_apply_guard_for_tests();
        unsafe {
            std::env::remove_var("ELITEEW_WEBKIT_ALLOW_DMABUF");
            std::env::remove_var("ELITEEW_WEBKIT_FORCE_DMABUF_OFF");
            std::env::remove_var("WEBKIT_DISABLE_COMPOSITING_MODE");
        }
        clear_seat_flags();
        if let Some(stamp) = escalate_policy_cleared_path() {
            if let Some(parent) = stamp.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&stamp, b"1\n");
        }
        begin_webkit_session(); // leave marker as if Ctrl+C without handler
        // Simulate leftover marker without going through begin's signal install twice:
        // recover path only — leave marker, reset apply, apply again.
        end_webkit_session(); // clears strikes — re-seed marker only
        begin_webkit_session();
        // Tear down end so marker remains (pretend crash): remove strikes clear by
        // only deleting via direct path write after end... Use recover path:
        reset_apply_guard_for_tests();
        // Leave marker without end:
        if let Some(p) = marker_path() {
            let _ = fs::write(&p, b"running\n");
        }
        clear_unclean_strikes();
        apply_webkit_graphics_mitigation();
        assert!(
            std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none(),
            "one leftover marker must not force compositing-off"
        );
        assert!(
            !compositing_off_sticky_active(),
            "one unclean must not write sticky"
        );
        assert_eq!(read_unclean_strikes(), 1);
        end_webkit_session();
    }

    #[test]
    fn repeated_unclean_exit_escalates_compositing_off() {
        let _g = ENV_LOCK.lock().unwrap();
        reset_apply_guard_for_tests();
        unsafe {
            std::env::remove_var("ELITEEW_WEBKIT_ALLOW_DMABUF");
            std::env::remove_var("ELITEEW_WEBKIT_FORCE_DMABUF_OFF");
            std::env::remove_var("WEBKIT_DISABLE_COMPOSITING_MODE");
        }
        clear_seat_flags();
        if let Some(stamp) = escalate_policy_cleared_path() {
            if let Some(parent) = stamp.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&stamp, b"1\n");
        }
        // First unclean
        if let Some(p) = marker_path() {
            let _ = fs::write(&p, b"running\n");
        }
        apply_webkit_graphics_mitigation();
        assert!(std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none());
        // Second unclean without clean Exit (do not call end_webkit_session)
        reset_apply_guard_for_tests();
        if let Some(p) = marker_path() {
            let _ = fs::write(&p, b"running\n");
        }
        unsafe {
            std::env::remove_var("WEBKIT_DISABLE_COMPOSITING_MODE");
        }
        apply_webkit_graphics_mitigation();
        assert_eq!(
            std::env::var("WEBKIT_DISABLE_COMPOSITING_MODE")
                .ok()
                .as_deref(),
            Some("1")
        );
        assert!(compositing_off_sticky_active());
        end_webkit_session();
        clear_seat_flags();
    }

    /// Regression: main()+run() both called apply; second pass saw in-process marker as unclean.
    #[test]
    fn double_apply_does_not_false_escalate() {
        let _g = ENV_LOCK.lock().unwrap();
        reset_apply_guard_for_tests();
        unsafe {
            std::env::remove_var("ELITEEW_WEBKIT_ALLOW_DMABUF");
            std::env::remove_var("ELITEEW_WEBKIT_FORCE_DMABUF_OFF");
            std::env::remove_var("WEBKIT_DISABLE_COMPOSITING_MODE");
        }
        clear_seat_flags();
        if let Some(stamp) = escalate_policy_cleared_path() {
            if let Some(parent) = stamp.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&stamp, b"1\n");
        }
        apply_webkit_graphics_mitigation();
        apply_webkit_graphics_mitigation(); // must be no-op (main+run pattern)
        assert!(
            std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none(),
            "second apply must not escalate on own session marker"
        );
        assert!(
            !compositing_off_sticky_active(),
            "must not write poisoned compositing_off sticky"
        );
        end_webkit_session();
    }

    #[test]
    fn user_recovery_clears_sticky_without_shell() {
        let _g = ENV_LOCK.lock().unwrap();
        clear_seat_flags();
        if let Some(stamp) = escalate_policy_cleared_path() {
            if let Some(parent) = stamp.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&stamp, b"1\n");
        }
        mark_compositing_off_sticky();
        write_unclean_strikes(2);
        unsafe {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
        let before = graphics_recovery_status();
        assert!(before.sticky_compositing_off);
        assert!(before.process_escalated);
        let after = clear_graphics_sticky_for_user_recovery();
        assert!(!after.sticky_compositing_off);
        assert_eq!(after.unclean_strikes, 0);
        // Env still escalated until process restart — status still reports process_escalated.
        assert!(after.process_escalated);
        unsafe {
            std::env::remove_var("WEBKIT_DISABLE_COMPOSITING_MODE");
        }
        clear_seat_flags();
    }
}
