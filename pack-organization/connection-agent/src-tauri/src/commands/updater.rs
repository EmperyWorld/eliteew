// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wave 8 / F-12 — OTA check + install via VerifiedUpdatePlan (signed latest.v2).
// Invariants:
// - Fail-closed without update URL + resolve_update_trust_roots (signing_required).
// - Availability is decided only from verify_latest_v2 — never unsigned latest.json.
// - HTTP via fofline_native_http_client (SOCKS fail-closed when W-transport on).
// - Install always delegates to updater_recovery_install_inner (unified trust path).
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §8
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// ---

use crate::action_tickets::ActionTickets;
use crate::caller_context::require_main_window;
use crate::client_defaults;
use crate::error::StubResult;
use crate::fofline_egress::fofline_native_http_client;
use crate::verified_update_plan::{
    adopt_live_sequence_when_current, load_sequence_trust, platform_key_for_host, verify_latest_v2,
    PlanError, UpdateTrustRoots,
};
use semver::Version;
use serde::Serialize;
use tauri::{AppHandle, Manager, State, Window};

#[derive(Debug, Clone, Serialize)]
pub struct UpdaterCheckView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_version: Option<String>,
}

fn is_network_updater_error(msg: &str) -> bool {
    let lower = msg.to_lowercase();
    lower.contains("dns")
        || lower.contains("connection")
        || lower.contains("timed out")
        || lower.contains("timeout")
        || lower.contains("network")
        || lower.contains("unreachable")
        || lower.contains("offline")
        || lower.contains("error sending request")
}

fn required_platform_key() -> Result<&'static str, String> {
    platform_key_for_host().map_err(|e| e.code().to_string())
}

/// Pure semver/platform helper for unit tests — not a trust path.
fn manifest_update_version(
    doc: &serde_json::Value,
    current: &str,
) -> Result<Option<String>, String> {
    let remote = doc
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if remote.is_empty() {
        return Err("ota_manifest_version_missing".into());
    }
    let platform = required_platform_key()?;
    let platforms = doc
        .get("platforms")
        .and_then(|p| p.as_object())
        .ok_or_else(|| "ota_manifest_platforms_invalid".to_string())?;
    if !platforms.contains_key(platform) {
        return Err(format!("ota_manifest_platform_missing:{platform}"));
    }
    let current_version =
        Version::parse(current).map_err(|_| "ota_current_version_invalid".to_string())?;
    let remote_version =
        Version::parse(remote).map_err(|_| "ota_manifest_version_invalid".to_string())?;
    if remote_version <= current_version {
        return Ok(None);
    }
    Ok(Some(remote.to_string()))
}

fn gate_trust(app: &AppHandle) -> Result<UpdateTrustRoots, UpdaterCheckView> {
    match (
        client_defaults::resolve_update_url(app),
        client_defaults::resolve_update_trust_roots(app),
    ) {
        (None, _) => Err(UpdaterCheckView {
            ok: false,
            code: "not_configured".into(),
            message: "OTA channel unset — bake plugins.updater.endpoints in release conf"
                .into(),
            current_version: None,
            available_version: None,
        }),
        (Some(_), None) => Err(UpdaterCheckView {
            ok: false,
            code: "signing_required".into(),
            message: "Update trust roots incomplete — bake metadata/artifact keys under plugins.eliteew-desktop-client"
                .into(),
            current_version: None,
            available_version: None,
        }),
        (Some(_), Some(roots)) => Ok(roots),
    }
}

fn plan_error_to_view(err: PlanError, current: &str) -> UpdaterCheckView {
    let ok = matches!(err, PlanError::NotNewer);
    UpdaterCheckView {
        ok,
        code: err.code().into(),
        message: err.message(),
        current_version: Some(current.to_string()),
        available_version: None,
    }
}

/// Primary (and only) check path: signed latest.v2 → VerifiedUpdatePlan.
async fn check_via_verified_v2(
    app: &AppHandle,
    roots: &UpdateTrustRoots,
    current: &str,
) -> Result<UpdaterCheckView, String> {
    let latest_url = client_defaults::resolve_recovery_latest_v2_url(app);
    let client = fofline_native_http_client(45)?;
    let resp = client
        .get(&latest_url)
        .send()
        .await
        .map_err(|e| format!("ota_manifest_fetch: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("ota_manifest_http_{}", resp.status().as_u16()));
    }
    let body = resp
        .text()
        .await
        .map_err(|e| format!("ota_manifest_body: {e}"))?;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    let trust = load_sequence_trust(&app_data);
    let platform = platform_key_for_host().map_err(|e| e.code().to_string())?;
    match verify_latest_v2(&body, roots, platform, current, &trust) {
        Ok(plan) => Ok(UpdaterCheckView {
            ok: true,
            code: "update_available".into(),
            message: format!("Update {} available (current {})", plan.version, current),
            current_version: Some(current.to_string()),
            available_version: Some(plan.version),
        }),
        Err(err) => {
            if matches!(err, PlanError::NotNewer) {
                adopt_live_sequence_when_current(&app_data, &body, platform, current, &trust);
            }
            Ok(plan_error_to_view(err, current))
        }
    }
}

#[tauri::command]
pub async fn updater_check(
    app: AppHandle,
    window: Window,
    tickets: State<'_, ActionTickets>,
) -> Result<UpdaterCheckView, String> {
    require_main_window(&window)?;
    tickets.clear_update_ticket()?;
    let view = updater_check_inner(app).await?;
    if view.code == "update_available" {
        let version = view
            .available_version
            .as_deref()
            .ok_or_else(|| "update_version_missing".to_string())?;
        let _ = tickets.issue_update_ticket(version)?;
    }
    Ok(view)
}

async fn updater_check_inner(app: AppHandle) -> Result<UpdaterCheckView, String> {
    let roots = match gate_trust(&app) {
        Ok(v) => v,
        Err(view) => return Ok(view),
    };
    let current = app.package_info().version.to_string();

    // Wave 8: always verified latest.v2 (no unsigned latest.json / stock updater check).
    match check_via_verified_v2(&app, &roots, &current).await {
        Ok(view) => Ok(view),
        Err(err) => {
            eprintln!("[STEP] updater_check_v2_fail err={err}");
            let code = if is_network_updater_error(&err) {
                "offline_skip"
            } else {
                "check_failed"
            };
            Ok(UpdaterCheckView {
                ok: false,
                code: code.into(),
                message: err,
                current_version: Some(current),
                available_version: None,
            })
        }
    }
}

#[tauri::command]
pub async fn updater_install(
    app: AppHandle,
    window: Window,
    tickets: State<'_, ActionTickets>,
) -> Result<StubResult, String> {
    require_main_window(&window)?;
    let ticket = tickets.consume_update_ticket()?;
    let result = updater_install_inner(app, &ticket.version).await?;
    if result.ok && result.code == "installed" {
        tickets.issue_restart_ticket("update_installed")?;
    }
    Ok(result)
}

async fn updater_install_inner(
    app: AppHandle,
    expected_version: &str,
) -> Result<StubResult, String> {
    // Wave 8: stock tauri-plugin-updater install retired — unified VerifiedUpdatePlan
    // recovery path (minisign + size/sha256 + package_id + elevation).
    crate::commands::updater_recovery::updater_recovery_install_inner(app, expected_version).await
}

/// Pure gate helper for unit tests (no AppHandle).
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn manifest_rejects_same_or_older_version() {
        let platform = required_platform_key().unwrap();
        let same = json!({"version": "0.4.33", "platforms": {(platform): {"url": "x"}}});
        assert_eq!(manifest_update_version(&same, "0.4.33").unwrap(), None);
        let older = json!({"version": "0.4.32", "platforms": {(platform): {"url": "x"}}});
        assert_eq!(manifest_update_version(&older, "0.4.33").unwrap(), None);
    }

    #[test]
    fn manifest_requires_current_platform_and_newer_version() {
        let missing = json!({"version": "0.4.34", "platforms": {"other": {"url": "x"}}});
        assert!(manifest_update_version(&missing, "0.4.33")
            .unwrap_err()
            .starts_with("ota_manifest_platform_missing:"));
        let platform = required_platform_key().unwrap();
        let newer = json!({"version": "0.4.34", "platforms": {(platform): {"url": "x"}}});
        assert_eq!(
            manifest_update_version(&newer, "0.4.33").unwrap(),
            Some("0.4.34".into())
        );
    }

    #[test]
    fn check_path_source_never_trusts_unsigned_latest_json() {
        let src = include_str!("updater.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(
            prod.contains("verify_latest_v2") && prod.contains("resolve_update_trust_roots"),
            "check must use VerifiedUpdatePlan roots"
        );
        assert!(
            !prod.contains("check_via_fofline_latest_json"),
            "unsigned latest.json check path must stay retired"
        );
        assert!(
            prod.contains("updater_recovery_install_inner"),
            "install must unify on recovery VerifiedUpdatePlan path"
        );
        assert!(
            !prod.contains("UpdaterExt") && !prod.contains("updater_builder"),
            "stock tauri-plugin-updater check/install must not drive availability"
        );
    }

    #[test]
    fn plan_error_not_newer_is_up_to_date_ok() {
        let view = plan_error_to_view(PlanError::NotNewer, "0.4.46");
        assert!(view.ok);
        assert_eq!(view.code, "up_to_date");
    }

    #[test]
    fn plan_error_expired_is_not_ok() {
        let view = plan_error_to_view(PlanError::Expired, "0.4.46");
        assert!(!view.ok);
        assert_eq!(view.code, "ota_metadata_expired");
    }
}
