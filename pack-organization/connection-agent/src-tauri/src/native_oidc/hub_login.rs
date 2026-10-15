// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Hub interactive native OIDC: refresh-or-auth-window → complete into keyring.
// Invariants:
// - Main-window only; auth WebView has no product ACL.
// - Navigation allowlist: HTTPS IdP host + about:blank* + Tauri ipc.localhost /
//   tauri.localhost bootstrap. Any https://app.eliteew.ru without code+state is not
//   loaded as SPA. Never navigate the same PAR request_uri (WebKit POST replay).
//   Empty / hidden / WebAuthn auto POST is blocked on Linux at WebKit submit-form
//   (fail-closed on empty field list) and at document-start `prototype.submit`.
//   error.ftl / Back-to-application rebuilds oidc-auth once with a fresh PAR GET.
// - Leftover oidc-auth is destroyed before recreate so a stale Destroyed cannot cancel
//   the new login.
// - oidc-auth uses W-transport SOCKS when the product does (fail-closed) and incognito
//   so leftover WebKit cookies cannot skip or poison the login form.
// - Does not put native_oidc_* on product.json.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.9 / §9.13 / §9.14
// ---

use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

use crate::native_oidc::linux_form_gate;
use crate::native_oidc::prepare::{prepare_native_oidc, PrepareOutcome};
use crate::native_oidc::product_bridge;
use crate::native_oidc::token::{exchange_authorization_code, refresh_access_token};
use crate::native_oidc::transaction;
use crate::native_oidc::urls;
use crate::native_oidc::{NativeOidcClient, NativeOidcCommandView};
use crate::wg::userspace::{w_transport_enabled, w_transport_proxy_url};

pub const AUTH_WINDOW_LABEL: &str = "oidc-auth";
const AUTH_TIMEOUT: Duration = Duration::from_secs(300);
static AUTH_GENERATION: AtomicU64 = AtomicU64::new(0);

fn redact_nav_url(url: &Url) -> String {
    format!(
        "{}://{}{}",
        url.scheme(),
        url.host_str().unwrap_or(""),
        url.path()
    )
}

fn is_about_blank(url: &Url) -> bool {
    url.scheme() == "about" && url.as_str().starts_with("about:blank")
}

/// Tauri 2 IPC / custom-protocol bootstrap used as a top-level navigation before the IdP URL.
/// Exact host/scheme only — not a product origin.
fn is_tauri_webview_bootstrap_url(url: &Url) -> bool {
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    if let Some(port) = url.port() {
        if port != 80 && port != 443 {
            return false;
        }
    }
    let scheme = url.scheme();
    let host = url.host_str().unwrap_or("").to_ascii_lowercase();
    if scheme == "ipc" {
        return host.is_empty() || host == "localhost" || host == "ipc.localhost";
    }
    if scheme == "tauri" {
        return host.is_empty() || host == "localhost";
    }
    let bootstrap_host = host == "ipc.localhost" || host == "tauri.localhost";
    (scheme == "http" || scheme == "https") && bootstrap_host
}

fn navigation_allowed_for_oidc_auth(url: &Url, _redirect_uri: &str) -> bool {
    let scheme = url.scheme();
    if scheme == "javascript" || scheme == "data" || scheme == "blob" || scheme == "file" {
        return false;
    }
    if is_about_blank(url) {
        return true;
    }
    if is_tauri_webview_bootstrap_url(url) {
        return true;
    }
    if scheme != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    if url.port().is_some() || !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    let host_l = host.to_ascii_lowercase();
    if host_l == "auth.eliteew.ru" || host_l.ends_with(".auth.eliteew.ru") {
        return true;
    }
    false
}

/// Baked product origin (Connected rootUrl and FoFline SPA). Not a login.
fn is_baked_product_host(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    if url.port().is_some() || !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    url.host_str() == Some("app.eliteew.ru")
}

fn oidc_auth_query_flags(url: &Url) -> (bool, bool) {
    let mut has_code = false;
    let mut has_state = false;
    for (k, v) in url.query_pairs() {
        if k == "code" && !v.trim().is_empty() {
            has_code = true;
        }
        if k == "state" && !v.trim().is_empty() {
            has_state = true;
        }
    }
    (has_code, has_state)
}

enum AuthWaitMsg {
    Callback(String),
    FreshPar,
    Cancelled,
}

/// Document-start defense: Keycloak login.ftl WebAuthn calls `form.submit()` on a
/// hidden form during parse/DOMContentLoaded. That path skips the DOM `submit`
/// event and often skips WebKit `submit-form`. Stub `prototype.submit` immediately
/// (not after DOMContentLoaded, not only `#kc-form-login`). Password login only.
fn oidc_auth_manual_login_script() -> &'static str {
    r##"(function(){
if (window.__eliteewManualLoginGuard) return;
window.__eliteewManualLoginGuard = true;
try {
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    enumerable: false,
    get: function () { return undefined; },
    set: function () {}
  });
} catch (e) {
  try { window.PublicKeyCredential = undefined; } catch (e2) {}
}
function isForm(form) {
  return !!(form && form.tagName && String(form.tagName).toLowerCase() === "form");
}
function isLoginForm(form) {
  if (!isForm(form)) return false;
  if (form.id === "kc-form-login") return true;
  return !!(form.querySelector("#username, input[name='username']") &&
    form.querySelector("#password, input[name='password']"));
}
function isWebAuthnForm(form) {
  if (!isForm(form)) return false;
  var id = String(form.id || "").toLowerCase();
  if (id.indexOf("webauth") !== -1) return true;
  if (form.querySelector("input[name='clientDataJSON'], input[name='authenticatorData'], input[name='signature']")) {
    return !form.querySelector("#password, input[name='password']");
  }
  return false;
}
function isOtpForm(form) {
  return !!(isForm(form) && form.querySelector("input[name='otp']") &&
    !form.querySelector("#password, input[name='password']"));
}
function filled(form) {
  var user = form.querySelector("#username, input[name='username']");
  var pass = form.querySelector("#password, input[name='password']");
  var userVal = user ? String(user.value || "").trim() : "";
  var passVal = pass ? String(pass.value || "") : "";
  return !!(userVal && passVal);
}
function shouldBlock(form) {
  if (isWebAuthnForm(form)) return true;
  if (isLoginForm(form) && !filled(form)) return true;
  if (isOtpForm(form)) {
    var otp = form.querySelector("input[name='otp']");
    return !(otp && String(otp.value || "").trim());
  }
  if (isLoginForm(form) || String(form.getAttribute("action") || "").indexOf("login-actions/authenticate") !== -1) {
    return !filled(form) && !isOtpForm(form);
  }
  return false;
}
var origSubmit = HTMLFormElement.prototype.submit;
HTMLFormElement.prototype.submit = function () {
  if (shouldBlock(this)) return;
  return origSubmit.apply(this, arguments);
};
if (typeof HTMLFormElement.prototype.requestSubmit === "function") {
  var origRequestSubmit = HTMLFormElement.prototype.requestSubmit;
  HTMLFormElement.prototype.requestSubmit = function () {
    if (shouldBlock(this)) return;
    return origRequestSubmit.apply(this, arguments);
  };
}
document.addEventListener("submit", function (ev) {
  var form = ev.target;
  if (!isForm(form)) return;
  if (shouldBlock(form)) {
    ev.preventDefault();
    ev.stopPropagation();
  }
}, true);
})();"##
}

fn redirect_path_matches(url: &Url, redirect_uri: &str) -> bool {
    let Ok(redirect) = Url::parse(redirect_uri) else {
        return false;
    };
    url.scheme() == redirect.scheme()
        && url.host_str() == redirect.host_str()
        && url.path().trim_end_matches('/') == redirect.path().trim_end_matches('/')
}

async fn destroy_existing_auth_window(app: &AppHandle) {
    let Some(existing) = app.get_webview_window(AUTH_WINDOW_LABEL) else {
        return;
    };
    let (done_tx, done_rx) = mpsc::sync_channel(1);
    let _ = existing.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            let _ = done_tx.try_send(());
        }
    });
    eprintln!("[STEP] native_oidc_auth_window_replace");
    match existing.destroy() {
        Ok(()) => {}
        Err(e) => {
            eprintln!("[STEP] native_oidc_auth_window_replace_fail err={e}");
            let _ = existing.close();
        }
    }
    let _ = tauri::async_runtime::spawn_blocking(move || {
        let _ = done_rx.recv_timeout(Duration::from_millis(400));
    })
    .await;
}

fn is_callback_url(url: &Url, redirect_uri: &str, expected_state: &str) -> bool {
    if !redirect_path_matches(url, redirect_uri) {
        return false;
    }
    let mut has_code = false;
    let mut state_ok = false;
    for (k, v) in url.query_pairs() {
        if k == "code" && !v.trim().is_empty() {
            has_code = true;
        }
        if k == "state" && v.as_ref() == expected_state {
            state_ok = true;
        }
    }
    has_code && state_ok
}

fn auth_url_is_baked(authorization_url: &str) -> bool {
    let Ok(u) = Url::parse(authorization_url) else {
        return false;
    };
    let Ok(baked) = Url::parse(urls::BAKED_AUTH) else {
        return false;
    };
    u.scheme() == "https"
        && u.host_str() == baked.host_str()
        && u.path().trim_end_matches('/') == baked.path().trim_end_matches('/')
}

async fn open_oidc_auth_window(
    app: &AppHandle,
    auth_url: Url,
    redirect_uri: String,
    expected_state: String,
    applied_proxy: Option<Url>,
    auth_generation: u64,
    cb_tx: mpsc::SyncSender<AuthWaitMsg>,
    fresh_budget: Arc<AtomicU8>,
) -> Result<(), String> {
    let redirect_for_nav = redirect_uri.clone();
    let cb_tx_nav = cb_tx.clone();
    let app_for_nav = app.clone();
    let expected_state_nav = expected_state.clone();
    let fresh_budget_nav = Arc::clone(&fresh_budget);
    let fresh_budget_page = Arc::clone(&fresh_budget);
    let cb_tx_page = cb_tx.clone();

    let mut builder = WebviewWindowBuilder::new(app, AUTH_WINDOW_LABEL, WebviewUrl::External(auth_url))
        .title("EliteEW sign-in")
        .inner_size(520.0, 720.0)
        .incognito(true)
        .initialization_script(oidc_auth_manual_login_script())
        .on_navigation(move |nav_url| {
            if is_callback_url(nav_url, &redirect_for_nav, &expected_state_nav) {
                eprintln!(
                    "[STEP] oidc_auth_nav url={} allowed=callback",
                    redact_nav_url(nav_url)
                );
                let _ = cb_tx_nav.try_send(AuthWaitMsg::Callback(nav_url.as_str().to_string()));
                if let Some(win) = app_for_nav.get_webview_window(AUTH_WINDOW_LABEL) {
                    let _ = win.hide();
                }
                return false;
            }
            if is_baked_product_host(nav_url) {
                let (has_code, has_state) = oidc_auth_query_flags(nav_url);
                if has_code {
                    eprintln!(
                        "[STEP] oidc_auth_nav_deny url={} reason=callback_state_mismatch has_code=1 has_state={}",
                        redact_nav_url(nav_url),
                        has_state as u8
                    );
                    return false;
                }
                let rebuild = fresh_budget_nav.swap(0, Ordering::SeqCst) == 1;
                eprintln!(
                    "[STEP] oidc_auth_nav_deny url={} reason=product_without_code has_code=0 has_state={} rebuild={}",
                    redact_nav_url(nav_url),
                    has_state as u8,
                    rebuild as u8
                );
                if rebuild {
                    let _ = cb_tx_nav.try_send(AuthWaitMsg::FreshPar);
                }
                return false;
            }
            let allowed = navigation_allowed_for_oidc_auth(nav_url, &redirect_for_nav);
            eprintln!(
                "[STEP] oidc_auth_nav url={} allowed={}",
                redact_nav_url(nav_url),
                allowed
            );
            allowed
        })
        .on_page_load(move |window, payload| {
            if payload.event() != PageLoadEvent::Finished {
                return;
            }
            if !linux_form_gate::is_idp_form_uri(payload.url().as_str()) {
                return;
            }
            let budget = Arc::clone(&fresh_budget_page);
            let tx = cb_tx_page.clone();
            let _ = window.eval_with_callback(
                linux_form_gate::error_page_detect_script(),
                move |raw| {
                    if !linux_form_gate::is_error_page_detect_result(&raw) {
                        return;
                    }
                    let rebuild = budget.swap(0, Ordering::SeqCst) == 1;
                    eprintln!(
                        "[STEP] oidc_auth_error_page rebuild={}",
                        rebuild as u8
                    );
                    if rebuild {
                        let _ = tx.try_send(AuthWaitMsg::FreshPar);
                    }
                },
            );
        });

    if let Some(proxy) = applied_proxy {
        builder = builder.proxy_url(proxy);
        eprintln!("[STEP] native_oidc_auth_window proxy_url applied");
    }

    builder
        .build()
        .map_err(|e| format!("{e}"))?;

    if let Some(win) = app.get_webview_window(AUTH_WINDOW_LABEL) {
        linux_form_gate::attach_oidc_auth_native_form_gate(&win);
        let cb_tx_close = cb_tx.clone();
        let _ = win.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                if AUTH_GENERATION.load(Ordering::SeqCst) == auth_generation {
                    let _ = cb_tx_close.try_send(AuthWaitMsg::Cancelled);
                }
            }
        });
    }
    Ok(())
}

/// Refresh existing keyring session, or open a short-lived auth WebView and complete.
pub async fn interactive_login(
    app: &AppHandle,
    app_data: &std::path::Path,
    app_id: &str,
    client: NativeOidcClient,
    license_id: &str,
    device_id: Option<&str>,
) -> NativeOidcCommandView {
    if !client.allowed_for_app_identifier(app_id) {
        eprintln!("[STEP] native_oidc_interactive_deny reason=client_edition_conflict");
        return NativeOidcCommandView::generic_deny();
    }

    let refreshed = refresh_access_token(app_data, Some(app_id), client).await;
    if refreshed.ok {
        eprintln!(
            "[STEP] native_oidc_interactive_refresh_ok client={}",
            client.client_id()
        );
        product_bridge::push_bridge_into_product_if_open(app, client);
        return refreshed;
    }

    let prepared = prepare_native_oidc(
        app_data,
        app_id,
        client,
        license_id,
        device_id,
        true,
        true,
    )
    .await;
    let (authorization_url, mut transaction_id) = match prepared {
        PrepareOutcome::Ready {
            authorization_url,
            transaction_id,
            dpop_jkt: _,
        } => (authorization_url, transaction_id),
        PrepareOutcome::Denied { message } => {
            return NativeOidcCommandView::deny("auth_policy_denied", message);
        }
    };

    let Some(tx_peek) = transaction::get(&transaction_id) else {
        eprintln!("[STEP] native_oidc_interactive_deny reason=transaction_missing_after_prepare");
        return NativeOidcCommandView::generic_deny();
    };
    let mut expected_state = tx_peek.state.clone();
    let mut redirect_uri = tx_peek.redirect_uri.clone();
    drop(tx_peek);
    if !auth_url_is_baked(&authorization_url) {
        eprintln!("[STEP] native_oidc_interactive_deny reason=auth_url_not_baked");
        let _ = transaction::take(&transaction_id);
        return NativeOidcCommandView::generic_deny();
    }

    let auth_url = match Url::parse(&authorization_url) {
        Ok(u) => u,
        Err(_) => {
            let _ = transaction::take(&transaction_id);
            return NativeOidcCommandView::generic_deny();
        }
    };

    let mut applied_proxy: Option<Url> = None;
    if w_transport_enabled() {
        let plan = w_transport_proxy_url();
        match plan.proxy_url.filter(|_| plan.fail_closed) {
            Some(proxy) => match proxy.parse::<Url>() {
                Ok(u) => applied_proxy = Some(u),
                Err(e) => {
                    eprintln!("[STEP] native_oidc_interactive_deny reason=proxy_url err={e}");
                    let _ = transaction::take(&transaction_id);
                    return NativeOidcCommandView::generic_deny();
                }
            },
            None => {
                eprintln!("[STEP] native_oidc_interactive_deny reason=w_transport_proxy_required");
                let _ = transaction::take(&transaction_id);
                return NativeOidcCommandView::generic_deny();
            }
        }
    }

    let mut auth_generation = AUTH_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    destroy_existing_auth_window(app).await;

    let (cb_tx, cb_rx) = mpsc::sync_channel::<AuthWaitMsg>(4);
    let cb_rx = Arc::new(Mutex::new(cb_rx));
    let fresh_budget = Arc::new(AtomicU8::new(1));
    if let Err(e) = open_oidc_auth_window(
        app,
        auth_url,
        redirect_uri.clone(),
        expected_state.clone(),
        applied_proxy.clone(),
        auth_generation,
        cb_tx.clone(),
        Arc::clone(&fresh_budget),
    )
    .await
    {
        eprintln!("[STEP] native_oidc_interactive_deny reason=auth_window_create err={e}");
        let _ = transaction::take(&transaction_id);
        return NativeOidcCommandView::generic_deny();
    }

    let deadline = Instant::now() + AUTH_TIMEOUT;
    let callback_url = loop {
        let left = deadline.saturating_duration_since(Instant::now());
        if left.is_zero() {
            eprintln!("[STEP] native_oidc_interactive_deny reason=auth_timeout_or_cancel");
            let _ = transaction::take(&transaction_id);
            if let Some(win) = app.get_webview_window(AUTH_WINDOW_LABEL) {
                let _ = win.close();
            }
            return NativeOidcCommandView::deny(
                "auth_policy_denied",
                "Sign-in was cancelled or timed out".to_string(),
            );
        }
        let rx = Arc::clone(&cb_rx);
        let msg = tauri::async_runtime::spawn_blocking(move || {
            rx.lock().unwrap_or_else(|e| e.into_inner()).recv_timeout(left)
        })
            .await
            .ok()
            .and_then(Result::ok);
        match msg {
            Some(AuthWaitMsg::Callback(u)) if !u.trim().is_empty() => break u,
            Some(AuthWaitMsg::FreshPar) => {
                eprintln!("[STEP] oidc_auth_window_rebuild reason=fresh_par");
                let _ = transaction::take(&transaction_id);
                auth_generation = AUTH_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
                destroy_existing_auth_window(app).await;
                let prepared = prepare_native_oidc(
                    app_data,
                    app_id,
                    client,
                    license_id,
                    device_id,
                    true,
                    true,
                )
                .await;
                let (authorization_url, new_tx_id) = match prepared {
                    PrepareOutcome::Ready {
                        authorization_url,
                        transaction_id: id,
                        dpop_jkt: _,
                    } => (authorization_url, id),
                    PrepareOutcome::Denied { message } => {
                        return NativeOidcCommandView::deny("auth_policy_denied", message);
                    }
                };
                transaction_id = new_tx_id;
                let Some(tx_peek) = transaction::get(&transaction_id) else {
                    eprintln!("[STEP] native_oidc_interactive_deny reason=transaction_missing_after_prepare");
                    return NativeOidcCommandView::generic_deny();
                };
                expected_state = tx_peek.state.clone();
                redirect_uri = tx_peek.redirect_uri.clone();
                drop(tx_peek);
                if !auth_url_is_baked(&authorization_url) {
                    eprintln!("[STEP] native_oidc_interactive_deny reason=auth_url_not_baked");
                    let _ = transaction::take(&transaction_id);
                    return NativeOidcCommandView::generic_deny();
                }
                let auth_url = match Url::parse(&authorization_url) {
                    Ok(u) => u,
                    Err(_) => {
                        let _ = transaction::take(&transaction_id);
                        return NativeOidcCommandView::generic_deny();
                    }
                };
                if let Err(e) = open_oidc_auth_window(
                    app,
                    auth_url,
                    redirect_uri.clone(),
                    expected_state.clone(),
                    applied_proxy.clone(),
                    auth_generation,
                    cb_tx.clone(),
                    Arc::clone(&fresh_budget),
                )
                .await
                {
                    eprintln!("[STEP] native_oidc_interactive_deny reason=auth_window_rebuild err={e}");
                    let _ = transaction::take(&transaction_id);
                    return NativeOidcCommandView::generic_deny();
                }
            }
            _ => {
                eprintln!("[STEP] native_oidc_interactive_deny reason=auth_timeout_or_cancel");
                let _ = transaction::take(&transaction_id);
                if let Some(win) = app.get_webview_window(AUTH_WINDOW_LABEL) {
                    let _ = win.close();
                }
                return NativeOidcCommandView::deny(
                    "auth_policy_denied",
                    "Sign-in was cancelled or timed out".to_string(),
                );
            }
        }
    };

    if let Some(win) = app.get_webview_window(AUTH_WINDOW_LABEL) {
        let _ = win.close();
    }

    let Some(tx) = transaction::take(&transaction_id) else {
        eprintln!("[STEP] native_oidc_interactive_deny reason=transaction_missing");
        return NativeOidcCommandView::generic_deny();
    };
    if tx.client_id != client.client_id() || tx.channel != client.channel() {
        return NativeOidcCommandView::generic_deny();
    }
    if tx.nonce.is_empty() || tx.pkce_challenge.is_empty() {
        eprintln!("[STEP] native_oidc_interactive_deny reason=transaction_incomplete");
        return NativeOidcCommandView::generic_deny();
    }
    let code = match urls::parse_callback_code(&callback_url, &tx.redirect_uri, &tx.state) {
        Ok(c) => c,
        Err(reason) => {
            eprintln!("[STEP] native_oidc_interactive_deny reason={reason}");
            return NativeOidcCommandView::generic_deny();
        }
    };
    let view = exchange_authorization_code(
        app_data,
        Some(app_id),
        client,
        &code,
        &tx.redirect_uri,
        &tx.pkce_verifier,
        tx.dpop_jkt,
    )
    .await;
    if view.ok {
        eprintln!(
            "[STEP] native_oidc_interactive_complete_ok client={}",
            client.client_id()
        );
        product_bridge::push_bridge_into_product_if_open(app, client);
    }
    view
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn callback_detection_requires_code_and_state() {
        let redirect = "https://app.eliteew.ru/";
        let ok = Url::parse("https://app.eliteew.ru/?code=abc&state=s1").unwrap();
        assert!(is_callback_url(&ok, redirect, "s1"));
        let bad_state = Url::parse("https://app.eliteew.ru/?code=abc&state=other").unwrap();
        assert!(!is_callback_url(&bad_state, redirect, "s1"));
        let no_code = Url::parse("https://app.eliteew.ru/?state=s1").unwrap();
        assert!(!is_callback_url(&no_code, redirect, "s1"));
        let fofline = Url::parse(
            "https://app.eliteew.ru/fofline-oidc-bridge.html?code=abc&state=s1",
        )
        .unwrap();
        assert!(is_callback_url(
            &fofline,
            "https://app.eliteew.ru/fofline-oidc-bridge.html",
            "s1"
        ));
    }

    #[test]
    fn product_url_query_flags_distinguish_callback_from_back_to_app() {
        let back = Url::parse("https://app.eliteew.ru/").unwrap();
        assert_eq!(oidc_auth_query_flags(&back), (false, false));
        let mismatch = Url::parse("https://app.eliteew.ru/?code=abc&state=other").unwrap();
        assert_eq!(oidc_auth_query_flags(&mismatch), (true, true));
        assert!(!is_callback_url(&mismatch, "https://app.eliteew.ru/", "s1"));
        let script = oidc_auth_manual_login_script();
        assert!(script.contains("preventDefault"));
        assert!(script.contains("kc-form-login"));
        assert!(script.contains("filled(form)"));
        assert!(script.contains("HTMLFormElement.prototype.submit"));
        assert!(script.contains("PublicKeyCredential"));
        assert!(script.contains("isWebAuthnForm"));
        assert!(!script.contains("typed.username"));
        assert!(!script.contains("location.replace"));
        assert!(!script.contains("DOMContentLoaded"));
        assert!(!script.contains("form.submit = function () {}"));
        let src = include_str!("hub_login.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(prod.contains("oidc_auth_window_rebuild"));
        assert!(prod.contains("attach_oidc_auth_native_form_gate"));
        assert!(!prod.contains("oidc_auth_nav_retry"));
        assert!(!prod.contains(".navigate("));
    }

    #[test]
    fn auth_nav_denies_product_root_without_callback() {
        let redirect = "https://app.eliteew.ru/";
        let back_to_app = Url::parse("https://app.eliteew.ru/").unwrap();
        assert!(is_baked_product_host(&back_to_app));
        assert!(redirect_path_matches(&back_to_app, redirect));
        assert!(!is_callback_url(&back_to_app, redirect, "s1"));
        assert!(!navigation_allowed_for_oidc_auth(&back_to_app, redirect));
        let with_code = Url::parse("https://app.eliteew.ru/?code=x&state=s1").unwrap();
        assert!(is_callback_url(&with_code, redirect, "s1"));
        assert!(!navigation_allowed_for_oidc_auth(&with_code, redirect));
        let fofline_redirect = "https://app.eliteew.ru/fofline-oidc-bridge.html";
        let kc_back_to_app = Url::parse("https://app.eliteew.ru/").unwrap();
        assert!(is_baked_product_host(&kc_back_to_app));
        assert!(!redirect_path_matches(&kc_back_to_app, fofline_redirect));
        assert!(!is_callback_url(&kc_back_to_app, fofline_redirect, "s1"));
    }

    #[test]
    fn auth_nav_allows_idp_and_redirect_only() {
        let redirect = "https://app.eliteew.ru/";
        assert!(navigation_allowed_for_oidc_auth(
            &Url::parse("https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth")
                .unwrap(),
            redirect
        ));
        assert!(!navigation_allowed_for_oidc_auth(
            &Url::parse("https://app.eliteew.ru/?code=x&state=y").unwrap(),
            redirect
        ));
        assert!(!navigation_allowed_for_oidc_auth(
            &Url::parse("https://evil.example/").unwrap(),
            redirect
        ));
        assert!(navigation_allowed_for_oidc_auth(
            &Url::parse("about:blank#blocked").unwrap(),
            redirect
        ));
        assert!(navigation_allowed_for_oidc_auth(
            &Url::parse("http://ipc.localhost/").unwrap(),
            redirect
        ));
        assert!(navigation_allowed_for_oidc_auth(
            &Url::parse("https://ipc.localhost/").unwrap(),
            redirect
        ));
        assert!(navigation_allowed_for_oidc_auth(
            &Url::parse("ipc://localhost/").unwrap(),
            redirect
        ));
        assert!(navigation_allowed_for_oidc_auth(
            &Url::parse("https://tauri.localhost/").unwrap(),
            redirect
        ));
        assert!(navigation_allowed_for_oidc_auth(
            &Url::parse("http://tauri.localhost/").unwrap(),
            redirect
        ));
        assert!(navigation_allowed_for_oidc_auth(
            &Url::parse("tauri://localhost/").unwrap(),
            redirect
        ));
        assert!(!navigation_allowed_for_oidc_auth(
            &Url::parse("https://evil.tauri.localhost/").unwrap(),
            redirect
        ));
        assert!(!navigation_allowed_for_oidc_auth(
            &Url::parse("http://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth")
                .unwrap(),
            redirect
        ));
        assert!(!navigation_allowed_for_oidc_auth(
            &Url::parse("javascript:alert(1)").unwrap(),
            redirect
        ));
        assert!(!navigation_allowed_for_oidc_auth(
            &Url::parse("data:text/html,x").unwrap(),
            redirect
        ));
        assert!(!navigation_allowed_for_oidc_auth(
            &Url::parse("http://ipc.localhost:9000/").unwrap(),
            redirect
        ));
        assert!(!navigation_allowed_for_oidc_auth(
            &Url::parse("http://evil.ipc.localhost/").unwrap(),
            redirect
        ));
    }

    #[test]
    fn baked_auth_url_allows_query() {
        assert!(auth_url_is_baked(
            "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth?client_id=x&request_uri=y"
        ));
        assert!(!auth_url_is_baked("https://evil.example/auth"));
    }
}
