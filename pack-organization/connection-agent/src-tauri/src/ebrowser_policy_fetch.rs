// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Fetch EBrowser nav policy from stack0 API into Rust SoT (not SPA snapshot).
// Invariants:
// - Bearer from session_cache preferred; SPA bearer is fetch credential only.
// - fetched_at_ms stamped at Rust receive time (never trust SPA TTL clock).
// - Fail-closed on network / non-2xx / malformed body.
// Related:
// - documentation/product/desktop/DESKTOP-EBROWSER.md
// - ebrowser_nav_policy.rs
// - fofline_egress.rs
// ---

use serde::Deserialize;

use crate::commands::product::BAKED_PRODUCT_APP_ORIGIN;
use crate::ebrowser_nav_policy::{self, PolicyMode, PolicySnapshot, POLICY_TTL_SECONDS};
use crate::fofline_egress::fofline_native_http_client;
use crate::native_oidc::session_cache;

#[derive(Debug, Deserialize)]
struct PolicyApiBody {
    mode: String,
    #[serde(default)]
    allow: Vec<String>,
    #[serde(default)]
    deny: Vec<String>,
    #[serde(default)]
    ttl_seconds: Option<u64>,
}

pub(crate) fn resolve_ebrowser_bearer(spa_hint: Option<&str>) -> Option<String> {
    if let Some(client) = session_cache::last_product_client() {
        if let Some(cached) = session_cache::unexpired(client) {
            let t = cached.access.trim();
            if !t.is_empty() {
                eprintln!("[STEP] ebrowser_policy_bearer source=session_cache");
                return Some(t.to_string());
            }
        }
    }
    let hint = spa_hint.map(str::trim).filter(|s| !s.is_empty())?;
    eprintln!("[STEP] ebrowser_policy_bearer source=spa_hint");
    Some(hint.to_string())
}

fn parse_mode(raw: &str) -> Option<PolicyMode> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "open" => Some(PolicyMode::Open),
        "allowlist" => Some(PolicyMode::Allowlist),
        "denylist" => Some(PolicyMode::Denylist),
        _ => None,
    }
}

fn now_epoch_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Map API JSON to PolicySnapshot; TTL clock = Rust receive time.
fn snapshot_from_api_body(body: &PolicyApiBody, received_at_ms: u64) -> Result<PolicySnapshot, String> {
    let mode = parse_mode(&body.mode).ok_or_else(|| "policy_invalid".to_string())?;
    Ok(PolicySnapshot {
        mode,
        allow: body.allow.clone(),
        deny: body.deny.clone(),
        fetched_at_ms: received_at_ms,
        ttl_seconds: body.ttl_seconds.unwrap_or(POLICY_TTL_SECONDS).max(1),
    })
}

pub async fn fetch_own_policy(access_token: &str) -> Result<PolicySnapshot, String> {
    let token = access_token.trim();
    if token.is_empty() {
        return Err("policy_auth_required".into());
    }
    let base = BAKED_PRODUCT_APP_ORIGIN.trim_end_matches('/');
    let url = format!("{base}/api/v1/ebrowser/policy");
    let client = fofline_native_http_client(20).map_err(|e| {
        eprintln!("[STEP] ebrowser_policy_fetch_fail reason=http_client err={e}");
        if e.starts_with("w_transport_proxy_required") {
            "policy_fetch_failed".to_string()
        } else {
            "policy_fetch_failed".to_string()
        }
    })?;
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| {
            eprintln!("[STEP] ebrowser_policy_fetch_fail reason=network err={e}");
            "policy_fetch_failed".to_string()
        })?;
    let status = resp.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        eprintln!("[STEP] ebrowser_policy_fetch_fail reason=unauthorized status={status}");
        return Err("policy_unauthorized".into());
    }
    if !status.is_success() {
        eprintln!("[STEP] ebrowser_policy_fetch_fail reason=http status={status}");
        return Err("policy_fetch_failed".into());
    }
    let body: PolicyApiBody = resp.json().await.map_err(|e| {
        eprintln!("[STEP] ebrowser_policy_fetch_fail reason=json err={e}");
        "policy_invalid".to_string()
    })?;
    let received = now_epoch_ms();
    let snap = snapshot_from_api_body(&body, received)?;
    eprintln!(
        "[STEP] ebrowser_policy_fetch ok mode={:?} ttl={}",
        snap.mode, snap.ttl_seconds
    );
    Ok(snap)
}

/// Ensure ACTIVE_POLICY is present and unexpired; refetch from API otherwise.
pub async fn ensure_active_policy(spa_access_token: Option<&str>) -> Result<(), String> {
    if ebrowser_nav_policy::active_policy_fresh() {
        eprintln!("[STEP] ebrowser_policy_reuse fresh=true");
        return Ok(());
    }
    force_refresh_active_policy(spa_access_token).await
}

/// Always refetch policy from API (admin tighten / 60s timer). Overwrites ACTIVE_POLICY.
pub async fn force_refresh_active_policy(spa_access_token: Option<&str>) -> Result<(), String> {
    let token = resolve_ebrowser_bearer(spa_access_token).ok_or_else(|| {
        eprintln!("[STEP] ebrowser_policy_fetch_fail reason=no_bearer");
        "policy_auth_required".to_string()
    })?;
    let snap = fetch_own_policy(&token).await?;
    ebrowser_nav_policy::store_policy(Some(snap));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_stamps_receive_time_not_server_clock() {
        let body = PolicyApiBody {
            mode: "allowlist".into(),
            allow: vec!["example.com".into()],
            deny: vec![],
            ttl_seconds: Some(300),
        };
        let received = 1_700_000_000_000u64;
        let snap = snapshot_from_api_body(&body, received).unwrap();
        assert_eq!(snap.fetched_at_ms, received);
        assert!(matches!(snap.mode, PolicyMode::Allowlist));
        assert_eq!(snap.allow, vec!["example.com".to_string()]);
    }

    #[test]
    fn invalid_mode_rejected() {
        let body = PolicyApiBody {
            mode: "everything".into(),
            allow: vec![],
            deny: vec![],
            ttl_seconds: None,
        };
        assert!(snapshot_from_api_body(&body, 1).is_err());
    }

    #[test]
    fn stage_must_not_store_spa_policy_arg() {
        let stage = include_str!("commands/ebrowser_stage.rs");
        let spa_policy_arg = format!("{}{}", "policy: Policy", "Snapshot");
        assert!(
            !stage.contains(&spa_policy_arg),
            "ebrowser_open must not accept SPA PolicySnapshot"
        );
        let store_spa = format!("{}{}", "store_policy(Some(", "policy))");
        assert!(
            !stage.contains(&store_spa),
            "must not store SPA-fed policy arg"
        );
        assert!(
            stage.contains("ensure_active_policy"),
            "open/navigate must ensure Rust-fetched policy"
        );
    }
}
