// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Native license/preflight before product_open — IPC cannot skip server revoke/expiry.
// Invariants:
// - Uses baked product origin (same default as FE enrollBase).
// - HTTP via fofline_native_http_client (W-transport SOCKS when enabled).
// - Fail-closed on network / non-ok / missing license_id.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
// ---

use serde::Deserialize;
use serde::Serialize;
use serde_json::json;

use crate::commands::product::BAKED_PRODUCT_APP_ORIGIN;
use crate::fofline_egress::fofline_native_http_client;

#[derive(Debug, Serialize)]
pub struct LicenseGateView {
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

#[derive(Debug, Deserialize)]
struct PreflightBody {
    #[serde(default)]
    ok: Option<bool>,
    #[serde(default)]
    code: Option<String>,
    #[serde(default)]
    expires_at: Option<String>,
    #[serde(default)]
    allow_online: Option<bool>,
    #[serde(default)]
    allow_fofline: Option<bool>,
    #[serde(default)]
    allow_offline: Option<bool>,
    #[serde(default)]
    detail: Option<serde_json::Value>,
}

fn detail_code(detail: &Option<serde_json::Value>) -> Option<String> {
    detail.as_ref().and_then(|d| {
        d.get("code")
            .and_then(|c| c.as_str())
            .map(|s| s.to_string())
    })
}

fn humanize_code(code: &str) -> String {
    match code {
        "license_expired" => "Срок лицензии истёк".into(),
        "license_revoked" => "Доступ отозван".into(),
        "device_revoked" => "Устройство отозвано".into(),
        "device_required" => "Нужна привязка устройства".into(),
        "fingerprint_required" | "device_conflict" => {
            "Устройство не совпадает с лицензией".into()
        }
        "not_found" => "Лицензия не найдена".into(),
        "w_transport_proxy_required" => {
            "Защищённый канал не подключён. Импортируйте файл доступа на экране активации и дождитесь подтверждения канала, затем повторите.".into()
        }
        "network_error" => "Нужна проверка лицензии — нет связи с сервером".into(),
        _ => "Проверка лицензии не пройдена".into(),
    }
}

fn deny(code: &str) -> LicenseGateView {
    LicenseGateView {
        ok: false,
        code: code.to_string(),
        message: humanize_code(code),
        expires_at: None,
        allow_online: None,
        allow_fofline: None,
        allow_offline: None,
    }
}

/// POST license preflight or heartbeat via native egress (SOCKS when tunnel active).
pub async fn license_gate_post(
    path: &str,
    license_id: &str,
    device_id: Option<&str>,
    machine_fingerprint: Option<&str>,
) -> LicenseGateView {
    let lic = license_id.trim();
    if lic.is_empty() {
        return deny("license_required");
    }
    let path_n = path.trim();
    if path_n != "preflight" && path_n != "heartbeat" {
        return deny("invalid_gate_path");
    }
    let base = BAKED_PRODUCT_APP_ORIGIN.trim_end_matches('/');
    let url = format!("{base}/api/v1/desktop-client/license/{path_n}");
    let client = match fofline_native_http_client(45) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[STEP] license_gate_{path_n}_http_client_fail err={e}");
            if e.starts_with("w_transport_proxy_required") {
                return deny("w_transport_proxy_required");
            }
            return deny("network_error");
        }
    };
    let body = json!({
        "license_id": lic,
        "device_id": device_id.map(str::trim).filter(|s| !s.is_empty()),
        "machine_fingerprint": machine_fingerprint
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    });
    let resp = match client.post(&url).json(&body).send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[STEP] license_gate_{path_n}_network_fail err={e}");
            return deny("network_error");
        }
    };
    let status = resp.status();
    let parsed: PreflightBody = resp.json().await.unwrap_or(PreflightBody {
        ok: None,
        code: None,
        expires_at: None,
        allow_online: None,
        allow_fofline: None,
        allow_offline: None,
        detail: None,
    });
    if !status.is_success() {
        let code = detail_code(&parsed.detail)
            .or(parsed.code)
            .unwrap_or_else(|| format!("http_{}", status.as_u16()));
        eprintln!(
            "[STEP] license_gate_{path_n}_deny code={code} http={}",
            status.as_u16()
        );
        return deny(&code);
    }
    if parsed.ok != Some(true) {
        let code = parsed.code.unwrap_or_else(|| "license_denied".into());
        eprintln!("[STEP] license_gate_{path_n}_deny code={code}");
        return deny(&code);
    }
    eprintln!("[STEP] license_gate_{path_n}_ok license_id={lic}");
    LicenseGateView {
        ok: true,
        code: "ok".into(),
        message: String::new(),
        expires_at: parsed.expires_at,
        allow_online: parsed.allow_online,
        allow_fofline: parsed.allow_fofline,
        allow_offline: parsed.allow_offline,
    }
}

/// Server preflight before opening a product WebView (Full Security).
pub async fn server_preflight(
    license_id: &str,
    device_id: Option<&str>,
    machine_fingerprint: Option<&str>,
) -> Result<(), (String, String)> {
    let view = license_gate_post("preflight", license_id, device_id, machine_fingerprint).await;
    if view.ok {
        Ok(())
    } else {
        Err((view.code, view.message))
    }
}

#[cfg(test)]
mod tests {
    use super::humanize_code;

    #[test]
    fn humanize_expired() {
        assert!(humanize_code("license_expired").contains("истёк"));
    }

    #[test]
    fn humanize_w_transport_proxy_required() {
        assert!(humanize_code("w_transport_proxy_required").contains("Защищённый канал"));
    }
}
