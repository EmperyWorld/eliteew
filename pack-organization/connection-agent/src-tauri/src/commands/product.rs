// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Open / focus product WebviewWindow from typed ProductTarget (Wave 6 / F-10).
// Invariants:
// - Rust builds Start URL from baked APP origin / local pack — no caller URL IPC.
// - Shared navigation policy on every product WebView builder.
// - FoFline always recreates the product window (no focus of stale remote).
// - W-transport: require SOCKS proxy_url for ANY product Start (fail-closed).
// - Kill-switch: product_close_for_w_transport_kill_switch closes product when SOCKS/tunnel down.
// - License kill-switch: product_close_for_license_kill_switch; product_open fail-closed
//   when local entitlement is missing/invalid/expired (code entitlement_denied).
// - Full Security: native server preflight before WebView; channel bits from signed
//   entitlement (allow_online / allow_fofline) enforced in Rust (not FE-only).
// - Retail remote FoFline Start denied (Wave 5 remote_start_allowed=false).
// - Wave 2: Start URL is profile marker only — no raw license/device bind query params.
// - Wave 4: host-injects EmperyDesktopNativeOidc (empty bootstrap keeps living PKCE).
// - Wave 7 enforce: product WebView opens only with an unexpired native session
//   (memory cache or keyring refresh). A ticket/PAR handshake is not a login.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3 / L3 / L5
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §Wave 6
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.7
// ---

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Window};

use crate::caller_context::require_main_window;
use crate::client_defaults;
use crate::device_identity;
use crate::entitlement;
use crate::fofline_egress::{
    assert_fofline_start_url, navigation_allowed_for_connected_cloud,
    navigation_allowed_for_local_fofline,
};
use crate::fofline_spa_origin;
use crate::license_gate;
use crate::native_oidc::product_bridge;
use crate::native_oidc::session_cache;
use crate::native_oidc::token::refresh_access_token;
use crate::native_oidc::{generic_user_message, NativeOidcClient};
use crate::spa_pack;
use crate::wg::userspace::{w_transport_enabled, w_transport_proxy_url};

/// Baked Connected / presentation origin (Wave 6 — not caller-supplied).
pub const BAKED_PRODUCT_APP_ORIGIN: &str = "https://app.eliteew.ru";

const SPA_OPEN_APP_QUERY: &str = "eliteewOpenApp";

#[derive(Debug, Serialize)]
pub struct ProductOpenResult {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProductWebviewWipeView {
    pub wiped: bool,
    pub code: String,
    pub message: String,
}

/// Typed Start target — frontend selects action, Rust owns destination URL.
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ProductTarget {
    ConnectedCloud {
        #[serde(default)]
        license_id: Option<String>,
        #[serde(default)]
        device_id: Option<String>,
    },
    FoflineLocal {
        #[serde(default)]
        license_id: Option<String>,
        #[serde(default)]
        device_id: Option<String>,
    },
    SpaDeepLink {
        app_id: String,
        #[serde(default)]
        license_id: Option<String>,
        #[serde(default)]
        device_id: Option<String>,
    },
}

fn build_connected_cloud_url(open_app: Option<&str>) -> Result<url::Url, String> {
    let mut url: url::Url = BAKED_PRODUCT_APP_ORIGIN
        .parse()
        .map_err(|e| format!("baked product origin invalid: {e}"))?;
    url.query_pairs_mut().append_pair("eliteewDesktopClient", "1");
    if let Some(app) = open_app.map(str::trim).filter(|s| !s.is_empty()) {
        if !crate::commands::kernel_offline::is_spa_deep_link_mount(app) {
            return Err(format!("spa_deep_link app not allowlisted: {app}"));
        }
        url.query_pairs_mut().append_pair(SPA_OPEN_APP_QUERY, app);
    }
    Ok(url)
}

fn resolve_target_url(target: &ProductTarget) -> Result<(url::Url, bool), String> {
    match target {
        ProductTarget::ConnectedCloud { .. } => Ok((build_connected_cloud_url(None)?, false)),
        ProductTarget::FoflineLocal { .. } => {
            let raw = fofline_spa_origin::build_local_start_url();
            let parsed: url::Url = raw
                .parse()
                .map_err(|e| format!("fofline local Start URL invalid: {e}"))?;
            Ok((parsed, true))
        }
        ProductTarget::SpaDeepLink { app_id, .. } => Ok((
            build_connected_cloud_url(Some(app_id.as_str()))?,
            false,
        )),
    }
}

fn deny_open(code: &str, message: impl Into<String>) -> ProductOpenResult {
    ProductOpenResult {
        ok: false,
        code: code.into(),
        message: message.into(),
        url: "".into(),
        proxy_url: None,
    }
}

fn target_bind_ids(target: &ProductTarget) -> (Option<String>, Option<String>) {
    match target {
        ProductTarget::ConnectedCloud {
            license_id,
            device_id,
        }
        | ProductTarget::FoflineLocal {
            license_id,
            device_id,
        }
        | ProductTarget::SpaDeepLink {
            license_id,
            device_id,
            ..
        } => (license_id.clone(), device_id.clone()),
    }
}

fn assert_channel_bits(
    target: &ProductTarget,
    status: &entitlement::EntitlementStatusView,
) -> Result<(), ProductOpenResult> {
    match target {
        ProductTarget::ConnectedCloud { .. } | ProductTarget::SpaDeepLink { .. } => {
            // Full Security: require explicit allow_online=true (legacy omit → deny until remint).
            if status.allow_online != Some(true) {
                return Err(deny_open(
                    "channel_denied",
                    "Эта лицензия только для офлайн-режима — облачный стол недоступен",
                ));
            }
        }
        ProductTarget::FoflineLocal { .. } => {
            if status.allow_fofline != Some(true) {
                return Err(deny_open(
                    "channel_denied",
                    "Эта лицензия не включает FoFline — обратитесь к оператору контракта",
                ));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn product_open(
    app: AppHandle,
    window: Window,
    target: ProductTarget,
) -> Result<ProductOpenResult, String> {
    require_main_window(&window)?;
    // Fail-closed: verified local entitlement required before any product WebView.
    let data = match app.path().app_data_dir() {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[STEP] product_open entitlement_deny code=app_data_dir err={e}");
            return Ok(deny_open(
                "entitlement_denied",
                "Нет действующей лицензии для открытия продукта",
            ));
        }
    };
    let fingerprint = device_identity::load_or_create(&data)
        .ok()
        .map(|identity| identity.machine_fingerprint);
    let baked = client_defaults::resolve_entitlement_pubkey_hex(&app);
    let app_id = app.config().identifier.clone();
    let entitlement_status = entitlement::status_from_app_data(
        &data,
        fingerprint.as_deref(),
        baked.as_deref(),
        Some(&app_id),
    );
    if !entitlement_status.ok {
        eprintln!(
            "[STEP] product_open entitlement_deny code={}",
            entitlement_status.code
        );
        let _ = product_close_for_license_kill_switch(&app);
        let message: String = if entitlement_status.code == "clock_rollback" {
            "Часы устройства откатили назад относительно лицензии. Проверьте системное время и повторите."
                .into()
        } else if entitlement_status.code == "expired" {
            "Срок действия лицензии истёк".into()
        } else {
            "Нет действующей лицензии для открытия продукта".into()
        };
        return Ok(deny_open("entitlement_denied", message));
    }

    if let Err(denied) = assert_channel_bits(&target, &entitlement_status) {
        eprintln!("[STEP] product_open channel_deny code={}", denied.code);
        return Ok(denied);
    }

    let (bind_license, bind_device) = target_bind_ids(&target);
    let license_id = bind_license
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .or(entitlement_status.license_id.as_deref())
        .unwrap_or("")
        .to_string();
    let device_id = bind_device
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .or(entitlement_status.device_id.as_deref())
        .map(str::to_string);
    if let Err((code, message)) = license_gate::server_preflight(
        &license_id,
        device_id.as_deref(),
        fingerprint.as_deref(),
    )
    .await
    {
        eprintln!("[STEP] product_open server_preflight_deny code={code}");
        let _ = product_close_for_license_kill_switch(&app);
        return Ok(deny_open("license_preflight_denied", message));
    }

    let oidc_client = match &target {
        ProductTarget::FoflineLocal { .. } => NativeOidcClient::EmperyFofline,
        ProductTarget::ConnectedCloud { .. } | ProductTarget::SpaDeepLink { .. } => {
            NativeOidcClient::EmperyDesktop
        }
    };
    // Wave 7: completed native session only — ticket/PAR prepare is not a login.
    if session_cache::unexpired(oidc_client).is_some() {
        eprintln!(
            "[STEP] product_open native_oidc_session_ok reason=cache client={}",
            oidc_client.client_id()
        );
    } else {
        let refreshed = refresh_access_token(&data, Some(&app_id), oidc_client).await;
        if !refreshed.ok {
            eprintln!(
                "[STEP] product_open native_oidc_session_required client={}",
                oidc_client.client_id()
            );
            return Ok(deny_open(
                "auth_policy_denied",
                generic_user_message().to_string(),
            ));
        }
        eprintln!(
            "[STEP] product_open native_oidc_session_ok reason=refresh client={}",
            oidc_client.client_id()
        );
    }

    let (parsed, fofline_local_target) = match resolve_target_url(&target) {
        Ok(v) => v,
        Err(message) => {
            return Ok(deny_open("invalid_target", message));
        }
    };

    let fofline = fofline_local_target
        || parsed
            .query_pairs()
            .any(|(k, v)| k == "eliteewFoflineClient" && v == "1");
    let local_fofline = fofline_spa_origin::is_fofline_local_url(&parsed);
    let mut applied_proxy: Option<String> = None;
    let w_transport = w_transport_enabled();
    let url_display = parsed.as_str().to_string();

    if fofline {
        let pack_ready = app
            .path()
            .app_data_dir()
            .map(|d| spa_pack::is_ready_install(&d, None))
            .unwrap_or(false);
        if let Err((code, message)) = assert_fofline_start_url(&parsed, pack_ready) {
            eprintln!("[STEP] product_open fofline_deny code={code}");
            return Ok(ProductOpenResult {
                ok: false,
                code,
                message,
                url: url_display,
                proxy_url: None,
            });
        }
    }

    if w_transport {
        let plan = w_transport_proxy_url();
        match plan.proxy_url {
            Some(ref p) if plan.fail_closed => {
                applied_proxy = Some(p.clone());
            }
            _ => {
                return Ok(ProductOpenResult {
                    ok: false,
                    code: "w_transport_proxy_required".into(),
                    message: plan.message,
                    url: url_display,
                    proxy_url: None,
                });
            }
        }
    }

    if fofline || w_transport {
        if let Some(existing) = app.get_webview_window("product") {
            let _ = existing.close();
            eprintln!(
                "[STEP] product_open recreate_product_window fofline={} w_transport={}",
                fofline, w_transport
            );
        }
    } else if let Some(existing) = app.get_webview_window("product") {
        let _ = existing.set_focus();
        product_bridge::push_bridge_into_product_if_open(&app, oidc_client);
        return Ok(ProductOpenResult {
            ok: true,
            code: "focused".into(),
            message: "product window already open".into(),
            url: url_display,
            proxy_url: None,
        });
    }

    let bootstrap =
        product_bridge::bootstrap_for_open(&data, Some(&app_id), oidc_client).await;

    let mut builder =
        WebviewWindowBuilder::new(&app, "product", WebviewUrl::External(parsed.clone()))
            .title(if fofline {
                "EliteEW FoFline"
            } else {
                "EliteEW"
            })
            .inner_size(1280.0, 860.0)
            .initialization_script(product_bridge::initialization_script(
                oidc_client,
                &bootstrap,
            ));

    // Wave 6: navigation guard on every product window (not only local FoFline).
    builder = if local_fofline {
        eprintln!("[STEP] product_open fofline local_nav_guard applied");
        builder.on_navigation(|nav_url| navigation_allowed_for_local_fofline(nav_url))
    } else {
        eprintln!("[STEP] product_open connected_nav_guard applied");
        builder.on_navigation(|nav_url| navigation_allowed_for_connected_cloud(nav_url))
    };

    if let Some(ref proxy) = applied_proxy {
        let proxy_parsed: url::Url = proxy
            .parse()
            .map_err(|e| format!("invalid W-transport proxy_url: {e}"))?;
        builder = builder.proxy_url(proxy_parsed);
        eprintln!(
            "[STEP] product_open proxy_url applied (W-transport fail-closed) fofline={}",
            fofline
        );
    }

    builder
        .build()
        .map_err(|e| format!("create product window: {e}"))?;

    Ok(ProductOpenResult {
        ok: true,
        code: if applied_proxy.is_some() {
            "opened_with_proxy".into()
        } else if local_fofline {
            "opened_local".into()
        } else {
            "opened".into()
        },
        message: if applied_proxy.is_some() {
            "WebviewWindow opened with W-transport proxy_url".into()
        } else if local_fofline {
            "FoFline WebviewWindow opened on local SPA pack origin".into()
        } else {
            "product WebviewWindow opened".into()
        },
        url: url_display,
        proxy_url: applied_proxy,
    })
}

/// Native builder for local FoFline Start URL (same contract as FE `buildFoflineLocalStartUrl`).
/// Bind ids remain on the IPC payload for compatibility but are not placed on the URL (Wave 2).
#[tauri::command]
pub fn fofline_local_start_url(
    window: Window,
    license_id: Option<String>,
    device_id: Option<String>,
) -> Result<String, String> {
    require_main_window(&window)?;
    let _ = (license_id, device_id);
    Ok(fofline_spa_origin::build_local_start_url())
}

/// Clear product WebView browsing data (cookies / storage) after FoFline logout / factory-reset.
/// Returns `wiped=false` when no product window (honest skip — do not treat as cleared).
pub(crate) fn wipe_product_webview(app: &AppHandle) -> Result<ProductWebviewWipeView, String> {
    match app.get_webview_window("product") {
        Some(w) => {
            w.clear_all_browsing_data()
                .map_err(|e| format!("product_webview_wipe: {e}"))?;
            eprintln!("[STEP] product_webview_wipe ok");
            Ok(ProductWebviewWipeView {
                wiped: true,
                code: "wiped".into(),
                message: "Данные WebView продукта очищены".into(),
            })
        }
        None => {
            eprintln!("[STEP] product_webview_wipe_skip reason=no_product_window");
            Ok(ProductWebviewWipeView {
                wiped: false,
                code: "no_product_window".into(),
                message: "Окно продукта не открыто — очистка WebView пропущена".into(),
            })
        }
    }
}

#[tauri::command]
pub fn product_webview_wipe(app: AppHandle, window: Window) -> Result<ProductWebviewWipeView, String> {
    require_main_window(&window)?;
    wipe_product_webview(&app)
}

/// Kill-switch: when W-transport is on and SOCKS/tunnel is not usable, close the
/// product WebView so a dead proxy cannot silently fall through to public egress.
/// Returns true when a product window was closed.
pub fn product_close_for_w_transport_kill_switch(app: &AppHandle) -> bool {
    if !w_transport_enabled() {
        return false;
    }
    match app.get_webview_window("product") {
        Some(w) => {
            let _ = w.close();
            eprintln!("[STEP] w_transport_kill_switch product_closed");
            true
        }
        None => false,
    }
}

/// License kill-switch: close product WebView when entitlement is denied/revoked.
/// Same close path as W-transport kill-switch (no transport gate).
pub fn product_close_for_license_kill_switch(app: &AppHandle) -> bool {
    match app.get_webview_window("product") {
        Some(w) => {
            let _ = w.close();
            eprintln!("[STEP] license_kill_switch product_closed");
            true
        }
        None => false,
    }
}

/// FE-callable license kill-switch (denylist / status poll).
#[tauri::command]
pub fn product_close_for_license_kill_switch_cmd(app: AppHandle, window: Window) -> bool {
    if require_main_window(&window).is_err() {
        eprintln!("[STEP] license_kill_switch_cmd_deny caller_context");
        return false;
    }
    product_close_for_license_kill_switch(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connected_cloud_url_is_baked_origin() {
        let u = build_connected_cloud_url(None).unwrap();
        assert_eq!(u.origin().ascii_serialization(), "https://app.eliteew.ru");
        assert_eq!(
            u.query_pairs()
                .find(|(k, _)| k == "eliteewDesktopClient")
                .map(|(_, v)| v.to_string())
                .as_deref(),
            Some("1")
        );
        assert!(!u.as_str().contains("eliteewLicenseId"));
        assert!(!u.as_str().contains("eliteewDeviceId"));
    }

    #[test]
    fn spa_deep_link_rejects_unknown_app() {
        let err = build_connected_cloud_url(Some("NotARealApp")).unwrap_err();
        assert!(err.contains("not allowlisted"));
    }

    #[test]
    fn start_url_builders_never_emit_bind_ids() {
        let src = include_str!("product.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(!prod.contains("eliteewLicenseId"));
        assert!(!prod.contains("eliteewDeviceId"));
        assert!(!prod.contains("push_bind_query"));
    }

    #[test]
    fn product_open_requires_native_session() {
        let src = include_str!("product.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(prod.contains("native_oidc_session_required"));
        assert!(prod.contains("refresh_access_token"));
        assert!(!prod.contains("prepare_for_product_open"));
    }

    #[test]
    fn product_open_injects_host_oidc_bridge() {
        let src = include_str!("product.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(prod.contains("initialization_script"));
        assert!(prod.contains("product_bridge::bootstrap_for_open"));
        assert!(prod.contains("push_bridge_into_product_if_open"));
        assert!(!prod.contains("native_oidc_refresh"));
    }

    #[test]
    fn privileged_product_ipc_requires_main_window() {
        let src = include_str!("product.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        for name in [
            "product_open",
            "product_webview_wipe",
            "product_close_for_license_kill_switch_cmd",
            "fofline_local_start_url",
        ] {
            assert!(
                prod.contains("require_main_window"),
                "product IPC must check caller window"
            );
            let needle = format!("pub async fn {name}");
            let alt = format!("pub fn {name}");
            let idx = prod
                .find(&needle)
                .or_else(|| prod.find(&alt))
                .unwrap_or_else(|| panic!("missing {name}"));
            let slice = &prod[idx..];
            assert!(
                slice.contains("window: Window"),
                "{name} must take Window"
            );
        }
    }
}
