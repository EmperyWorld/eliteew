// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Baked Keycloak / product origins for native OIDC (no caller URL).
// Invariants:
// - Exact issuer and token/auth/logout/revoke/PAR paths only.
// - Callback must match the baked redirect origin+path for the typed client.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 2
// ---

use url::Url;

#[allow(dead_code)] // Wave 3 PAR / issuer asserts; keep baked constants next to auth/token URLs.
pub const BAKED_ISSUER: &str = "https://auth.eliteew.ru/realms/empery";
pub const BAKED_AUTH: &str =
    "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth";
pub const BAKED_TOKEN: &str =
    "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/token";
/// Browser RP-initiated `end_session`. Native close/quit uses `BAKED_REVOKE`.
#[allow(dead_code)]
pub const BAKED_LOGOUT: &str =
    "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/logout";
/// RFC 7009 token revocation (native close/quit). Not the legacy logout POST.
pub const BAKED_REVOKE: &str =
    "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/revoke";
pub const BAKED_PAR: &str =
    "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/ext/par/request";
pub const BAKED_DESKTOP_REDIRECT: &str = "https://app.eliteew.ru/";
pub const BAKED_FOFLINE_REDIRECT: &str =
    "https://app.eliteew.ru/fofline-oidc-bridge.html";

const FORBIDDEN_QUERY: &[&str] = &[
    "eliteewLicenseId",
    "eliteewDeviceId",
    "eliteew_ticket",
    "ticket",
    "login_hint",
];

pub fn start_url_has_forbidden_bind_ids(url: &str) -> bool {
    let Ok(parsed) = Url::parse(url) else {
        return true;
    };
    parsed
        .query_pairs()
        .any(|(k, _)| FORBIDDEN_QUERY.iter().any(|f| k.eq_ignore_ascii_case(f)))
}

pub fn assert_baked_https_url(url: &str, expected: &str) -> Result<(), String> {
    let parsed = Url::parse(url.trim()).map_err(|_| "oidc_url".to_string())?;
    let expected_u = Url::parse(expected).map_err(|_| "oidc_baked".to_string())?;
    if parsed.scheme() != "https" || expected_u.scheme() != "https" {
        return Err("oidc_scheme".into());
    }
    if parsed.username() != "" || parsed.password().is_some() {
        return Err("oidc_userinfo".into());
    }
    if parsed.host_str() != expected_u.host_str() {
        return Err("oidc_host".into());
    }
    if parsed.port().is_some() {
        return Err("oidc_port".into());
    }
    let path = parsed.path().trim_end_matches('/');
    let expected_path = expected_u.path().trim_end_matches('/');
    if path != expected_path {
        return Err("oidc_path".into());
    }
    Ok(())
}

pub fn build_authorization_url(
    client_id: &str,
    redirect_uri: &str,
    state: &str,
    nonce: &str,
    pkce_challenge: &str,
    dpop_jkt: &str,
) -> Result<Url, String> {
    if client_id != "empery-desktop" && client_id != "empery-fofline" {
        return Err("oidc_client".into());
    }
    let mut url = Url::parse(BAKED_AUTH).map_err(|e| format!("baked auth: {e}"))?;
    {
        let mut q = url.query_pairs_mut();
        q.append_pair("client_id", client_id);
        q.append_pair("redirect_uri", redirect_uri);
        q.append_pair("response_type", "code");
        q.append_pair("scope", "openid");
        q.append_pair("state", state);
        q.append_pair("nonce", nonce);
        q.append_pair("code_challenge", pkce_challenge);
        q.append_pair("code_challenge_method", "S256");
        q.append_pair("dpop_jkt", dpop_jkt);
    }
    let rendered = url.as_str().to_string();
    if start_url_has_forbidden_bind_ids(&rendered) {
        return Err("oidc_forbidden_query".into());
    }
    Ok(url)
}

/// Authorization URL after PAR: client_id + request_uri only (RFC 9126).
pub fn build_par_authorization_url(client_id: &str, request_uri: &str) -> Result<Url, String> {
    if client_id != "empery-desktop" && client_id != "empery-fofline" {
        return Err("oidc_client".into());
    }
    let uri = request_uri.trim();
    if uri.is_empty() || uri.len() > 512 {
        return Err("oidc_request_uri".into());
    }
    if uri.contains('?') || uri.contains('#') || uri.contains(' ') {
        return Err("oidc_request_uri".into());
    }
    if !uri.starts_with("urn:ietf:params:oauth:request_uri:") {
        return Err("oidc_request_uri".into());
    }
    let mut url = Url::parse(BAKED_AUTH).map_err(|e| format!("baked auth: {e}"))?;
    {
        let mut q = url.query_pairs_mut();
        q.append_pair("client_id", client_id);
        q.append_pair("request_uri", uri);
    }
    let rendered = url.as_str().to_string();
    if start_url_has_forbidden_bind_ids(&rendered) {
        return Err("oidc_forbidden_query".into());
    }
    Ok(url)
}

/// Extract authorization code after exact redirect + state match.
pub fn parse_callback_code(
    callback_url: &str,
    expected_redirect: &str,
    expected_state: &str,
) -> Result<String, String> {
    let raw = callback_url.trim();
    if raw.is_empty() || raw.len() > 4096 {
        return Err("callback_url".into());
    }
    let parsed = Url::parse(raw).map_err(|_| "callback_url".to_string())?;
    if parsed.scheme() != "https" {
        return Err("callback_scheme".into());
    }
    let expected = Url::parse(expected_redirect).map_err(|_| "redirect".to_string())?;
    if parsed.host_str() != expected.host_str() {
        return Err("callback_host".into());
    }
    if parsed.port().is_some() {
        return Err("callback_port".into());
    }
    if parsed.username() != "" || parsed.password().is_some() {
        return Err("callback_userinfo".into());
    }
    let path = parsed.path().trim_end_matches('/');
    let expected_path = expected.path().trim_end_matches('/');
    if path != expected_path {
        return Err("callback_path".into());
    }
    let pairs: Vec<(String, String)> = parsed
        .query_pairs()
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    if pairs.iter().any(|(k, _)| k == "error") {
        return Err("callback_error".into());
    }
    let state = pairs
        .iter()
        .find(|(k, _)| k == "state")
        .map(|(_, v)| v.as_str())
        .unwrap_or("");
    if state.is_empty() || state != expected_state {
        return Err("callback_state".into());
    }
    let code = pairs
        .iter()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.trim().to_string())
        .filter(|c| !c.is_empty() && c.len() <= 512)
        .ok_or_else(|| "callback_code".to_string())?;
    Ok(code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorization_url_has_no_bind_ids_or_ticket() {
        let url = build_authorization_url(
            "empery-desktop",
            BAKED_DESKTOP_REDIRECT,
            "st",
            "nn",
            "challenge",
            "jkt",
        )
        .unwrap();
        let s = url.as_str();
        assert!(s.starts_with(BAKED_AUTH));
        assert!(!start_url_has_forbidden_bind_ids(s));
        assert!(!s.to_ascii_lowercase().contains("ticket"));
        assert!(!s.contains("eliteewLicenseId"));
        assert_eq!(url.query_pairs().find(|(k, _)| k == "client_id").unwrap().1, "empery-desktop");
        assert!(s.starts_with(BAKED_ISSUER));
        assert_eq!(
            Url::parse(BAKED_PAR).unwrap().host_str(),
            Url::parse(BAKED_ISSUER).unwrap().host_str()
        );
    }

    #[test]
    fn rejects_unknown_client_id() {
        assert!(build_authorization_url(
            "empery-web",
            BAKED_DESKTOP_REDIRECT,
            "st",
            "nn",
            "c",
            "j"
        )
        .is_err());
    }

    #[test]
    fn callback_requires_exact_origin_path_and_state() {
        let ok = parse_callback_code(
            "https://app.eliteew.ru/?code=abc&state=st-1",
            BAKED_DESKTOP_REDIRECT,
            "st-1",
        )
        .unwrap();
        assert_eq!(ok, "abc");
        assert!(parse_callback_code(
            "https://evil.example/?code=abc&state=st-1",
            BAKED_DESKTOP_REDIRECT,
            "st-1",
        )
        .is_err());
        assert!(parse_callback_code(
            "https://app.eliteew.ru/other?code=abc&state=st-1",
            BAKED_DESKTOP_REDIRECT,
            "st-1",
        )
        .is_err());
        assert!(parse_callback_code(
            "https://app.eliteew.ru/?code=abc&state=wrong",
            BAKED_DESKTOP_REDIRECT,
            "st-1",
        )
        .is_err());
        assert!(parse_callback_code(
            "javascript:alert(1)",
            BAKED_DESKTOP_REDIRECT,
            "st-1",
        )
        .is_err());
    }

    #[test]
    fn par_authorization_url_rejects_unknown_client_and_query_uri() {
        assert!(build_par_authorization_url(
            "empery-web",
            "urn:ietf:params:oauth:request_uri:abc"
        )
        .is_err());
        assert!(build_par_authorization_url(
            "empery-desktop",
            "urn:ietf:params:oauth:request_uri:abc?ticket=x"
        )
        .is_err());
        assert!(build_par_authorization_url("empery-desktop", "https://evil.example/x").is_err());
        assert!(build_par_authorization_url("empery-desktop", "").is_err());
        assert!(build_par_authorization_url(
            "empery-desktop",
            &format!("urn:ietf:params:oauth:request_uri:{}", "a".repeat(500))
        )
        .is_err());
        assert!(start_url_has_forbidden_bind_ids(
            "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth?eliteew_ticket=x"
        ));
    }

    #[test]
    fn fofline_callback_path_is_bridge_document() {
        let ok = parse_callback_code(
            "https://app.eliteew.ru/fofline-oidc-bridge.html?code=z&state=s",
            BAKED_FOFLINE_REDIRECT,
            "s",
        )
        .unwrap();
        assert_eq!(ok, "z");
        assert!(parse_callback_code(
            "https://app.eliteew.ru/?code=z&state=s",
            BAKED_FOFLINE_REDIRECT,
            "s",
        )
        .is_err());
    }

    #[test]
    fn revoke_url_is_baked_https() {
        assert_eq!(assert_baked_https_url(BAKED_REVOKE, BAKED_REVOKE), Ok(()));
        assert_eq!(assert_baked_https_url(BAKED_LOGOUT, BAKED_LOGOUT), Ok(()));
        assert!(BAKED_REVOKE.ends_with("/protocol/openid-connect/revoke"));
        assert!(BAKED_LOGOUT.ends_with("/protocol/openid-connect/logout"));
        assert_eq!(
            Url::parse(BAKED_REVOKE).unwrap().host_str(),
            Url::parse(BAKED_ISSUER).unwrap().host_str()
        );
    }
}
