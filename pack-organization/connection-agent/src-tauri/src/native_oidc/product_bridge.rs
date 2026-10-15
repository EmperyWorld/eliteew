// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Host-inject `window.EmperyDesktopNativeOidc` into the product WebView.
// Invariants:
// - Product capability must not include native_oidc_start/complete/refresh/logout.
// - Inject script origin-guards Connected vs FoFline; refresh token never in JSON.
// - Empty bootstrap keeps living browser PKCE (SPA requires an access token).
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.4
// ---

use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::native_oidc::session_cache;
use crate::native_oidc::token::refresh_access_token;
use crate::native_oidc::{generic_user_message, NativeOidcClient, NativeOidcCommandView};

pub const PRODUCT_SESSION_REFRESH_CMD: &str = "product_session_refresh";
pub const PRODUCT_SESSION_LOGOUT_CMD: &str = "product_session_logout";
pub const BRIDGE_OBJECT_NAME: &str = "EmperyDesktopNativeOidc";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProductSessionBridgeView {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl ProductSessionBridgeView {
    pub fn generic_deny() -> Self {
        Self {
            ok: false,
            token: None,
            id_token: None,
            error: Some(generic_user_message().to_string()),
        }
    }

    pub fn empty() -> Self {
        Self {
            ok: false,
            token: None,
            id_token: None,
            error: None,
        }
    }

    pub fn from_tokens(access: &str, id_token: Option<&str>) -> Self {
        let token = access.trim();
        if token.is_empty() {
            return Self::empty();
        }
        Self {
            ok: true,
            token: Some(token.to_string()),
            id_token: id_token
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            error: None,
        }
    }
}

pub fn bootstrap_json(view: &ProductSessionBridgeView) -> String {
    serde_json::to_string(view).unwrap_or_else(|_| r#"{"ok":false}"#.into())
}

pub fn cached_bootstrap_json(client: NativeOidcClient) -> String {
    match session_cache::unexpired(client) {
        Some(cached) => bootstrap_json(&ProductSessionBridgeView::from_tokens(
            &cached.access,
            cached.id_token.as_deref(),
        )),
        None => bootstrap_json(&ProductSessionBridgeView::empty()),
    }
}

fn view_from_command(view: &NativeOidcCommandView) -> ProductSessionBridgeView {
    if view.ok {
        if let Some(access) = view.access_token.as_deref() {
            return ProductSessionBridgeView::from_tokens(access, view.id_token.as_deref());
        }
    }
    ProductSessionBridgeView::generic_deny()
}

pub async fn bootstrap_for_open(
    app_data: &Path,
    app_identifier: Option<&str>,
    client: NativeOidcClient,
) -> String {
    session_cache::set_last_product_client(client);
    if let Some(cached) = session_cache::unexpired(client) {
        return bootstrap_json(&ProductSessionBridgeView::from_tokens(
            &cached.access,
            cached.id_token.as_deref(),
        ));
    }
    let refreshed = refresh_access_token(app_data, app_identifier, client).await;
    if refreshed.ok {
        return bootstrap_json(&view_from_command(&refreshed));
    }
    eprintln!("[STEP] product_session_bridge_skip reason=no_native_session");
    bootstrap_json(&ProductSessionBridgeView::empty())
}

pub async fn refresh_for_product(
    app_data: &Path,
    app_identifier: Option<&str>,
    client: NativeOidcClient,
) -> ProductSessionBridgeView {
    let refreshed = refresh_access_token(app_data, app_identifier, client).await;
    if refreshed.ok {
        view_from_command(&refreshed)
    } else {
        session_cache::clear_client(client);
        ProductSessionBridgeView::generic_deny()
    }
}

/// Origin-guarded inject. Runs on product main frame before page scripts.
pub fn initialization_script(client: NativeOidcClient, bootstrap_json: &str) -> String {
    let parsed = serde_json::from_str::<serde_json::Value>(bootstrap_json)
        .ok()
        .filter(|v| v.is_object());
    let bootstrap = match parsed {
        Some(v) => serde_json::to_string(&v).unwrap_or_else(|_| r#"{"ok":false}"#.into()),
        None => r#"{"ok":false}"#.to_string(),
    };
    let bootstrap = if bootstrap.contains("refreshToken") || bootstrap.contains("refresh_token") {
        eprintln!("[STEP] product_session_bridge_deny reason=refresh_in_bootstrap");
        r#"{"ok":false}"#.to_string()
    } else {
        bootstrap
    };
    let kind = serde_json::to_string(client.channel()).unwrap_or_else(|_| "\"desktop\"".into());
    format!(
        r#"(function(){{
try {{
  var loc = window.location;
  var kind = {kind};
  var allowed = false;
  if (kind === "fofline") {{
    allowed = loc.protocol === "fofline-spa:" ||
      String(loc.hostname || "").toLowerCase() === "fofline-spa.localhost";
  }} else {{
    allowed = loc.origin === "https://app.eliteew.ru" &&
      loc.pathname !== "/fofline-oidc-bridge.html";
  }}
  if (!allowed) {{ return; }}
  var GENERIC = "Authentication could not be completed";
  window.__ELITEEW_PRODUCT_SESSION_BOOTSTRAP__ = {bootstrap};
  function sanitize(raw) {{
    var o = {{}};
    try {{
      o = typeof raw === "string" ? JSON.parse(raw) : (raw && typeof raw === "object" ? raw : {{}});
    }} catch (e) {{
      return JSON.stringify({{ok:false,error:GENERIC}});
    }}
    delete o.refreshToken;
    delete o.refresh_token;
    delete o.authorizationUrl;
    delete o.authorization_url;
    delete o.dpopJkt;
    delete o.dpop_jkt;
    delete o.transactionId;
    delete o.transaction_id;
    if (!o.token && o.accessToken) {{ o.token = o.accessToken; }}
    delete o.accessToken;
    if (o.ok && o.token) {{
      window.__ELITEEW_PRODUCT_SESSION_BOOTSTRAP__ = o;
    }}
    if (!o.ok && !o.error) {{ o.error = GENERIC; }}
    return JSON.stringify(o);
  }}
  function invokeRefresh() {{
    var internals = window.__TAURI_INTERNALS__;
    if (!internals || typeof internals.invoke !== "function") {{
      return Promise.resolve(JSON.stringify({{ok:false,error:GENERIC}}));
    }}
    return Promise.resolve(internals.invoke("{cmd}")).then(sanitize).catch(function(){{
      return JSON.stringify({{ok:false,error:GENERIC}});
    }});
  }}
  function invokeLogout() {{
    var internals = window.__TAURI_INTERNALS__;
    if (!internals || typeof internals.invoke !== "function") {{
      return Promise.resolve(JSON.stringify({{ok:false,error:GENERIC}}));
    }}
    return Promise.resolve(internals.invoke("{logout_cmd}")).then(function(raw){{
      window.__ELITEEW_PRODUCT_SESSION_BOOTSTRAP__ = {{ok:false}};
      return sanitize(raw);
    }}).catch(function(){{
      window.__ELITEEW_PRODUCT_SESSION_BOOTSTRAP__ = {{ok:false}};
      return JSON.stringify({{ok:false,error:GENERIC}});
    }});
  }}
  window.{bridge} = {{
    getBootstrapJson: function() {{
      try {{
        var b = window.__ELITEEW_PRODUCT_SESSION_BOOTSTRAP__;
        return typeof b === "string" ? b : JSON.stringify(b || {{ok:false}});
      }} catch (e) {{
        return JSON.stringify({{ok:false}});
      }}
    }},
    refreshSessionJson: function() {{ return invokeRefresh(); }},
    logoutSessionJson: function() {{ return invokeLogout(); }}
  }};
}} catch (e) {{}}
}})();"#,
        kind = kind,
        bootstrap = bootstrap,
        cmd = PRODUCT_SESSION_REFRESH_CMD,
        logout_cmd = PRODUCT_SESSION_LOGOUT_CMD,
        bridge = BRIDGE_OBJECT_NAME,
    )
}

pub fn push_bridge_into_product_if_open(app: &AppHandle, client: NativeOidcClient) {
    session_cache::set_last_product_client(client);
    let Some(webview) = app.get_webview_window("product") else {
        return;
    };
    let script = initialization_script(client, &cached_bootstrap_json(client));
    if let Err(e) = webview.eval(&script) {
        eprintln!("[STEP] product_session_bridge_eval_skip err={e}");
    } else {
        eprintln!("[STEP] product_session_bridge_eval ok");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bootstrap_json_omits_refresh_and_dpop() {
        let src = include_str!("product_bridge.rs");
        let view = src
            .split("pub struct ProductSessionBridgeView")
            .nth(1)
            .unwrap()
            .split("impl ProductSessionBridgeView")
            .next()
            .unwrap();
        assert!(!view.contains("refresh"));
        assert!(!view.contains("dpop"));
        assert!(!view.contains("authorization"));
        let json = bootstrap_json(&ProductSessionBridgeView::from_tokens("tok", Some("id")));
        assert!(json.contains("\"token\":\"tok\""));
        assert!(json.contains("\"idToken\":\"id\""));
        assert!(!json.contains("refresh"));
    }

    #[test]
    fn inject_script_is_origin_guarded_and_uses_product_session_cmd() {
        let script = initialization_script(
            NativeOidcClient::EmperyDesktop,
            r#"{"ok":true,"token":"abc","idToken":"id"}"#,
        );
        assert!(script.contains("EmperyDesktopNativeOidc"));
        assert!(script.contains("https://app.eliteew.ru"));
        assert!(script.contains("/fofline-oidc-bridge.html"));
        assert!(script.contains("product_session_refresh"));
        assert!(script.contains("product_session_logout"));
        assert!(script.contains("logoutSessionJson"));
        assert!(!script.contains("native_oidc_"));
        assert!(script.contains("delete o.refresh_token"));
        let fofline = initialization_script(NativeOidcClient::EmperyFofline, r#"{"ok":false}"#);
        assert!(fofline.contains("fofline-spa:"));
        assert!(fofline.contains("fofline-spa.localhost"));
    }

    #[test]
    fn inject_script_rejects_refresh_in_bootstrap() {
        let script = initialization_script(
            NativeOidcClient::EmperyDesktop,
            r#"{"ok":true,"token":"abc","refreshToken":"nope"}"#,
        );
        assert!(!script.contains("nope"));
        assert!(script.contains(r#"{"ok":false}"#));
    }
}
