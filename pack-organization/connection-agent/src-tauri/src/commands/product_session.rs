// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Product-window session refresh/logout for the host-injected OIDC bridge.
// Invariants:
// - Product WebView only; no caller-supplied client / URL.
// - Never returns refresh token, DPoP, or authorization URL.
// - native_oidc_* stay main-window only (not these commands).
// - Logout wipes product browsing data (IdP cookies) then destroys the product
//   window after IPC returns — WebKit `close()` from the same WebView is a no-op.
// - `lib.rs` CloseRequested on Hub/product maps to tray quit (RFC 7009 revoke);
//   SPA logout still arms `PRODUCT_LOGOUT_CLOSING` so deferred `destroy()` is
//   not converted into a second app quit.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.4 / pre-Wave-7
// ---

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Manager, Window};

use crate::caller_context::require_product_window;
use crate::commands::product::wipe_product_webview;
use crate::native_oidc::product_bridge::{self, ProductSessionBridgeView};
use crate::native_oidc::session_cache;
use crate::native_oidc::token::logout_session;

/// Armed only while deferred product logout destroy runs (see `lib.rs` CloseRequested).
static PRODUCT_LOGOUT_CLOSING: AtomicBool = AtomicBool::new(false);

/// True while product logout may destroy the product window for real (not hide-to-tray).
pub fn is_product_logout_closing() -> bool {
    PRODUCT_LOGOUT_CLOSING.load(Ordering::SeqCst)
}

/// Clear only from `lib.rs` `Destroyed` on the product label — not after `destroy()` returns.
pub fn clear_product_logout_closing() {
    PRODUCT_LOGOUT_CLOSING.store(false, Ordering::SeqCst);
}

#[tauri::command]
pub async fn product_session_refresh(
    app: AppHandle,
    window: Window,
) -> Result<ProductSessionBridgeView, String> {
    require_product_window(&window)?;
    let Some(client) = session_cache::last_product_client() else {
        eprintln!("[STEP] product_session_refresh_deny reason=no_product_client");
        return Ok(ProductSessionBridgeView::generic_deny());
    };
    let data = match app.path().app_data_dir() {
        Ok(d) => d,
        Err(_) => return Ok(ProductSessionBridgeView::generic_deny()),
    };
    let app_id = app.config().identifier.clone();
    if !client.allowed_for_app_identifier(&app_id) {
        eprintln!("[STEP] product_session_refresh_deny reason=client_edition_conflict");
        return Ok(ProductSessionBridgeView::generic_deny());
    }
    Ok(product_bridge::refresh_for_product(&data, Some(&app_id), client).await)
}

/// Wipe cookies while the WebView still exists, then destroy it after this
/// IPC returns. Synchronous `Window::close` from the product WebView's own
/// command does not tear down WebKitGTK — the SPA then paints LoginPageFallback
/// and Keycloak SSO cookies can sign the same account back in.
fn finish_product_logout_close(app: &AppHandle) {
    crate::commands::video_call_meet_stage::close_meet_stage_if_open(app);
    crate::commands::ebrowser_stage::close_ebrowser_if_open(app);
    if let Err(e) = wipe_product_webview(app) {
        eprintln!("[STEP] product_session_logout_wipe_skip err={e}");
    }
    PRODUCT_LOGOUT_CLOSING.store(true, Ordering::SeqCst);
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(80));
        let app_main = app.clone();
        if let Err(e) = app.run_on_main_thread(move || {
            match app_main.get_webview_window("product") {
                Some(w) => match w.destroy() {
                    Ok(()) => {
                        eprintln!("[STEP] product_session_logout_close closed=true via=destroy")
                    }
                    Err(e) => {
                        eprintln!("[STEP] product_session_logout_close_fail err={e}")
                    }
                },
                None => {
                    eprintln!(
                        "[STEP] product_session_logout_close closed=false reason=no_product_window"
                    )
                }
            }
        }) {
            eprintln!("[STEP] product_session_logout_close_fail err={e}");
        }
    });
}

#[tauri::command]
pub async fn product_session_logout(
    app: AppHandle,
    window: Window,
) -> Result<ProductSessionBridgeView, String> {
    eprintln!("[STEP] product_session_logout_begin");
    require_product_window(&window)?;
    let Some(client) = session_cache::last_product_client() else {
        eprintln!("[STEP] product_session_logout_skip_keyring reason=no_product_client");
        finish_product_logout_close(&app);
        return Ok(ProductSessionBridgeView::empty());
    };
    let app_id = app.config().identifier.clone();
    if !client.allowed_for_app_identifier(&app_id) {
        eprintln!("[STEP] product_session_logout_deny reason=client_edition_conflict");
        finish_product_logout_close(&app);
        return Ok(ProductSessionBridgeView::generic_deny());
    }
    let data = match app.path().app_data_dir() {
        Ok(d) => d,
        Err(_) => {
            finish_product_logout_close(&app);
            return Ok(ProductSessionBridgeView::empty());
        }
    };
    let view = logout_session(&data, Some(&app_id), client).await;
    session_cache::clear_client(client);
    finish_product_logout_close(&app);
    if view.ok {
        Ok(ProductSessionBridgeView::empty())
    } else {
        Ok(ProductSessionBridgeView::generic_deny())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn product_session_commands_are_product_window_only() {
        let src = include_str!("product_session.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        for name in ["product_session_refresh", "product_session_logout"] {
            let needle = format!("pub async fn {name}");
            let idx = prod.find(&needle).unwrap_or_else(|| panic!("missing {name}"));
            let slice = &prod[idx..];
            assert!(slice.contains("require_product_window"), "{name} must check caller");
            assert!(!slice.contains("require_main_window"), "{name} must not be main-only");
            assert!(slice.contains("last_product_client"), "{name} must use last client");
            assert!(
                !slice.contains("client: NativeOidcClient"),
                "{name} must not take caller client"
            );
        }
        assert!(!prod.contains("native_oidc_logout"));
        assert!(prod.contains("wipe_product_webview"));
        assert!(prod.contains("w.destroy()"));
        assert!(prod.contains("product_session_logout_begin"));
        assert!(prod.contains("product_session_logout_close"));
        assert!(prod.contains("PRODUCT_LOGOUT_CLOSING"));
        assert!(prod.contains("is_product_logout_closing"));
        assert!(prod.contains("clear_product_logout_closing"));
        assert!(prod.contains("run_on_main_thread"));
        let finish = prod
            .split("fn finish_product_logout_close")
            .nth(1)
            .unwrap_or("");
        let finish_only = finish.split("#[tauri::command]").next().unwrap_or(finish);
        assert!(
            !finish_only.contains("store(false"),
            "logout worker must keep PRODUCT_LOGOUT_CLOSING until Destroyed"
        );
        assert!(!prod.contains("product_close_for_license_kill_switch("));
        let product_cap = include_str!("../../capabilities/product.json");
        let connected_cap =
            include_str!("../../capabilities/product-connected-session.json");
        assert!(
            !product_cap.contains("\"remote\""),
            "product.json must stay local-only; Connected IPC is a separate capability"
        );
        assert!(connected_cap.contains("allow-product-session-logout"));
        assert!(connected_cap.contains("https://app.eliteew.ru"));
        assert!(!connected_cap.contains("native-oidc"));
    }
}
