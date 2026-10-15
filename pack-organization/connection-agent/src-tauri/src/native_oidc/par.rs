// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Pushed Authorization Request so the binding ticket never appears on the browser URL.
// Invariants:
// - Ticket lives only in the PAR body; auth URL is client_id + request_uri.
// - PAR destination is the baked Keycloak PAR path; DPoP proof uses that exact HTU.
// - DPoP `iat` is aligned to Keycloak HTTP Date (26.7.1 active window ≈ 25s).
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 3 / §9.7
// ---

use serde::Deserialize;
use std::path::Path;

use crate::device_keys;
use crate::dpop_crypto::sign_dpop_proof;
use crate::fofline_egress::fofline_native_http_client;
use crate::native_oidc::bounded_json::{json_from_response, OIDC_HTTP_MAX_BYTES};
use crate::native_oidc::dpop_iat::resolve_dpop_iat;
use crate::native_oidc::pkce::random_b64url_32;
use crate::native_oidc::urls::{self, BAKED_PAR};
use crate::native_oidc::{generic_user_message, NativeOidcClient};

#[derive(Debug, Deserialize)]
struct ParResponse {
    request_uri: Option<String>,
    error: Option<String>,
}

pub struct ParPushRequest<'a> {
    pub app_data: &'a Path,
    pub app_identifier: &'a str,
    pub client: NativeOidcClient,
    pub state: &'a str,
    pub nonce: &'a str,
    pub pkce_challenge: &'a str,
    pub dpop_jkt: &'a str,
    pub ticket: Option<&'a str>,
    /// Interactive Hub login: force the Keycloak username form (ignore leftover SSO cookies).
    pub prompt_login: bool,
}

/// Push PKCE/DPoP/ticket to Keycloak PAR. Ticket is omitted from the subsequent auth URL.
pub async fn push_authorization_request(req: ParPushRequest<'_>) -> Result<url::Url, String> {
    urls::assert_baked_https_url(BAKED_PAR, BAKED_PAR)?;
    let http = fofline_native_http_client(20).map_err(|e| {
        if e.starts_with("w_transport_proxy_required") {
            generic_user_message().to_string()
        } else {
            e
        }
    })?;
    let iat = resolve_dpop_iat(&http).await;
    let mut dpop_sk = device_keys::load_dpop_sk_bytes(req.app_data, Some(req.app_identifier))?;
    let proof = sign_dpop_proof(&dpop_sk, "POST", BAKED_PAR, iat, &random_b64url_32())?;
    for b in dpop_sk.iter_mut() {
        *b = 0;
    }
    let mut form: Vec<(&str, &str)> = vec![
        ("client_id", req.client.client_id()),
        ("redirect_uri", req.client.redirect_uri()),
        ("response_type", "code"),
        ("scope", "openid"),
        ("state", req.state),
        ("nonce", req.nonce),
        ("code_challenge", req.pkce_challenge),
        ("code_challenge_method", "S256"),
        ("dpop_jkt", req.dpop_jkt),
    ];
    if let Some(t) = req.ticket.map(str::trim).filter(|s| !s.is_empty()) {
        form.push(("eliteew_ticket", t));
    }
    if req.prompt_login {
        form.push(("prompt", "login"));
    }
    let resp = http
        .post(BAKED_PAR)
        .header("DPoP", proof)
        .form(&form)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[STEP] native_oidc_par_network err={e}");
            generic_user_message().to_string()
        })?;
    let status = resp.status();
    let parsed: ParResponse = match json_from_response(resp, OIDC_HTTP_MAX_BYTES).await {
        Ok(p) => p,
        Err(reason) => {
            eprintln!("[STEP] native_oidc_par_deny reason={reason}");
            return Err(generic_user_message().into());
        }
    };
    if !status.is_success() {
        eprintln!(
            "[STEP] native_oidc_par_deny http={} error={}",
            status.as_u16(),
            parsed.error.as_deref().unwrap_or("")
        );
        return Err(generic_user_message().into());
    }
    let request_uri = parsed
        .request_uri
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            eprintln!("[STEP] native_oidc_par_deny reason=request_uri");
            generic_user_message().to_string()
        })?;
    urls::build_par_authorization_url(req.client.client_id(), &request_uri)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_oidc::urls::{start_url_has_forbidden_bind_ids, BAKED_AUTH};

    #[test]
    fn par_auth_url_has_no_ticket() {
        let url = urls::build_par_authorization_url(
            "empery-desktop",
            "urn:ietf:params:oauth:request_uri:abc",
        )
        .unwrap();
        let s = url.as_str();
        assert!(s.starts_with(BAKED_AUTH));
        assert!(!start_url_has_forbidden_bind_ids(s));
        assert!(!s.to_ascii_lowercase().contains("ticket"));
        assert!(!s.contains("code_challenge"));
        assert_eq!(
            url.query_pairs()
                .find(|(k, _)| k == "request_uri")
                .unwrap()
                .1,
            "urn:ietf:params:oauth:request_uri:abc"
        );
    }
}
