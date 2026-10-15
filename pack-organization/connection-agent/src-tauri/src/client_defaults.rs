// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Product defaults from tauri.conf plugins; ops env only where it is not a trust anchor.
// Invariants:
// - Updater / entitlement / metadata / denylist **verify pubkeys are Root of Trust**
//   — conf bake only. Runtime env MUST NOT override (local MitM).
// - REPLACE_WITH / empty conf → unset (fail-closed for OTA; no silent pubkey fallback).
// - Channel / AI endpoint URLs: baked conf only (Wave 5 / F-07; no process-env override).
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §7–8
// ---

use tauri::AppHandle;

use crate::verified_update_plan::{
    expected_package_type_for_platform, latest_v2_url_from_update_endpoint, platform_key_for_host,
    UpdateTrustRoots,
};

const PLUGIN_UPDATER: &str = "updater";
const PLUGIN_ELITEEW: &str = "eliteew-desktop-client";

/// Connected artifact minisign pubkey baked in `tauri.conf.json` (tests / docs only).
/// Runtime OTA never falls back to this when conf is missing — fail closed.
pub const BAKED_UPDATER_PUBKEY_CONNECTED: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDkzQjYwNUI3MzZDNUNEODMKUldTRHpjVTJ0d1cya3h5TmNmV29NYjhTMTJEZVEwTmJaZVh4eWRvb3BtaTUwVko2MnpibGxwOTkK";

/// @deprecated alias — prefer `BAKED_UPDATER_PUBKEY_CONNECTED` (no runtime fallback).
pub const BAKED_UPDATER_PUBKEY_FALLBACK: &str = BAKED_UPDATER_PUBKEY_CONNECTED;

/// Canonical latest.json for Linux RPM recovery when Tauri updater gate is broken.
pub const DEFAULT_LATEST_JSON_URL: &str =
    "https://app.eliteew.ru/desktop-client-updates/latest.json";

/// FoFline packaging profile OTA channel (W4) — separate from vanilla desktop-client.
pub const DEFAULT_FOFLINE_LATEST_JSON_URL: &str =
    "https://app.eliteew.ru/fofline-updates/latest.json";

/// FoFline SPA pack manifest (L2) — separate from shell `latest.json`.
pub const DEFAULT_FOFLINE_SPA_LATEST_JSON_URL: &str =
    "https://app.eliteew.ru/fofline-updates/spa-latest.json";

/// FoFline optional asset groups channel (A2) — sibling of spa-latest.json.
pub const DEFAULT_FOFLINE_SPA_ASSETS_LATEST_JSON_URL: &str =
    "https://app.eliteew.ru/fofline-updates/spa-assets-latest.json";


fn conf_plugin_value<'a>(
    app: &'a AppHandle,
    plugin: &str,
) -> Option<&'a serde_json::Value> {
    app.config().plugins.0.get(plugin)
}

fn conf_string(app: &AppHandle, plugin: &str, key: &str) -> Option<String> {
    conf_plugin_value(app, plugin)?
        .get(key)?
        .as_str()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && !s.contains("REPLACE_WITH"))
}

/// Channel latest endpoint from baked updater plugin endpoints only.
pub fn resolve_update_url(app: &AppHandle) -> Option<String> {
    conf_update_url(app)
}

fn conf_update_url(app: &AppHandle) -> Option<String> {
    let plugin = conf_plugin_value(app, PLUGIN_UPDATER)?;
    let endpoints = plugin.get("endpoints")?.as_array()?;
    for ep in endpoints {
        if let Some(s) = ep.as_str() {
            let t = s.trim();
            if !t.is_empty() && !t.contains("REPLACE_WITH") {
                return Some(t.to_string());
            }
        }
    }
    None
}

/// Derive `…/latest.json` from an updater endpoint template or base URL.
pub fn latest_json_url_from_update_endpoint(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.contains("latest.json") {
        return trimmed.to_string();
    }
    let base = trimmed
        .split("{{")
        .next()
        .unwrap_or(trimmed)
        .trim_end_matches('/');
    if base.ends_with("desktop-client-updates") {
        format!("{base}/latest.json")
    } else if base.ends_with("fofline-updates") {
        format!("{base}/latest.json")
    } else if let Some(idx) = base.find("/desktop-client-updates") {
        let end = idx + "/desktop-client-updates".len();
        format!("{}/latest.json", &base[..end])
    } else if let Some(idx) = base.find("/fofline-updates") {
        let end = idx + "/fofline-updates".len();
        format!("{}/latest.json", &base[..end])
    } else {
        DEFAULT_LATEST_JSON_URL.to_string()
    }
}

/// Trusted updater verify pubkey (Root of Trust): baked conf only — no silent fallback.
/// Never reads process env — env override would let a local launcher swap the OTA trust anchor.
pub fn trusted_updater_pubkey(app: &AppHandle) -> Option<String> {
    trusted_updater_pubkey_from_conf(conf_string(app, PLUGIN_UPDATER, "pubkey"))
}

/// Pure helper for unit tests / call sites without AppHandle.
pub fn trusted_updater_pubkey_from_conf(conf: Option<String>) -> Option<String> {
    conf.filter(|s| !s.is_empty() && !s.contains("REPLACE_WITH") && s.starts_with("dW50cnVzdGVk"))
}

/// Updater verify pubkey for OTA / SPA / asset groups — None when bake is incomplete.
pub fn resolve_updater_pubkey(app: &AppHandle) -> Option<String> {
    trusted_updater_pubkey(app)
}

/// Privileged recovery trust anchor — same Root of Trust as retail verify (no env path).
#[allow(dead_code)] // retained for SPA/recovery call sites that still prefer the alias
pub fn resolve_recovery_updater_pubkey(app: &AppHandle) -> Option<String> {
    trusted_updater_pubkey(app)
}

/// Prefer FoFline shell channel when the app identifier is FoFline (fail-closed recovery).
fn default_shell_latest_json_url(app: &AppHandle) -> &'static str {
    if app.config().identifier.contains("fofline") {
        DEFAULT_FOFLINE_LATEST_JSON_URL
    } else {
        DEFAULT_LATEST_JSON_URL
    }
}

/// Privileged recovery source: baked endpoint/profile only, never runtime env.
pub fn resolve_recovery_latest_json_url(app: &AppHandle) -> String {
    conf_update_url(app)
        .map(|url| latest_json_url_from_update_endpoint(&url))
        .unwrap_or_else(|| default_shell_latest_json_url(app).to_string())
}

/// Signed metadata v2 URL for VerifiedUpdatePlan (Wave 8).
pub fn resolve_recovery_latest_v2_url(app: &AppHandle) -> String {
    conf_update_url(app)
        .map(|url| latest_v2_url_from_update_endpoint(&url))
        .unwrap_or_else(|| {
            latest_v2_url_from_update_endpoint(default_shell_latest_json_url(app))
        })
}

fn conf_eliteew_string(app: &AppHandle, key: &str) -> Option<String> {
    conf_string(app, PLUGIN_ELITEEW, key)
}

fn default_product_id(app: &AppHandle) -> String {
    app.config().identifier.clone()
}

fn default_channel(app: &AppHandle) -> &'static str {
    if app.config().identifier.contains("fofline") {
        "fofline"
    } else {
        "connected"
    }
}

fn default_package_id(app: &AppHandle) -> &'static str {
    if app.config().identifier.contains("fofline") {
        "elite-ew-fo-fline"
    } else {
        "elite-ew-desktop-client"
    }
}

/// Wave 8 product trust roots from bake — missing metadata/artifact keys → None.
pub fn resolve_update_trust_roots(app: &AppHandle) -> Option<UpdateTrustRoots> {
    let artifact_pubkey = trusted_updater_pubkey(app)?;
    let metadata_pubkey_hex = conf_eliteew_string(app, "metadata_pubkey_hex")?;
    let metadata_key_id = conf_eliteew_string(app, "metadata_key_id")?;
    let artifact_key_id = conf_eliteew_string(app, "artifact_key_id")?;
    let product_id = conf_eliteew_string(app, "product_id").unwrap_or_else(|| default_product_id(app));
    let channel = conf_eliteew_string(app, "channel").unwrap_or_else(|| default_channel(app).to_string());
    let package_id =
        conf_eliteew_string(app, "package_id").unwrap_or_else(|| default_package_id(app).to_string());
    let platform = platform_key_for_host().ok()?;
    let expected_package_type = conf_eliteew_string(app, "package_type")
        .unwrap_or_else(|| expected_package_type_for_platform(platform).to_string());
    Some(UpdateTrustRoots {
        product_id,
        channel,
        package_id,
        expected_package_type,
        artifact_pubkey,
        artifact_key_id,
        next_artifact_key_id: conf_eliteew_string(app, "next_artifact_key_id"),
        next_artifact_pubkey: conf_eliteew_string(app, "next_artifact_pubkey"),
        metadata_key_id,
        metadata_pubkey_hex,
        next_metadata_key_id: conf_eliteew_string(app, "next_metadata_key_id"),
        next_metadata_pubkey_hex: conf_eliteew_string(app, "next_metadata_pubkey_hex"),
    })
}

/// Derive `…/spa-latest.json` from a FoFline updater endpoint or shell latest URL.
///
/// SPA pack artifacts live **only** under `/fofline-updates/`. Vanilla Desktop
/// Client updater endpoints point at `/desktop-client-updates/` — rewriting those
/// to `…/spa-latest.json` yields HTTP 404 and sync_failed in the launcher.
pub fn spa_latest_json_url_from_fofline_channel(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.contains("spa-latest.json") {
        return trimmed.to_string();
    }
    let shell_latest = latest_json_url_from_update_endpoint(trimmed);
    let on_fofline_channel = shell_latest.contains("/fofline-updates")
        || trimmed.contains("fofline-updates");
    if !on_fofline_channel {
        return DEFAULT_FOFLINE_SPA_LATEST_JSON_URL.to_string();
    }
    if let Some(base) = shell_latest.strip_suffix("/latest.json") {
        return format!("{base}/spa-latest.json");
    }
    if let Some(idx) = shell_latest.find("/fofline-updates") {
        let end = idx + "/fofline-updates".len();
        return format!("{}/spa-latest.json", &shell_latest[..end]);
    }
    DEFAULT_FOFLINE_SPA_LATEST_JSON_URL.to_string()
}

/// spa-latest.json URL for FoFline SPA pack sync (L2).
pub fn resolve_spa_latest_json_url(app: &AppHandle) -> String {
    resolve_update_url(app)
        .map(|u| spa_latest_json_url_from_fofline_channel(&u))
        .unwrap_or_else(|| DEFAULT_FOFLINE_SPA_LATEST_JSON_URL.to_string())
}

/// Derive `…/spa-assets-latest.json` beside spa-latest on the FoFline channel.
pub fn spa_assets_latest_json_url_from_spa_latest(spa_latest: &str) -> String {
    let trimmed = spa_latest.trim();
    if trimmed.contains("spa-assets-latest.json") {
        return trimmed.to_string();
    }
    if let Some(base) = trimmed.strip_suffix("/spa-latest.json") {
        return format!("{base}/spa-assets-latest.json");
    }
    if let Some(idx) = trimmed.find("/fofline-updates") {
        let end = idx + "/fofline-updates".len();
        return format!("{}/spa-assets-latest.json", &trimmed[..end]);
    }
    DEFAULT_FOFLINE_SPA_ASSETS_LATEST_JSON_URL.to_string()
}

/// spa-assets-latest.json URL for optional group sync (A2).
pub fn resolve_spa_assets_latest_json_url(app: &AppHandle) -> String {
    spa_assets_latest_json_url_from_spa_latest(&resolve_spa_latest_json_url(app))
}

/// Entitlement verify pubkey (hex): baked conf only (Root of Trust — never env).
pub fn resolve_entitlement_pubkey_hex(app: &AppHandle) -> Option<String> {
    conf_string(app, PLUGIN_ELITEEW, "entitlement_pubkey_hex")
}

/// Denylist verify pubkey (hex): dedicated role key (Wave 8) — never reuse entitlement seed.
pub fn resolve_denylist_pubkey_hex(app: &AppHandle) -> Option<String> {
    conf_string(app, PLUGIN_ELITEEW, "denylist_pubkey_hex")
}

/// Local OpenAI-compat base URL (O3c): baked conf only.
pub fn resolve_ai_local_base_url(app: &AppHandle) -> Option<String> {
    conf_string(app, PLUGIN_ELITEEW, "ai_local_base_url")
}

/// Local model id (O3c): baked conf only (may be empty → UI override).
pub fn resolve_ai_local_model(app: &AppHandle) -> Option<String> {
    conf_string(app, PLUGIN_ELITEEW, "ai_local_model")
}

/// EliteEW platform LLM base (O3e): baked conf only (empty by default — no public bake).
pub fn resolve_ai_eliteew_base_url(app: &AppHandle) -> Option<String> {
    conf_string(app, PLUGIN_ELITEEW, "ai_eliteew_base_url")
}

/// EliteEW platform model id (O3e): baked conf only.
pub fn resolve_ai_eliteew_model(app: &AppHandle) -> Option<String> {
    conf_string(app, PLUGIN_ELITEEW, "ai_eliteew_model")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn channel_resolvers_are_conf_only() {
        let src = include_str!("client_defaults.rs");
        // Build needles at runtime so include_str self-check is not a false positive.
        let helper = format!("fn {}", "env_nonempty");
        let env_lookup = format!("{}::{}", "env", "var");
        assert!(
            !src.contains(&helper),
            "process-env channel helper must be removed from retail resolution"
        );
        assert!(
            !src.contains(&env_lookup),
            "retail channel/AI URL resolution must not call process env"
        );
        assert!(src.contains("pub fn resolve_update_url"));
        assert!(src.contains("conf_update_url(app)"));
    }

    #[test]
    fn latest_json_from_template_endpoint() {
        let u = latest_json_url_from_update_endpoint(
            "https://app.eliteew.ru/desktop-client-updates/{{target}}/{{arch}}/{{current_version}}",
        );
        assert_eq!(
            u,
            "https://app.eliteew.ru/desktop-client-updates/latest.json"
        );
    }

    #[test]
    fn latest_json_from_fofline_channel() {
        let u = latest_json_url_from_update_endpoint(
            "https://app.eliteew.ru/fofline-updates/{{target}}/{{arch}}/{{current_version}}",
        );
        assert_eq!(u, "https://app.eliteew.ru/fofline-updates/latest.json");
    }

    #[test]
    fn spa_latest_from_fofline_channel() {
        let u = spa_latest_json_url_from_fofline_channel(
            "https://app.eliteew.ru/fofline-updates/{{target}}/{{arch}}/{{current_version}}",
        );
        assert_eq!(u, "https://app.eliteew.ru/fofline-updates/spa-latest.json");
        let already = spa_latest_json_url_from_fofline_channel(
            "https://app.eliteew.ru/fofline-updates/spa-latest.json",
        );
        assert_eq!(already, "https://app.eliteew.ru/fofline-updates/spa-latest.json");
    }

    #[test]
    fn spa_assets_latest_beside_spa_latest() {
        let u = spa_assets_latest_json_url_from_spa_latest(
            "https://app.eliteew.ru/fofline-updates/spa-latest.json",
        );
        assert_eq!(
            u,
            "https://app.eliteew.ru/fofline-updates/spa-assets-latest.json"
        );
    }

    #[test]
    fn spa_latest_never_derived_from_desktop_client_channel() {
        let u = spa_latest_json_url_from_fofline_channel(
            "https://app.eliteew.ru/desktop-client-updates/{{target}}/{{arch}}/{{current_version}}",
        );
        assert_eq!(u, DEFAULT_FOFLINE_SPA_LATEST_JSON_URL);
        assert!(
            !u.contains("desktop-client-updates"),
            "SPA pack must not look under desktop-client-updates (404)"
        );
    }

    #[test]
    fn connected_pubkey_constant_is_minisign_shaped() {
        assert!(BAKED_UPDATER_PUBKEY_CONNECTED.starts_with("dW50cnVzdGVk"));
        assert!(!BAKED_UPDATER_PUBKEY_CONNECTED.contains("REPLACE_WITH"));
    }

    #[test]
    fn trusted_pubkey_fail_closed_on_replace_with_and_empty_conf() {
        assert_eq!(trusted_updater_pubkey_from_conf(None), None);
        assert_eq!(trusted_updater_pubkey_from_conf(Some(String::new())), None);
        assert_eq!(
            trusted_updater_pubkey_from_conf(Some("REPLACE_WITH_UPDATER_PUBKEY".into())),
            None
        );
        let real = BAKED_UPDATER_PUBKEY_CONNECTED.to_string();
        assert_eq!(
            trusted_updater_pubkey_from_conf(Some(real.clone())),
            Some(real)
        );
    }

    #[test]
    fn env_updater_pubkey_is_not_a_trust_path() {
        let src = include_str!("client_defaults.rs");
        let helper = format!("fn {}", "env_nonempty");
        let env_lookup = format!("{}::{}", "env", "var");
        assert!(
            src.contains("trusted_updater_pubkey") && !src.contains(&helper),
            "updater pubkey must stay baked; no process-env channel helper"
        );
        assert!(
            !src.contains(&env_lookup),
            "pubkey path must not read process env"
        );
    }
}
