// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Env/runtime gate for FoFline + Connected W-transport (userspace SOCKS).
// Invariants:
// - Bare process without env → disabled (system wg_* path).
// - Shipped retail packages inject ELITEEW_FOFLINE_W_TRANSPORT=1 (.desktop +
//   release binary ensure_*); ops escape hatch =0 restores system WG.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
// ---

/// Process env that enables W-transport commands (start/stop/proxy).
pub const ENV_FOFLINE_W_TRANSPORT: &str = "ELITEEW_FOFLINE_W_TRANSPORT";

fn env_truthy(raw: &str) -> bool {
    let t = raw.trim();
    t == "1"
        || t.eq_ignore_ascii_case("true")
        || t.eq_ignore_ascii_case("on")
        || t.eq_ignore_ascii_case("yes")
}

/// True when `ELITEEW_FOFLINE_W_TRANSPORT` is 1/true/on/yes (case-insensitive).
pub fn w_transport_enabled() -> bool {
    match std::env::var(ENV_FOFLINE_W_TRANSPORT) {
        Ok(v) => env_truthy(&v),
        Err(_) => false,
    }
}

/// Retail release: if env unset, default W-transport ON (FoFline + Connected packages).
/// Respects explicit `=0` / false / off / no. No-op under debug (dev keeps system WG
/// unless operator exports the env).
pub fn ensure_packaged_w_transport_default() {
    if std::env::var_os(ENV_FOFLINE_W_TRANSPORT).is_some() {
        return;
    }
    #[cfg(not(debug_assertions))]
    {
        // SAFETY: process start before concurrent workers (same pattern as updater pubkey).
        unsafe {
            std::env::set_var(ENV_FOFLINE_W_TRANSPORT, "1");
        }
        eprintln!(
            "[STEP] w_transport: {}=1 set from packaged retail default",
            ENV_FOFLINE_W_TRANSPORT
        );
    }
}

/// Serialize env mutations across w-transport-core unit tests (parallel cargo test).
#[cfg(test)]
pub(crate) fn env_test_lock() -> std::sync::MutexGuard<'static, ()> {
    use std::sync::{Mutex, OnceLock};
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_disabled_when_unset() {
        let _g = env_test_lock();
        // Soft check: if operator exported the env in the shell running tests, skip assert.
        if std::env::var_os(ENV_FOFLINE_W_TRANSPORT).is_none() {
            assert!(!w_transport_enabled());
        }
    }

    #[test]
    fn falsy_values_disable() {
        let _g = env_test_lock();
        for v in ["0", "false", "OFF", "No"] {
            // SAFETY: unit test isolation — restore after.
            unsafe {
                std::env::set_var(ENV_FOFLINE_W_TRANSPORT, v);
            }
            assert!(!w_transport_enabled(), "expected disabled for {v}");
            unsafe {
                std::env::remove_var(ENV_FOFLINE_W_TRANSPORT);
            }
        }
    }
}
