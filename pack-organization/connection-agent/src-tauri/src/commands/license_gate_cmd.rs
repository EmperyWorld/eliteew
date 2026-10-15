// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri IPC for license preflight/heartbeat over native egress (SOCKS when W-transport on).
// Invariants:
// - WebView fetch must not be the only path for Start gate checks.
// - Same wire shape as /api/v1/desktop-client/license/preflight|heartbeat.
// - Main capability must allow these commands; product WebView must not.
// Related:
// - crate::license_gate
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
// ---

use serde::Serialize;
use tauri::{AppHandle, Window};

use crate::caller_context::require_main_window;
use crate::license_gate;

#[derive(Debug, Serialize)]
pub struct LicenseGateCmdView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_online: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_fofline: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_offline: Option<bool>,
}

fn to_view(v: license_gate::LicenseGateView) -> LicenseGateCmdView {
    LicenseGateCmdView {
        ok: v.ok,
        code: v.code,
        message: v.message,
        expires_at: v.expires_at,
        allow_online: v.allow_online,
        allow_fofline: v.allow_fofline,
        allow_offline: v.allow_offline,
    }
}

#[tauri::command]
pub async fn license_preflight_cmd(
    _app: AppHandle,
    window: Window,
    license_id: String,
    device_id: Option<String>,
    machine_fingerprint: Option<String>,
) -> Result<LicenseGateCmdView, String> {
    require_main_window(&window)?;
    Ok(to_view(
        license_gate::license_gate_post(
            "preflight",
            &license_id,
            device_id.as_deref(),
            machine_fingerprint.as_deref(),
        )
        .await,
    ))
}

#[tauri::command]
pub async fn license_heartbeat_cmd(
    _app: AppHandle,
    window: Window,
    license_id: String,
    device_id: Option<String>,
    machine_fingerprint: Option<String>,
) -> Result<LicenseGateCmdView, String> {
    require_main_window(&window)?;
    Ok(to_view(
        license_gate::license_gate_post(
            "heartbeat",
            &license_id,
            device_id.as_deref(),
            machine_fingerprint.as_deref(),
        )
        .await,
    ))
}

#[cfg(test)]
mod tests {
    #[test]
    fn main_capability_allows_license_gate_ipc() {
        let main = include_str!("../../capabilities/default.json");
        assert!(
            main.contains("allow-license-preflight-cmd"),
            "Hub Start dies if main ACL omits license_preflight_cmd"
        );
        assert!(
            main.contains("allow-license-heartbeat-cmd"),
            "kill-switch heartbeat needs main ACL"
        );
    }

    #[test]
    fn product_webview_cannot_call_license_gate_ipc() {
        let product = include_str!("../../capabilities/product.json");
        assert!(!product.contains("license-preflight"));
        assert!(!product.contains("license-heartbeat"));
    }
}
