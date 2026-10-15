// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Token/refresh/logout HTTP to baked Keycloak endpoints with DPoP.
// Invariants:
// - Destination URLs are baked constants, never caller-supplied.
// - Refresh token is stored in keyring and stripped from IPC views.
// - DPoP `iat` is aligned to Keycloak HTTP Date (26.7.1 active window ≈ 25s).
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.10
// ---

use serde::Deserialize;
use std::path::Path;

use crate::device_keys;
use crate::dpop_crypto::sign_dpop_proof;
use crate::fofline_egress::fofline_native_http_client;
use crate::native_oidc::bounded_json::{discard_body, json_from_response, OIDC_HTTP_MAX_BYTES};
use crate::native_oidc::dpop_iat::resolve_dpop_iat;
use crate::native_oidc::pkce::random_b64url_32;
use crate::native_oidc::refresh_store;
use crate::native_oidc::session_cache;
use crate::native_oidc::urls::{self, BAKED_REVOKE, BAKED_TOKEN};
use crate::native_oidc::{generic_user_message, NativeOidcClient, NativeOidcCommandView};

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    id_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    error: Option<String>,
}

async fn post_token_form(
    app_data: &Path,
    app_identifier: Option<&str>,
    form: &[(&str, &str)],
) -> Result<TokenResponse, String> {
    urls::assert_baked_https_url(BAKED_TOKEN, BAKED_TOKEN)?;
    let client = fofline_native_http_client(20).map_err(|e| {
        if e.starts_with("w_transport_proxy_required") {
            generic_user_message().to_string()
        } else {
            e
        }
    })?;
    let iat = resolve_dpop_iat(&client).await;
    let mut dpop_sk = device_keys::load_dpop_sk_bytes(app_data, app_identifier)?;
    let proof = sign_dpop_proof(&dpop_sk, "POST", BAKED_TOKEN, iat, &random_b64url_32())?;
    for b in dpop_sk.iter_mut() {
        *b = 0;
    }
    let resp = client
        .post(BAKED_TOKEN)
        .header("DPoP", proof)
        .form(form)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[STEP] native_oidc_token_network err={e}");
            generic_user_message().to_string()
        })?;
    let status = resp.status();
    let parsed: TokenResponse = match json_from_response(resp, OIDC_HTTP_MAX_BYTES).await {
        Ok(p) => p,
        Err(reason) => {
            eprintln!("[STEP] native_oidc_token_deny reason={reason}");
            return Err(generic_user_message().into());
        }
    };
    if !status.is_success() {
        eprintln!(
            "[STEP] native_oidc_token_deny http={} error={}",
            status.as_u16(),
            parsed.error.as_deref().unwrap_or("")
        );
        return Err(generic_user_message().into());
    }
    Ok(parsed)
}

fn view_from_tokens(
    app_identifier: Option<&str>,
    client: NativeOidcClient,
    parsed: TokenResponse,
    dpop_jkt: String,
) -> NativeOidcCommandView {
    if let Some(refresh) = parsed.refresh_token.as_deref().map(str::trim).filter(|s| !s.is_empty())
    {
        if let Err(e) = refresh_store::store_refresh(app_identifier, client.client_id(), refresh) {
            eprintln!("[STEP] native_oidc_refresh_store_fail err={e}");
            return NativeOidcCommandView::generic_deny();
        }
    }
    let access = parsed
        .access_token
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let Some(access) = access else {
        return NativeOidcCommandView::generic_deny();
    };
    session_cache::remember_access(
        client,
        &access,
        parsed.id_token.as_deref(),
        parsed.expires_in.unwrap_or(300),
    );
    NativeOidcCommandView {
        ok: true,
        code: "ok".into(),
        message: String::new(),
        authorization_url: None,
        transaction_id: None,
        dpop_jkt: Some(dpop_jkt),
        access_token: Some(access),
        id_token: parsed.id_token,
        expires_in: parsed.expires_in,
    }
}

pub async fn exchange_authorization_code(
    app_data: &Path,
    app_identifier: Option<&str>,
    client: NativeOidcClient,
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
    dpop_jkt: String,
) -> NativeOidcCommandView {
    let parsed = match post_token_form(
        app_data,
        app_identifier,
        &[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("client_id", client.client_id()),
            ("code_verifier", code_verifier),
        ],
    )
    .await
    {
        Ok(p) => p,
        Err(message) => return NativeOidcCommandView::deny("auth_policy_denied", message),
    };
    view_from_tokens(app_identifier, client, parsed, dpop_jkt)
}

pub async fn refresh_access_token(
    app_data: &Path,
    app_identifier: Option<&str>,
    client: NativeOidcClient,
) -> NativeOidcCommandView {
    let refresh = match refresh_store::load_refresh(app_identifier, client.client_id()) {
        Ok(t) => t,
        Err(_) => return NativeOidcCommandView::generic_deny(),
    };
    let jkt = match device_keys::dpop_jkt(app_data, app_identifier) {
        Ok(j) => j,
        Err(_) => return NativeOidcCommandView::generic_deny(),
    };
    let parsed = match post_token_form(
        app_data,
        app_identifier,
        &[
            ("grant_type", "refresh_token"),
            ("refresh_token", &refresh),
            ("client_id", client.client_id()),
        ],
    )
    .await
    {
        Ok(p) => p,
        Err(message) => {
            refresh_store::clear_refresh(app_identifier, client.client_id());
            session_cache::clear_client(client);
            return NativeOidcCommandView::deny("auth_policy_denied", message);
        }
    };
    view_from_tokens(app_identifier, client, parsed, jkt)
}

pub async fn logout_session(
    app_data: &Path,
    app_identifier: Option<&str>,
    client: NativeOidcClient,
) -> NativeOidcCommandView {
    match refresh_store::load_refresh(app_identifier, client.client_id()) {
        Ok(refresh) => {
            revoke_refresh_token(app_data, app_identifier, client, &refresh).await;
        }
        Err(_) => {
            eprintln!(
                "[STEP] native_oidc_revoke_skip reason=no_refresh client={}",
                client.client_id()
            );
        }
    }
    refresh_store::clear_refresh(app_identifier, client.client_id());
    session_cache::clear_client(client);
    crate::native_oidc::transaction::clear_client(client.client_id());
    eprintln!(
        "[STEP] native_oidc_logout_local_cleared client={}",
        client.client_id()
    );
    NativeOidcCommandView {
        ok: true,
        code: "ok".into(),
        message: String::new(),
        authorization_url: None,
        transaction_id: None,
        dpop_jkt: None,
        access_token: None,
        id_token: None,
        expires_in: None,
    }
}

/// RFC 7009 revoke for both typed clients (window close / tray quit).
pub async fn logout_all_clients(app_data: &Path, app_identifier: Option<&str>) {
    let _ = logout_session(app_data, app_identifier, NativeOidcClient::EmperyDesktop).await;
    let _ = logout_session(app_data, app_identifier, NativeOidcClient::EmperyFofline).await;
}

async fn revoke_refresh_token(
    app_data: &Path,
    app_identifier: Option<&str>,
    client: NativeOidcClient,
    refresh: &str,
) {
    if let Err(e) = urls::assert_baked_https_url(BAKED_REVOKE, BAKED_REVOKE) {
        eprintln!("[STEP] native_oidc_revoke_fail reason=url err={e}");
        return;
    }
    let http = match fofline_native_http_client(15) {
        Ok(h) => h,
        Err(e) => {
            eprintln!("[STEP] native_oidc_revoke_fail reason=http_client err={e}");
            return;
        }
    };
    let iat = resolve_dpop_iat(&http).await;
    let mut dpop_sk = match device_keys::load_dpop_sk_bytes(app_data, app_identifier) {
        Ok(sk) => sk,
        Err(e) => {
            eprintln!("[STEP] native_oidc_revoke_fail reason=dpop_sk err={e}");
            return;
        }
    };
    let proof = match sign_dpop_proof(&dpop_sk, "POST", BAKED_REVOKE, iat, &random_b64url_32()) {
        Ok(p) => p,
        Err(e) => {
            for b in dpop_sk.iter_mut() {
                *b = 0;
            }
            eprintln!("[STEP] native_oidc_revoke_fail reason=dpop_sign err={e}");
            return;
        }
    };
    for b in dpop_sk.iter_mut() {
        *b = 0;
    }
    let resp = match http
        .post(BAKED_REVOKE)
        .header("DPoP", proof)
        .form(&[
            ("token", refresh),
            ("token_type_hint", "refresh_token"),
            ("client_id", client.client_id()),
        ])
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[STEP] native_oidc_revoke_fail reason=network err={e}");
            return;
        }
    };
    let status = resp.status();
    if let Err(reason) = discard_body(resp, OIDC_HTTP_MAX_BYTES).await {
        eprintln!(
            "[STEP] native_oidc_revoke_fail reason={reason} http={}",
            status.as_u16()
        );
        return;
    }
    if status.is_success() {
        eprintln!(
            "[STEP] native_oidc_revoke_ok client={} http={}",
            client.client_id(),
            status.as_u16()
        );
    } else {
        eprintln!(
            "[STEP] native_oidc_revoke_fail client={} http={}",
            client.client_id(),
            status.as_u16()
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_response_refresh_is_not_on_command_view() {
        let src = include_str!("token.rs");
        assert!(src.contains("refresh_token"));
        let view_src = include_str!("mod.rs");
        let view = view_src
            .split("pub struct NativeOidcCommandView")
            .nth(1)
            .unwrap()
            .split("impl NativeOidcCommandView")
            .next()
            .unwrap();
        assert!(!view.contains("refresh"));
        let src = include_str!("token.rs");
        let logout = src
            .split("pub async fn logout_session")
            .nth(1)
            .unwrap_or("");
        assert!(logout.contains("BAKED_REVOKE"));
        assert!(logout.contains("token_type_hint"));
        assert!(logout.contains("native_oidc_revoke_ok"));
        assert!(logout.contains("native_oidc_revoke_fail"));
        assert!(!logout.contains("BAKED_LOGOUT"));
        let _ = TokenResponse {
            access_token: None,
            id_token: None,
            refresh_token: None,
            expires_in: None,
            error: None,
        };
    }
}
