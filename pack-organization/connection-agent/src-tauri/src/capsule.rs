// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Legacy Capsule v1 surface — detection helpers only; open path is retired.
// Invariants:
// - open_capsule_json never decrypts; always returns capsule_v1_retired.
// - No shared recipient SK (env / option_env / DEV) in this module.
// - Capsule v2 open lives in crate::capsule_v2 with per-device keyring SK.
// Related:
// - crate::capsule_v2
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §4
// ---

use serde_json::Value;

const CAPSULE_KIND: &str = "eliteew_desktop_capsule";

/// Legacy open path — Capsule v1 is retired (use Capsule v2 + device keyring).
pub fn open_capsule_json(_raw: &str) -> Result<String, String> {
    Err("capsule_v1_retired".into())
}

pub fn looks_like_capsule_json(raw: &str) -> bool {
    let t = raw.trim();
    if !t.starts_with('{') {
        return false;
    }
    serde_json::from_str::<Value>(t)
        .ok()
        .and_then(|v| {
            v.get("kind")
                .and_then(|k| k.as_str())
                .map(|s| s == CAPSULE_KIND)
        })
        .unwrap_or(false)
}
