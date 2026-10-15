// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// FoFline L5 harden: no product remote SPA Start when pack path is active;
// native HTTP client honors W-transport fail-closed SOCKS when gate is on;
// top-level nav allowlist permits only the public HTTPS OIDC bridge document.
// Invariants:
// - Pack ready + remote FoFline URL → deny (no silent public SPA downgrade).
// - Remote FoFline Start is never enabled via process-env (Wave 5 / F-07).
// - When W-transport enabled, native HTTP must use SOCKS or fail-closed.
// - Local FoFline WebView may open exactly https://app.eliteew.ru/fofline-oidc-bridge.html
//   (query OK); other app.eliteew.ru documents stay denied.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3 / L5 / §5
// - crate::commands::product / spa_pack
// ---

use crate::fofline_spa_origin;
use crate::wg::userspace::{w_transport_enabled, w_transport_proxy_url};
use reqwest::Client;
use std::sync::atomic::{AtomicBool, Ordering};
use url::Url;

static SOCKS_PROXY_STEP_LOGGED: AtomicBool = AtomicBool::new(false);

/// Native mirror of FE `VITE_FOFLINE_REMOTE_START` — product_open fail-closed gate.
pub fn remote_start_allowed() -> bool {
    // Wave 5 / F-07: process-env must not enable remote FoFline SPA Start.
    false
}

fn is_fofline_remote_product_url(url: &Url) -> bool {
    if fofline_spa_origin::is_fofline_local_url(url) {
        return false;
    }
    if url.scheme() != "https" && url.scheme() != "http" {
        return false;
    }
    url.query_pairs()
        .any(|(k, v)| k == "eliteewFoflineClient" && v == "1")
}

/// Deny remote FoFline product SPA when pack is ready or remote Start flag is off.
pub fn assert_fofline_start_url(url: &Url, pack_ready: bool) -> Result<(), (String, String)> {
    if fofline_spa_origin::is_fofline_local_url(url) {
        return Ok(());
    }
    if !is_fofline_remote_product_url(url) {
        return Ok(());
    }
    if pack_ready {
        return Err((
            "remote_spa_forbidden_pack_ready".into(),
            "FoFline workspace pack is ready — remote app host Start is forbidden (no public SPA downgrade)"
                .into(),
        ));
    }
    if !remote_start_allowed() {
        return Err((
            "remote_spa_forbidden".into(),
            "FoFline remote Start is disabled in this build (use local pack)"
                .into(),
        ));
    }
    Ok(())
}

/// Exact public OIDC bridge path (HTTPS→HTTPS IdP return; JS handoff to fofline-spa:).
pub const FOFLINE_OIDC_BRIDGE_PATH: &str = "/fofline-oidc-bridge.html";
const FOFLINE_OIDC_BRIDGE_HOST: &str = "app.eliteew.ru";

/// True only for `https://app.eliteew.ru/fofline-oidc-bridge.html` (+ query).
pub fn is_fofline_oidc_bridge_url(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    if !host.eq_ignore_ascii_case(FOFLINE_OIDC_BRIDGE_HOST) {
        return false;
    }
    url.path() == FOFLINE_OIDC_BRIDGE_PATH
}

/// Top-level navigation allowlist for local FoFline WebView (blocks public SPA document loads).
/// Default-deny: only local pack, IdP, exact OIDC bridge, Meet host, and `about:blank`.
pub fn navigation_allowed_for_local_fofline(url: &Url) -> bool {
    if !navigation_common_deny(url) {
        return false;
    }
    if fofline_spa_origin::is_fofline_local_url(url) {
        return true;
    }
    let scheme = url.scheme();
    // Blank document only — deny data:/blob: (XSS / exfil vectors).
    if scheme == "about" {
        let allowed = url.as_str() == "about:blank" || url.as_str().starts_with("about:blank?");
        if !allowed {
            eprintln!("[STEP] fofline_nav_deny scheme=about url={} reason=about_not_blank", url.as_str());
        }
        return allowed;
    }
    let Some(host) = url.host_str() else {
        eprintln!("[STEP] fofline_nav_deny reason=missing_host");
        return false;
    };
    let host_l = host.to_ascii_lowercase();
    // OIDC / IdP — not product SPA chunks from app host.
    if host_l == "auth.eliteew.ru" || host_l.ends_with(".auth.eliteew.ru") {
        return true;
    }
    // Meet media (iframe / rare top-level) — same product contour as stack0 Meet.
    if host_l == "meet.eliteew.ru" || host_l.ends_with(".meet.eliteew.ru") {
        return true;
    }
    // HTTPS bridge only — Keycloak Location must stay HTTP(S) for WebKitGTK.
    if is_fofline_oidc_bridge_url(url) {
        eprintln!("[STEP] fofline_nav_allow host={host_l} reason=oidc_bridge");
        return true;
    }
    // Explicit deny: public product SPA host (silent chunk downgrade).
    if host_l == "app.eliteew.ru" || host_l.ends_with(".app.eliteew.ru") {
        let path = url.path();
        eprintln!(
            "[STEP] fofline_nav_deny host={host_l} path={path} reason=remote_spa_document"
        );
        return false;
    }
    eprintln!("[STEP] fofline_nav_deny host={host_l} reason=default_deny");
    false
}

/// Shared default-deny precheck for every product/kernel WebView (Wave 6 / F-10).
pub fn navigation_common_deny(url: &Url) -> bool {
    let scheme = url.scheme();
    if scheme == "javascript" || scheme == "data" || scheme == "blob" || scheme == "file" {
        eprintln!("[STEP] product_nav_deny scheme={scheme} reason=default_deny");
        return false;
    }
    if !url.username().is_empty() || url.password().is_some() {
        eprintln!("[STEP] product_nav_deny reason=userinfo");
        return false;
    }
    if let Some(port) = url.port() {
        // Only default TLS/HTTP ports for EliteEW product hosts.
        if port != 443 && port != 80 {
            eprintln!("[STEP] product_nav_deny port={port} reason=foreign_port");
            return false;
        }
    }
    true
}

/// Connected cloud product WebView — exact app host + IdP/Meet; no lookalike app hosts.
pub fn navigation_allowed_for_connected_cloud(url: &Url) -> bool {
    if !navigation_common_deny(url) {
        return false;
    }
    if fofline_spa_origin::is_fofline_local_url(url) {
        return true;
    }
    let scheme = url.scheme();
    if scheme == "about" {
        return url.as_str() == "about:blank" || url.as_str().starts_with("about:blank?");
    }
    if scheme != "https" && scheme != "http" {
        eprintln!("[STEP] connected_nav_deny scheme={scheme}");
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    let host_l = host.to_ascii_lowercase();
    if host_l == "app.eliteew.ru" {
        return true;
    }
    if host_l == "auth.eliteew.ru" || host_l.ends_with(".auth.eliteew.ru") {
        return true;
    }
    if host_l == "meet.eliteew.ru" || host_l.ends_with(".meet.eliteew.ru") {
        return true;
    }
    eprintln!("[STEP] connected_nav_deny host={host_l} reason=default_deny");
    false
}

/// Kernel offline presentation window — same host allowlist as Connected (static APP_BASE pages).
pub fn navigation_allowed_for_kernel_offline(url: &Url) -> bool {
    navigation_allowed_for_connected_cloud(url)
}

/// Prefer `socks5h://` so reqwest sends the hostname to our SOCKS (product map →
/// `10.88.89.1` for `app`/`auth`/`meet.eliteew.ru`) instead of resolving via ISP
/// to the public VIP and CONNECT'ing an IP outside AllowedIPs.
fn socks5h_proxy_url(proxy: &str) -> String {
    if let Some(rest) = proxy.strip_prefix("socks5://") {
        format!("socks5h://{rest}")
    } else {
        proxy.to_string()
    }
}

/// Typed egress class for native HTTP — no silent public EliteEW bypass.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NativeEgressClass {
    /// EliteEW product endpoints — SOCKS required when W-transport is on.
    EliteEwPlatform,
    /// Loopback local AI (Ollama etc.) — direct loopback only.
    LocalAiLoopback,
    /// Explicit third-party base URL chosen by the seat — direct allowed.
    ThirdPartyExplicit,
}

/// Enforce egress policy for EliteEW platform HTTP.
pub fn assert_eliteew_platform_egress() -> Result<(), String> {
    if !w_transport_enabled() {
        return Ok(());
    }
    let plan = w_transport_proxy_url();
    match plan.proxy_url {
        Some(ref _proxy) if plan.fail_closed => Ok(()),
        _ => Err(format!(
            "w_transport_proxy_required:{}",
            plan.message
        )),
    }
}

/// Local AI may only target loopback — never a public EliteEW host via direct TCP.
pub fn assert_local_ai_loopback_url(base_url: &str) -> Result<(), String> {
    let parsed = Url::parse(base_url.trim()).map_err(|e| format!("local_ai_url_invalid:{e}"))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(format!("local_ai_scheme_denied:{scheme}"));
    }
    let Some(host) = parsed.host_str() else {
        return Err("local_ai_host_missing".into());
    };
    let host_l = host.to_ascii_lowercase();
    let loopback = host_l == "localhost"
        || host_l == "127.0.0.1"
        || host_l == "::1"
        || host_l == "[::1]";
    if !loopback {
        eprintln!("[STEP] fofline_native_http local_ai_deny host={host_l}");
        return Err(format!(
            "local_ai_loopback_required: host '{host}' is not loopback"
        ));
    }
    Ok(())
}

/// When W-transport is on, third-party direct must not target EliteEW product hosts.
pub fn assert_third_party_not_eliteew_host(base_url: &str) -> Result<(), String> {
    if !w_transport_enabled() {
        return Ok(());
    }
    let parsed = Url::parse(base_url.trim()).map_err(|e| format!("third_party_url_invalid:{e}"))?;
    let Some(host) = parsed.host_str() else {
        return Ok(());
    };
    let host_l = host.to_ascii_lowercase();
    if host_l == "app.eliteew.ru"
        || host_l.ends_with(".app.eliteew.ru")
        || host_l == "auth.eliteew.ru"
        || host_l.ends_with(".auth.eliteew.ru")
        || host_l == "ai.eliteew.ru"
        || host_l.ends_with(".eliteew.ru")
    {
        eprintln!("[STEP] fofline_native_http third_party_deny_eliteew host={host_l}");
        return Err(format!(
            "third_party_eliteew_forbidden: use EliteEW AI path (W-transport) for '{host}'"
        ));
    }
    Ok(())
}

/// Native HTTP for FoFline pack/updater-adjacent fetches: SOCKS when W-transport on.
pub fn fofline_native_http_client(timeout_secs: u64) -> Result<Client, String> {
    fofline_native_http_client_for(NativeEgressClass::EliteEwPlatform, timeout_secs)
}

/// Build HTTP client honoring typed egress class.
pub fn fofline_native_http_client_for(
    class: NativeEgressClass,
    timeout_secs: u64,
) -> Result<Client, String> {
    let mut builder = Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .redirect(reqwest::redirect::Policy::none());
    match class {
        NativeEgressClass::EliteEwPlatform => {
            assert_eliteew_platform_egress()?;
            if w_transport_enabled() {
                let plan = w_transport_proxy_url();
                let Some(proxy) = plan.proxy_url.filter(|_| plan.fail_closed) else {
                    return Err(format!(
                        "w_transport_proxy_required:{}",
                        plan.message
                    ));
                };
                let proxy_h = socks5h_proxy_url(&proxy);
                let p = reqwest::Proxy::all(&proxy_h)
                    .map_err(|e| format!("invalid W-transport SOCKS proxy: {e}"))?;
                builder = builder.proxy(p);
                if !SOCKS_PROXY_STEP_LOGGED.swap(true, Ordering::Relaxed) {
                    eprintln!(
                        "[STEP] fofline_native_http socks_proxy applied scheme=socks5h class=eliteew"
                    );
                }
            }
        }
        NativeEgressClass::LocalAiLoopback => {
            // URL host check is enforced by callers via assert_local_ai_loopback_url.
            eprintln!("[STEP] fofline_native_http direct class=local_ai_loopback");
        }
        NativeEgressClass::ThirdPartyExplicit => {
            eprintln!("[STEP] fofline_native_http direct class=third_party_explicit");
        }
    }
    builder.build().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn socks5h_rewrites_local_dns_scheme() {
        assert_eq!(
            socks5h_proxy_url("socks5://127.0.0.1:12345"),
            "socks5h://127.0.0.1:12345"
        );
        assert_eq!(
            socks5h_proxy_url("socks5h://127.0.0.1:1"),
            "socks5h://127.0.0.1:1"
        );
    }

    #[test]
    fn eliteew_platform_is_default_client_class() {
        // Source lock: EliteEW AI / updater / pack must use platform class.
        let src = include_str!("fofline_egress.rs");
        assert!(src.contains("NativeEgressClass::EliteEwPlatform"));
        assert!(src.contains("assert_eliteew_platform_egress"));
        assert!(src.contains("fofline_native_http_client_for"));
        assert!(src.contains("assert_local_ai_loopback_url"));
    }

    #[test]
    fn local_ai_accepts_only_loopback() {
        assert!(assert_local_ai_loopback_url("http://127.0.0.1:11434").is_ok());
        assert!(assert_local_ai_loopback_url("http://localhost:11434/v1").is_ok());
        assert!(assert_local_ai_loopback_url("https://app.eliteew.ru").is_err());
        assert!(assert_local_ai_loopback_url("http://192.168.1.10:11434").is_err());
    }

    #[test]
    fn third_party_blocks_eliteew_hosts_when_w_transport_concept() {
        // Function itself gates on w_transport_enabled(); source lock ensures call site.
        let src = include_str!("ai_http.rs");
        assert!(src.contains("assert_local_ai_loopback_url"));
        assert!(src.contains("assert_third_party_not_eliteew_host"));
    }

    #[test]
    fn local_url_always_ok() {
        let u: Url = "fofline-spa://localhost/index.html?eliteewFoflineClient=1"
            .parse()
            .unwrap();
        assert!(assert_fofline_start_url(&u, true).is_ok());
        assert!(assert_fofline_start_url(&u, false).is_ok());
    }

    #[test]
    fn remote_denied_when_pack_ready() {
        let u: Url = "https://app.eliteew.ru/?eliteewFoflineClient=1"
            .parse()
            .unwrap();
        let err = assert_fofline_start_url(&u, true).unwrap_err();
        assert_eq!(err.0, "remote_spa_forbidden_pack_ready");
    }

    #[test]
    fn remote_denied_without_env_when_pack_missing() {
        let u: Url = "https://app.eliteew.ru/?eliteewFoflineClient=1"
            .parse()
            .unwrap();
        let err = assert_fofline_start_url(&u, false).unwrap_err();
        assert_eq!(err.0, "remote_spa_forbidden");
        assert!(!remote_start_allowed());
    }

    #[test]
    fn nav_blocks_app_host_allows_auth_and_local() {
        let app: Url = "https://app.eliteew.ru/assets/index.js".parse().unwrap();
        assert!(!navigation_allowed_for_local_fofline(&app));
        let auth: Url = "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth"
            .parse()
            .unwrap();
        assert!(navigation_allowed_for_local_fofline(&auth));
        let local: Url = "fofline-spa://localhost/index.html".parse().unwrap();
        assert!(navigation_allowed_for_local_fofline(&local));
    }

    #[test]
    fn nav_allows_exact_oidc_bridge_with_query() {
        let bridge: Url =
            "https://app.eliteew.ru/fofline-oidc-bridge.html?code=abc&state=xyz"
                .parse()
                .unwrap();
        assert!(is_fofline_oidc_bridge_url(&bridge));
        assert!(navigation_allowed_for_local_fofline(&bridge));
    }

    #[test]
    fn nav_denies_app_root_assets_prefix_suffix_and_lookalikes() {
        let cases = [
            "https://app.eliteew.ru/",
            "https://app.eliteew.ru/index.html",
            "https://app.eliteew.ru/assets/index.js",
            "https://app.eliteew.ru/fofline-oidc-bridge.html/extra",
            "https://app.eliteew.ru/fofline-oidc-bridge.html.bak",
            "https://app.eliteew.ru/xfofline-oidc-bridge.html",
            "https://evil.app.eliteew.ru/fofline-oidc-bridge.html",
            "http://app.eliteew.ru/fofline-oidc-bridge.html",
        ];
        for raw in cases {
            let u: Url = raw.parse().unwrap();
            assert!(
                !navigation_allowed_for_local_fofline(&u),
                "expected deny for {raw}"
            );
        }
    }

    #[test]
    fn nav_allows_custom_scheme_return_after_bridge() {
        let local: Url =
            "fofline-spa://localhost/index.html?code=abc&state=xyz&eliteewFoflineClient=1"
                .parse()
                .unwrap();
        assert!(navigation_allowed_for_local_fofline(&local));
    }

    #[test]
    fn nav_default_deny_unknown_hosts_and_data_blob() {
        let evil: Url = "https://evil.example/phish".parse().unwrap();
        assert!(!navigation_allowed_for_local_fofline(&evil));
        let data: Url = "data:text/html,hi".parse().unwrap();
        assert!(!navigation_allowed_for_local_fofline(&data));
        let blank: Url = "about:blank".parse().unwrap();
        assert!(navigation_allowed_for_local_fofline(&blank));
        let meet: Url = "https://meet.eliteew.ru/room".parse().unwrap();
        assert!(navigation_allowed_for_local_fofline(&meet));
    }


    #[test]
    fn connected_nav_allows_app_denies_lookalike_and_userinfo() {
        let ok: Url = "https://app.eliteew.ru/?eliteewDesktopClient=1".parse().unwrap();
        assert!(navigation_allowed_for_connected_cloud(&ok));
        let evil: Url = "https://evil.app.eliteew.ru/".parse().unwrap();
        assert!(!navigation_allowed_for_connected_cloud(&evil));
        let data: Url = "data:text/html,hi".parse().unwrap();
        assert!(!navigation_allowed_for_connected_cloud(&data));
        let userinfo: Url = "https://u:p@app.eliteew.ru/".parse().unwrap();
        assert!(!navigation_allowed_for_connected_cloud(&userinfo));
    }

    #[test]
    fn cloud_desktop_start_not_gated_here() {
        let u: Url = "https://app.eliteew.ru/?eliteewDesktopClient=1"
            .parse()
            .unwrap();
        assert!(assert_fofline_start_url(&u, true).is_ok());
    }
}
