// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wave K2–K5 + Wave 6: open presentation_url Kernel-offline mounts from shared policy SoT.
// Invariants:
// - Fail-closed unless policy mode=presentation_url; Rust builds URL (no caller URL IPC).
// - Shared navigation policy on kernel WebviewWindow builders.
// - Does not claim full SPA Kernel offline Done.
// Related:
// - shared/packages/kernel-offline-policy/src/kernelOfflineMounts.policy.json
// - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
// ---

use serde::Deserialize;
use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::commands::product::BAKED_PRODUCT_APP_ORIGIN;
use crate::fofline_egress::navigation_allowed_for_kernel_offline;

const POLICY_JSON: &str =
    include_str!("../../../../../shared/packages/kernel-offline-policy/src/kernelOfflineMounts.policy.json");

#[derive(Debug, Deserialize)]
struct PolicyFile {
    mounts: std::collections::HashMap<String, PolicyMount>,
}

#[derive(Debug, Clone, Deserialize)]
struct PolicyMount {
    mode: String,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    window_title: Option<String>,
    #[serde(default)]
    spa_deep_link: bool,
}

fn load_policy() -> Result<PolicyFile, String> {
    serde_json::from_str(POLICY_JSON).map_err(|e| format!("kernel offline policy: {e}"))
}

/// True when policy lists this component as presentation_url.
pub fn is_presentation_url_mount(app_component: &str) -> bool {
    let Ok(policy) = load_policy() else {
        return false;
    };
    policy
        .mounts
        .get(app_component.trim())
        .is_some_and(|m| m.mode == "presentation_url")
}

/// True when policy allows spa_deep_link cloud open for this app id.
pub fn is_spa_deep_link_mount(app_id: &str) -> bool {
    let Ok(policy) = load_policy() else {
        return false;
    };
    policy
        .mounts
        .get(app_id.trim())
        .is_some_and(|m| m.spa_deep_link)
}

fn expected_path(app_component: &str) -> Option<String> {
    let policy = load_policy().ok()?;
    let m = policy.mounts.get(app_component.trim())?;
    if m.mode != "presentation_url" {
        return None;
    }
    m.path.clone()
}

fn window_title(app_component: &str) -> String {
    load_policy()
        .ok()
        .and_then(|p| p.mounts.get(app_component.trim()).cloned())
        .and_then(|m| m.window_title)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "EliteEW".to_string())
}

fn build_mount_url(app_component: &str) -> Result<url::Url, String> {
    let Some(path) = expected_path(app_component) else {
        return Err("mount_not_allowlisted".into());
    };
    let base: url::Url = BAKED_PRODUCT_APP_ORIGIN
        .parse()
        .map_err(|e| format!("baked product origin invalid: {e}"))?;
    base.join(path.trim_start_matches('/'))
        .map_err(|e| format!("mount URL join: {e}"))
}

#[derive(Debug, Serialize)]
pub struct KernelOfflineOpenResult {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_component: Option<String>,
}

#[tauri::command]
pub fn kernel_offline_open_mount(
    app: AppHandle,
    app_component: String,
) -> Result<KernelOfflineOpenResult, String> {
    let component = app_component.trim().to_string();
    if !is_presentation_url_mount(&component) {
        return Ok(KernelOfflineOpenResult {
            ok: false,
            code: "mount_not_allowlisted".into(),
            message: format!(
                "Kernel offline mount not presentation_url in policy: {component}"
            ),
            url: "".into(),
            app_component: Some(component),
        });
    }

    let parsed = match build_mount_url(&component) {
        Ok(u) => u,
        Err(_) => {
            return Ok(KernelOfflineOpenResult {
                ok: false,
                code: "mount_not_allowlisted".into(),
                message: format!(
                    "Kernel offline mount missing path in policy: {component}"
                ),
                url: "".into(),
                app_component: Some(component),
            });
        }
    };
    let trimmed = parsed.as_str().to_string();

    let label = format!("kernel-offline-{component}");
    let title = window_title(&component);
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.set_focus();
        return Ok(KernelOfflineOpenResult {
            ok: true,
            code: "focused".into(),
            message: "Kernel offline mount window already open".into(),
            url: trimmed,
            app_component: Some(component),
        });
    }

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed))
        .title(title)
        .inner_size(1100.0, 780.0)
        .on_navigation(|nav_url| navigation_allowed_for_kernel_offline(nav_url))
        .build()
        .map_err(|e| format!("create kernel offline window: {e}"))?;

    Ok(KernelOfflineOpenResult {
        ok: true,
        code: "opened".into(),
        message: "Kernel offline mount WebviewWindow opened".into(),
        url: trimmed,
        app_component: Some(component),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn policy_marks_project_about_presentation() {
        assert!(is_presentation_url_mount("ProjectAboutApp"));
        assert!(!is_presentation_url_mount("ClipboardManager"));
        assert_eq!(
            expected_path("ProjectAboutApp").as_deref(),
            Some("/o-proekte/index.html")
        );
    }

    #[test]
    fn spa_deep_link_flags() {
        assert!(is_spa_deep_link_mount("ClipboardManager"));
        assert!(is_spa_deep_link_mount("MusicPlayer"));
        assert!(!is_spa_deep_link_mount("ProjectAboutApp"));
    }

    #[test]
    fn build_mount_uses_baked_origin() {
        let u = build_mount_url("ProjectAboutApp").unwrap();
        assert_eq!(u.as_str(), "https://app.eliteew.ru/o-proekte/index.html");
    }

    #[test]
    fn policy_loads_all_pack_mounts() {
        let policy = load_policy().expect("policy json");
        for id in [
            "ProjectAboutApp",
            "ClipboardManager",
            "NotificationsApp",
            "MusicPlayer",
        ] {
            assert!(policy.mounts.contains_key(id), "missing {id}");
        }
    }
}
