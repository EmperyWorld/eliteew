// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Operation-specific native OIDC Tauri commands (start/complete/refresh/logout).
// Invariants:
// - Main window only; product WebView ACL must not include these commands.
// - Typed NativeOidcClient only — no caller URL / generic signer.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 2
// ---

use tauri::{AppHandle, Manager, Window};

use crate::caller_context::require_main_window;
use crate::native_oidc::hub_login;
use crate::native_oidc::prepare::{prepare_native_oidc, PrepareOutcome};
use crate::native_oidc::product_bridge;
use crate::native_oidc::token::{exchange_authorization_code, logout_session, refresh_access_token};
use crate::native_oidc::transaction;
use crate::native_oidc::urls;
use crate::native_oidc::{NativeOidcClient, NativeOidcCommandView};

fn app_data_and_id(app: &AppHandle) -> Result<(std::path::PathBuf, String), NativeOidcCommandView> {
    let data = app.path().app_data_dir().map_err(|_| NativeOidcCommandView::generic_deny())?;
    let id = app.config().identifier.clone();
    Ok((data, id))
}

#[tauri::command]
pub async fn native_oidc_start(
    app: AppHandle,
    window: Window,
    client: NativeOidcClient,
    license_id: Option<String>,
    device_id: Option<String>,
) -> Result<NativeOidcCommandView, String> {
    require_main_window(&window)?;
    let (data, app_id) = match app_data_and_id(&app) {
        Ok(v) => v,
        Err(v) => return Ok(v),
    };
    match prepare_native_oidc(
        &data,
        &app_id,
        client,
        license_id.as_deref().unwrap_or(""),
        device_id.as_deref(),
        true,
        false,
    )
    .await
    {
        PrepareOutcome::Ready {
            authorization_url,
            transaction_id,
            dpop_jkt,
        } => Ok(NativeOidcCommandView {
            ok: true,
            code: "ok".into(),
            message: String::new(),
            authorization_url: Some(authorization_url),
            transaction_id: Some(transaction_id),
            dpop_jkt: Some(dpop_jkt),
            access_token: None,
            id_token: None,
            expires_in: None,
        }),
        PrepareOutcome::Denied { message } => Ok(NativeOidcCommandView::deny(
            "auth_policy_denied",
            message,
        )),
    }
}

#[tauri::command]
pub async fn native_oidc_complete(
    app: AppHandle,
    window: Window,
    client: NativeOidcClient,
    callback_url: String,
    transaction_id: String,
) -> Result<NativeOidcCommandView, String> {
    require_main_window(&window)?;
    let (data, app_id) = match app_data_and_id(&app) {
        Ok(v) => v,
        Err(v) => return Ok(v),
    };
    if !client.allowed_for_app_identifier(&app_id) {
        eprintln!("[STEP] native_oidc_complete_deny reason=client_edition_conflict");
        return Ok(NativeOidcCommandView::generic_deny());
    }
    let tx_id = transaction_id.trim();
    let Some(tx) = transaction::take(tx_id) else {
        eprintln!("[STEP] native_oidc_complete_deny reason=transaction_missing");
        return Ok(NativeOidcCommandView::generic_deny());
    };
    if tx.client_id != client.client_id() || tx.channel != client.channel() {
        eprintln!("[STEP] native_oidc_complete_deny reason=client_mismatch");
        return Ok(NativeOidcCommandView::generic_deny());
    }
    if tx.nonce.is_empty() || tx.pkce_challenge.is_empty() {
        eprintln!("[STEP] native_oidc_complete_deny reason=transaction_incomplete");
        return Ok(NativeOidcCommandView::generic_deny());
    }
    let _ticket_for_wave3 = tx.ticket.as_deref();
    let code = match urls::parse_callback_code(&callback_url, &tx.redirect_uri, &tx.state) {
        Ok(c) => c,
        Err(reason) => {
            eprintln!("[STEP] native_oidc_complete_deny reason={reason}");
            return Ok(NativeOidcCommandView::generic_deny());
        }
    };
    let view = exchange_authorization_code(
        &data,
        Some(&app_id),
        client,
        &code,
        &tx.redirect_uri,
        &tx.pkce_verifier,
        tx.dpop_jkt,
    )
    .await;
    if view.ok {
        product_bridge::push_bridge_into_product_if_open(&app, client);
    }
    Ok(view)
}

#[tauri::command]
pub async fn native_oidc_refresh(
    app: AppHandle,
    window: Window,
    client: NativeOidcClient,
) -> Result<NativeOidcCommandView, String> {
    require_main_window(&window)?;
    let (data, app_id) = match app_data_and_id(&app) {
        Ok(v) => v,
        Err(v) => return Ok(v),
    };
    if !client.allowed_for_app_identifier(&app_id) {
        return Ok(NativeOidcCommandView::generic_deny());
    }
    let view = refresh_access_token(&data, Some(&app_id), client).await;
    if view.ok {
        product_bridge::push_bridge_into_product_if_open(&app, client);
    }
    Ok(view)
}

#[tauri::command]
pub async fn native_oidc_interactive_login(
    app: AppHandle,
    window: Window,
    client: NativeOidcClient,
    license_id: Option<String>,
    device_id: Option<String>,
) -> Result<NativeOidcCommandView, String> {
    require_main_window(&window)?;
    let (data, app_id) = match app_data_and_id(&app) {
        Ok(v) => v,
        Err(v) => return Ok(v),
    };
    Ok(hub_login::interactive_login(
        &app,
        &data,
        &app_id,
        client,
        license_id.as_deref().unwrap_or(""),
        device_id.as_deref(),
    )
    .await)
}

#[tauri::command]
pub async fn native_oidc_logout(
    app: AppHandle,
    window: Window,
    client: NativeOidcClient,
) -> Result<NativeOidcCommandView, String> {
    require_main_window(&window)?;
    let (data, app_id) = match app_data_and_id(&app) {
        Ok(v) => v,
        Err(v) => return Ok(v),
    };
    if !client.allowed_for_app_identifier(&app_id) {
        return Ok(NativeOidcCommandView::generic_deny());
    }
    let view = logout_session(&data, Some(&app_id), client).await;
    product_bridge::push_bridge_into_product_if_open(&app, client);
    Ok(view)
}

#[cfg(test)]
mod tests {
    #[test]
    fn privileged_native_oidc_requires_main_window() {
        let src = include_str!("native_oidc.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        for name in [
            "native_oidc_start",
            "native_oidc_complete",
            "native_oidc_refresh",
            "native_oidc_logout",
            "native_oidc_interactive_login",
        ] {
            let needle = format!("pub async fn {name}");
            let idx = prod.find(&needle).unwrap_or_else(|| panic!("missing {name}"));
            let slice = &prod[idx..];
            assert!(slice.contains("require_main_window"), "{name} must check caller");
            assert!(slice.contains("window: Window"), "{name} must take Window");
        }
        let start = prod.split("pub async fn native_oidc_start").nth(1).unwrap();
        let start_fn = start.split("pub async fn native_oidc_complete").next().unwrap();
        assert!(
            !start_fn.contains("latest_for_client"),
            "start must re-run prepare (edition + ticket) every time"
        );
    }
}
