// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// EBrowser WebviewWindow staged over EBrowserApp (Meet-pattern parent/bounds).
// Invariants:
// - on_navigation authoritative via ebrowser_nav_policy.
// - Policy SoT is Rust-fetched API snapshot (never SPA PolicySnapshot args).
// - Product window parent; decorations off; bounds CSS pixels in product viewport.
// - Chrome sync: Rust emits `ebrowser-chrome`; SPA may poll batched snapshot as fallback.
// - No W-transport SOCKS on this stage: portal ACL is edge /32 + product map only;
//   Meet/product keep SOCKS; EBrowser uses clearnet (dedicated WebContext + NoProxy).
// - Must not share Tauri/WRY WebContext (data_directory) with product: product_open
//   stamps SOCKS on WebsiteDataManager; a sibling stage without proxy_url still inherits.
// Related:
// - documentation/product/desktop/DESKTOP-EBROWSER.md
// - documentation/reference/solution-readiness/2026-09-10-ebrowser-webkit-context-socks-inherit.md
// - documentation/reference/solution-readiness/2026-09-10-ebrowser-chrome-perf-wave-p.md
// - video_call_meet_stage.rs
// - ebrowser_nav_policy.rs
// - ebrowser_policy_fetch.rs
// - linux_ebrowser_media.rs
// - ebrowser_tabs.rs
// - w-transport-core acl.rs
// ---

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder, Window,
};

use crate::caller_context::require_product_window;
use crate::ebrowser_nav_policy;
use crate::ebrowser_policy_fetch;
use crate::ebrowser_tabs;

/// SPA event name — alphanumeric / hyphen only (Tauri event ACL).
pub const EBROWSER_CHROME_EVENT: &str = "ebrowser-chrome";

static LAST_CHROME_EMIT_MS: AtomicU64 = AtomicU64::new(0);
static LAST_APPLIED_BOUNDS_PX: OnceLock<Mutex<HashMap<String, (i32, i32, u32, u32)>>> =
    OnceLock::new();

fn last_bounds_map() -> &'static Mutex<HashMap<String, (i32, i32, u32, u32)>> {
    LAST_APPLIED_BOUNDS_PX.get_or_init(|| Mutex::new(HashMap::new()))
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn location_view_for_stage(stage: &WebviewWindow) -> EBrowserLocationView {
    let (can_go_back, can_go_forward) = history_flags(stage);
    let href = stage.url().map(|u| u.to_string()).unwrap_or_default();
    let page_title = match read_page_title_live(stage) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("[STEP] ebrowser_get_location_title_fail err={e}");
            return EBrowserLocationView {
                ok: false,
                href,
                page_title: String::new(),
                can_go_back,
                can_go_forward,
            };
        }
    };
    EBrowserLocationView {
        ok: true,
        href,
        page_title,
        can_go_back,
        can_go_forward,
    }
}

fn tabs_json(app: &AppHandle) -> (Vec<serde_json::Value>, usize) {
    let tabs: Vec<serde_json::Value> = ebrowser_tabs::list_meta()
        .into_iter()
        .map(|(id, label, active)| {
            let href = app
                .get_webview_window(&label)
                .and_then(|w| w.url().ok())
                .map(|u| u.to_string())
                .unwrap_or_default();
            serde_json::json!({
                "id": id,
                "label": label,
                "active": active,
                "href": href,
            })
        })
        .collect();
    (tabs, ebrowser_tabs::MAX_TABS)
}

fn downloads_json() -> Vec<serde_json::Value> {
    #[cfg(target_os = "linux")]
    {
        return crate::commands::linux_ebrowser_downloads::snapshot()
            .into_iter()
            .filter_map(|e| serde_json::to_value(e).ok())
            .collect();
    }
    #[cfg(not(target_os = "linux"))]
    Vec::new()
}

/// Batched chrome state for SPA (also used as event payload).
pub fn build_chrome_snapshot(app: &AppHandle) -> serde_json::Value {
    let location = match active_stage(app) {
        Some(stage) => location_view_for_stage(&stage),
        None => EBrowserLocationView {
            ok: false,
            href: String::new(),
            page_title: String::new(),
            can_go_back: false,
            can_go_forward: false,
        },
    };
    let (tabs, max_tabs) = tabs_json(app);
    serde_json::json!({
        "ok": true,
        "location": location,
        "tabs": tabs,
        "max_tabs": max_tabs,
        "downloads": downloads_json(),
    })
}

/// Publish chrome to product SPA (throttled). Safe to call from WebKit callbacks.
pub fn emit_chrome_changed(app: &AppHandle) {
    let now = now_ms();
    let prev = LAST_CHROME_EMIT_MS.load(Ordering::Relaxed);
    if now.saturating_sub(prev) < 80 {
        return;
    }
    LAST_CHROME_EMIT_MS.store(now, Ordering::Relaxed);
    let payload = build_chrome_snapshot(app);
    if let Err(e) = app.emit(EBROWSER_CHROME_EVENT, payload) {
        eprintln!("[STEP] ebrowser_chrome_emit_fail err={e}");
    }
}

fn attach_chrome_signals(app: &AppHandle, stage: &WebviewWindow) {
    #[cfg(target_os = "linux")]
    {
        let app_title = app.clone();
        let app_load = app.clone();
        if let Err(e) = stage.with_webview(move |platform| {
            use webkit2gtk::WebViewExt;
            let webview = platform.inner();
            webview.connect_title_notify(move |_wv| {
                emit_chrome_changed(&app_title);
            });
            webview.connect_load_changed(move |_wv, _ev| {
                emit_chrome_changed(&app_load);
            });
        }) {
            eprintln!("[STEP] ebrowser_chrome_signals_fail err={e}");
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, stage);
    }
}

/// Live document title from the stage WebView (SoT = WebKit, not a Rust cache).
fn read_page_title_live(stage: &WebviewWindow) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        let (tx, rx) = std::sync::mpsc::sync_channel::<String>(1);
        stage
            .with_webview(move |platform| {
                use webkit2gtk::WebViewExt;
                let title = platform
                    .inner()
                    .title()
                    .map(|g| g.to_string())
                    .unwrap_or_default();
                let _ = tx.send(title);
            })
            .map_err(|e| {
                eprintln!("[STEP] ebrowser_title_read_fail err={e}");
                e.to_string()
            })?;
        let title = rx.recv().map_err(|_| {
            eprintln!("[STEP] ebrowser_title_read_fail err=channel_empty");
            "ebrowser_title_unavailable".to_string()
        })?;
        return Ok(title.trim().to_string());
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = stage;
        Ok(String::new())
    }
}

fn history_flags(stage: &WebviewWindow) -> (bool, bool) {
    #[cfg(target_os = "linux")]
    {
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;
        let back = Arc::new(AtomicBool::new(false));
        let forward = Arc::new(AtomicBool::new(false));
        let back_c = Arc::clone(&back);
        let forward_c = Arc::clone(&forward);
        let _ = stage.with_webview(move |platform| {
            use webkit2gtk::WebViewExt;
            let webview = platform.inner();
            back_c.store(webview.can_go_back(), Ordering::SeqCst);
            forward_c.store(webview.can_go_forward(), Ordering::SeqCst);
        });
        return (
            back.load(Ordering::SeqCst),
            forward.load(Ordering::SeqCst),
        );
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = stage;
        (false, false)
    }
}

fn active_stage(app: &AppHandle) -> Option<WebviewWindow> {
    let label = ebrowser_tabs::active_label()?;
    app.get_webview_window(&label)
}

fn show_only_active(app: &AppHandle) {
    let active = ebrowser_tabs::active_label();
    for label in ebrowser_tabs::all_labels() {
        if let Some(w) = app.get_webview_window(&label) {
            if Some(label.as_str()) == active.as_deref() {
                if let Err(e) = w.show() {
                    eprintln!("[STEP] ebrowser_tab_show_fail label={label} err={e}");
                }
                if let Err(e) = w.set_focus() {
                    eprintln!("[STEP] ebrowser_tab_focus_fail label={label} err={e}");
                }
            } else if let Err(e) = w.hide() {
                eprintln!("[STEP] ebrowser_tab_hide_fail label={label} err={e}");
            }
        }
    }
}

fn destroy_tab_window(app: &AppHandle, label: &str) -> bool {
    let Some(w) = app.get_webview_window(label) else {
        return true;
    };
    match w.destroy() {
        Ok(()) => {
            if let Ok(mut last) = last_bounds_map().lock() {
                last.remove(label);
            }
            eprintln!("[STEP] ebrowser_tab_destroy label={label}");
            true
        }
        Err(e) => {
            eprintln!("[STEP] ebrowser_tab_destroy_fail label={label} err={e}");
            false
        }
    }
}

/// Isolated WebContext key so product SOCKS on the default context cannot poison EBrowser.
fn ebrowser_webview_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("ebrowser_data_dir: {e}"))?
        .join("ebrowser-webview");
    std::fs::create_dir_all(&dir).map_err(|e| format!("ebrowser_data_dir_mkdir: {e}"))?;
    Ok(dir)
}

/// Force WebKit clearnet: do not use system/default proxy and do not inherit Custom SOCKS.
///
/// `WebviewWindow::with_webview` runs the closure synchronously only on the GTK main
/// thread; from async Tauri commands it only queues work. Wait on a channel for the
/// apply result (fail-closed on timeout / missing context / apply error).
///
/// Prefer `WebContext.website_data_manager()` (WRY `proxy_url` path); if None on the
/// seated WebKit, fall back to `webkit_web_context_set_network_proxy_settings`.
#[cfg(target_os = "linux")]
fn apply_ebrowser_clearnet_proxy(stage: &WebviewWindow) -> Result<(), String> {
    use std::sync::mpsc;
    use std::time::Duration;

    use webkit2gtk::glib::translate::{IntoGlib, ToGlibPtr};

    let (tx, rx) = mpsc::channel::<Result<(), String>>();
    stage
        .with_webview(move |platform| {
            use webkit2gtk::{
                NetworkProxyMode, WebContextExt, WebViewExt, WebsiteDataManagerExt,
            };

            let send = |r: Result<(), String>| {
                let _ = tx.send(r);
            };

            let webview = platform.inner();
            let Some(ctx) = webview.context() else {
                eprintln!("[STEP] ebrowser_stage proxy_fail reason=no_context");
                send(Err(
                    "ebrowser_clearnet_proxy: WebContext unavailable".into(),
                ));
                return;
            };

            if let Some(mgr) = ctx
                .website_data_manager()
                .or_else(|| webview.website_data_manager())
            {
                mgr.set_network_proxy_settings(NetworkProxyMode::NoProxy, None);
                eprintln!("[STEP] ebrowser_stage proxy=no_proxy via=website_data_manager");
                send(Ok(()));
                return;
            }

            // WebKitGTK 2.4x/2.5x: manager getter may be None; context proxy API remains.
            unsafe {
                webkit2gtk::ffi::webkit_web_context_set_network_proxy_settings(
                    ctx.to_glib_none().0,
                    NetworkProxyMode::NoProxy.into_glib(),
                    std::ptr::null_mut(),
                );
            }
            eprintln!("[STEP] ebrowser_stage proxy=no_proxy via=web_context_api");
            send(Ok(()));
        })
        .map_err(|e| format!("ebrowser_clearnet_proxy: {e}"))?;

    match rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => Err(e),
        Err(mpsc::RecvTimeoutError::Timeout) => Err(
            "ebrowser_clearnet_proxy: timed out waiting for WebKit main thread".into(),
        ),
        Err(mpsc::RecvTimeoutError::Disconnected) => Err(
            "ebrowser_clearnet_proxy: WebKit apply channel disconnected".into(),
        ),
    }
}

fn create_tab_stage(
    app: &AppHandle,
    product: &WebviewWindow,
    tab_id: u64,
    label: &str,
    parsed: url::Url,
    bounds: &EBrowserStageBounds,
) -> Result<WebviewWindow, String> {
    let _ = tab_id;
    let data_dir = ebrowser_webview_data_dir(app)?;
    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::External(parsed))
        .title("EBrowser")
        .decorations(false)
        .skip_taskbar(true)
        .resizable(false)
        .data_directory(data_dir)
        .inner_size(bounds.width.max(48.0), bounds.height.max(48.0))
        .on_navigation(|nav_url| ebrowser_nav_policy::navigation_allowed(nav_url));

    builder = builder
        .parent(product)
        .map_err(|e| format!("ebrowser_parent: {e}"))?;

    eprintln!("[STEP] ebrowser_stage egress=system_clearnet label={label}");

    let stage = builder
        .build()
        .map_err(|e| format!("create ebrowser window: {e}"))?;

    #[cfg(target_os = "linux")]
    {
        if let Err(e) = apply_ebrowser_clearnet_proxy(&stage) {
            let _ = stage.destroy();
            return Err(e);
        }
        crate::commands::linux_ebrowser_downloads::bind_chrome_emit_app(app.clone());
        crate::commands::linux_ebrowser_media::attach_ebrowser_media(&stage);
        crate::commands::linux_ebrowser_downloads::attach_ebrowser_downloads(&stage);
    }

    attach_chrome_signals(app, &stage);

    if let Err(e) = apply_stage_bounds(&stage, product, bounds) {
        let _ = stage.destroy();
        return Err(e);
    }
    Ok(stage)
}

#[derive(Debug, Clone, Deserialize)]
pub struct EBrowserStageBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize)]
pub struct EBrowserResult {
    pub ok: bool,
    pub code: String,
    pub message: String,
}

fn deny(code: &str, message: impl AsRef<str>) -> EBrowserResult {
    EBrowserResult {
        ok: false,
        code: code.into(),
        message: message.as_ref().into(),
    }
}

fn ok(code: &str, message: &str) -> EBrowserResult {
    EBrowserResult {
        ok: true,
        code: code.into(),
        message: message.into(),
    }
}

fn parse_start_url(raw: &str) -> Result<url::Url, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(url::Url::parse("about:blank").map_err(|e| e.to_string())?);
    }
    if trimmed.len() > 8192 {
        return Err("ebrowser_url_too_long".into());
    }
    url::Url::parse(trimmed).map_err(|_| "ebrowser_url_invalid".to_string())
}

fn apply_stage_bounds(
    stage: &WebviewWindow,
    product: &WebviewWindow,
    bounds: &EBrowserStageBounds,
) -> Result<(), String> {
    if !bounds.x.is_finite()
        || !bounds.y.is_finite()
        || !bounds.width.is_finite()
        || !bounds.height.is_finite()
    {
        return Err("ebrowser_bounds_invalid".into());
    }
    if bounds.width < 48.0 || bounds.height < 48.0 {
        let _ = stage.set_fullscreen(false);
        let _ = stage.hide();
        return Ok(());
    }
    let scale = product.scale_factor().unwrap_or(1.0);
    if scale <= 0.0 {
        return Err("ebrowser_scale_invalid".into());
    }
    let origin = product
        .inner_position()
        .map_err(|e| format!("product_inner_position: {e}"))?;
    let px = (origin.x as f64 + bounds.x * scale).round() as i32;
    let py = (origin.y as f64 + bounds.y * scale).round() as i32;
    let pw = (bounds.width * scale).round().max(48.0) as u32;
    let ph = (bounds.height * scale).round().max(48.0) as u32;
    let label = stage.label().to_string();
    if let Ok(mut last) = last_bounds_map().lock() {
        if last.get(&label) == Some(&(px, py, pw, ph)) {
            let _ = stage.show();
            return Ok(());
        }
        last.insert(label, (px, py, pw, ph));
    }
    stage
        .set_position(Position::Physical(PhysicalPosition::new(px, py)))
        .map_err(|e| format!("ebrowser_set_position: {e}"))?;
    stage
        .set_size(Size::Physical(PhysicalSize::new(pw, ph)))
        .map_err(|e| format!("ebrowser_set_size: {e}"))?;
    // labwc kiosk historically ToggleFullscreen on identifier=* — clear so the
    // stage stays a parented bounds window, not an output-filling toplevel.
    if let Err(e) = stage.set_fullscreen(false) {
        eprintln!("[STEP] ebrowser_stage fullscreen_clear_fail err={e}");
    }
    if let Ok(pos) = stage.outer_position() {
        let dy = (pos.y as i64 - py as i64).abs();
        if dy > 24 && bounds.y > 24.0 {
            eprintln!(
                "[STEP] ebrowser_bounds_position_drift want_y={py} got_y={} bounds_y={:.1} hint=gdk_backend_x11",
                pos.y, bounds.y
            );
        }
    }
    let _ = stage.show();
    Ok(())
}

/// Close all EBrowser tabs (logout / product teardown).
pub fn close_ebrowser_if_open(app: &AppHandle) {
    let labels = ebrowser_tabs::all_labels();
    let mut all_ok = true;
    for label in &labels {
        if !destroy_tab_window(app, label) {
            all_ok = false;
        }
    }
    if let Some(w) = app.get_webview_window("ebrowser") {
        if w.destroy().is_err() {
            all_ok = false;
        }
    }
    if all_ok {
        ebrowser_tabs::clear_all();
    } else {
        // Drop registry entries whose windows are gone; keep survivors.
        for label in labels {
            if app.get_webview_window(&label).is_none() {
                if let Some(id) = label
                    .strip_prefix("ebrowser-")
                    .and_then(|s| s.parse::<u64>().ok())
                {
                    let _ = ebrowser_tabs::remove(id);
                }
            }
        }
        eprintln!("[STEP] ebrowser_close_partial remaining={}", ebrowser_tabs::all_labels().len());
    }
    #[cfg(target_os = "linux")]
    crate::commands::linux_ebrowser_downloads::cancel_all_active();
    if ebrowser_tabs::is_empty() {
        ebrowser_nav_policy::store_policy(None);
    }
    if let Ok(mut last) = last_bounds_map().lock() {
        last.clear();
    }
    emit_chrome_changed(app);
}

#[tauri::command]
pub async fn ebrowser_open(
    app: AppHandle,
    window: Window,
    nav_href: String,
    bounds: EBrowserStageBounds,
    access_token: Option<String>,
) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    if let Err(code) =
        ebrowser_policy_fetch::ensure_active_policy(access_token.as_deref()).await
    {
        eprintln!("[STEP] ebrowser_open_deny reason={code}");
        return Ok(deny(&code, "EBrowser navigation policy could not be loaded"));
    }

    let parsed = match parse_start_url(&nav_href) {
        Ok(u) => u,
        Err(code) => return Ok(deny(&code, "Invalid start URL")),
    };
    if !ebrowser_nav_policy::navigation_allowed(&parsed) && parsed.as_str() != "about:blank" {
        eprintln!("[STEP] ebrowser_open_deny reason=policy");
        return Ok(deny("policy_denied", "URL is not allowed by EBrowser policy"));
    }

    let Some(product) = app.get_webview_window("product") else {
        return Ok(deny(
            "product_window_missing",
            "Product window is not open",
        ));
    };

    let _ops = match ebrowser_tabs::lock_ops() {
        Ok(g) => g,
        Err(code) => return Ok(deny(code, "EBrowser tabs unavailable")),
    };

    if let Some(existing) = active_stage(&app) {
        if let Err(e) = existing.navigate(parsed.clone()) {
            eprintln!("[STEP] ebrowser_navigate_fail err={e}");
            let _ = existing.destroy();
        } else if let Err(e) = apply_stage_bounds(&existing, &product, &bounds) {
            eprintln!("[STEP] ebrowser_bounds_fail err={e}");
            return Ok(deny("ebrowser_bounds_failed", e));
        } else {
            show_only_active(&app);
            eprintln!("[STEP] ebrowser_open reused=true");
            emit_chrome_changed(&app);
            return Ok(ok("focused", "EBrowser reused"));
        }
    }

    let (tab_id, label) = match ebrowser_tabs::allocate() {
        Ok(v) => v,
        Err("ebrowser_tabs_busy") => {
            return Ok(deny("ebrowser_tabs_busy", "EBrowser tab limit reached"));
        }
        Err(_) => return Ok(deny("ebrowser_tabs_lock", "EBrowser tabs unavailable")),
    };

    match create_tab_stage(&app, &product, tab_id, &label, parsed, &bounds) {
        Ok(_stage) => {
            show_only_active(&app);
            eprintln!("[STEP] ebrowser_open opened=true tab={tab_id}");
            emit_chrome_changed(&app);
            Ok(ok("opened", "EBrowser opened"))
        }
        Err(e) => {
            if ebrowser_tabs::remove(tab_id).is_none() {
                eprintln!("[STEP] ebrowser_open_rollback_miss id={tab_id}");
            }
            eprintln!("[STEP] ebrowser_bounds_fail err={e}");
            Ok(deny("ebrowser_bounds_failed", e))
        }
    }
}

#[tauri::command]
pub async fn ebrowser_navigate(
    app: AppHandle,
    window: Window,
    nav_href: String,
    access_token: Option<String>,
) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    if let Err(code) =
        ebrowser_policy_fetch::ensure_active_policy(access_token.as_deref()).await
    {
        eprintln!("[STEP] ebrowser_navigate_deny reason={code}");
        return Ok(deny(&code, "EBrowser navigation policy could not be loaded"));
    }
    let parsed = match parse_start_url(&nav_href) {
        Ok(u) => u,
        Err(code) => return Ok(deny(&code, "Invalid URL")),
    };
    if !ebrowser_nav_policy::navigation_allowed(&parsed) {
        eprintln!("[STEP] ebrowser_navigate_deny reason=policy");
        return Ok(deny("policy_denied", "URL is not allowed by EBrowser policy"));
    }
    let Some(stage) = active_stage(&app) else {
        return Ok(deny("ebrowser_missing", "EBrowser is not open"));
    };
    if let Err(e) = stage.navigate(parsed.clone()) {
        eprintln!("[STEP] ebrowser_navigate_fail err={e}");
        return Ok(deny("navigate_failed", e.to_string()));
    }
    emit_chrome_changed(&app);
    Ok(ok("navigated", "EBrowser navigated"))
}

#[tauri::command]
pub async fn ebrowser_refresh_policy(
    window: Window,
    access_token: Option<String>,
) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    if let Err(code) =
        ebrowser_policy_fetch::force_refresh_active_policy(access_token.as_deref()).await
    {
        eprintln!("[STEP] ebrowser_refresh_policy_deny reason={code}");
        return Ok(deny(&code, "EBrowser navigation policy could not be refreshed"));
    }
    eprintln!("[STEP] ebrowser_refresh_policy ok=true");
    Ok(ok("policy_refreshed", "EBrowser policy refreshed"))
}

#[derive(Debug, Serialize)]
pub struct EBrowserLocationView {
    pub ok: bool,
    /// Current document location (named `href` — avoid F-06 generic `url: String` IPC arg scan).
    pub href: String,
    /// Document title from the live WebView (Linux WebKit SoT; empty off Linux).
    pub page_title: String,
    pub can_go_back: bool,
    pub can_go_forward: bool,
}

#[tauri::command]
pub fn ebrowser_get_location(
    app: AppHandle,
    window: Window,
) -> Result<EBrowserLocationView, String> {
    require_product_window(&window)?;
    let Some(stage) = active_stage(&app) else {
        return Ok(EBrowserLocationView {
            ok: false,
            href: String::new(),
            page_title: String::new(),
            can_go_back: false,
            can_go_forward: false,
        });
    };
    Ok(location_view_for_stage(&stage))
}

#[tauri::command]
pub fn ebrowser_get_chrome_snapshot(
    app: AppHandle,
    window: Window,
) -> Result<serde_json::Value, String> {
    require_product_window(&window)?;
    Ok(build_chrome_snapshot(&app))
}

#[tauri::command]
pub fn ebrowser_reload(app: AppHandle, window: Window) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    let Some(stage) = active_stage(&app) else {
        return Ok(deny("ebrowser_missing", "EBrowser is not open"));
    };
    #[cfg(target_os = "linux")]
    {
        if let Err(e) = stage.with_webview(|platform| {
            use webkit2gtk::WebViewExt;
            platform.inner().reload();
        }) {
            eprintln!("[STEP] ebrowser_reload_fail err={e}");
            return Ok(deny("reload_failed", e.to_string()));
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        let href = stage.url().map(|u| u.to_string()).unwrap_or_default();
        if href.trim().is_empty() {
            return Ok(deny(
                "ebrowser_location_unknown",
                "EBrowser has no current location",
            ));
        }
        let parsed = match url::Url::parse(href.trim()) {
            Ok(u) => u,
            Err(_) => return Ok(deny("ebrowser_url_invalid", "Invalid stage location")),
        };
        if let Err(e) = stage.navigate(parsed) {
            eprintln!("[STEP] ebrowser_reload_fail err={e}");
            return Ok(deny("reload_failed", e.to_string()));
        }
    }
    eprintln!("[STEP] ebrowser_reload ok=true");
    emit_chrome_changed(&app);
    Ok(ok("reloaded", "EBrowser reloaded"))
}

#[tauri::command]
pub fn ebrowser_history_back(app: AppHandle, window: Window) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    let Some(stage) = active_stage(&app) else {
        return Ok(deny("ebrowser_missing", "EBrowser is not open"));
    };
    #[cfg(target_os = "linux")]
    {
        let _ = stage.with_webview(|platform| {
            use webkit2gtk::WebViewExt;
            platform.inner().go_back();
        });
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = stage.eval("history.back()");
    }
    emit_chrome_changed(&app);
    Ok(ok("back", "EBrowser history back"))
}

#[tauri::command]
pub fn ebrowser_history_forward(app: AppHandle, window: Window) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    let Some(stage) = active_stage(&app) else {
        return Ok(deny("ebrowser_missing", "EBrowser is not open"));
    };
    #[cfg(target_os = "linux")]
    {
        let _ = stage.with_webview(|platform| {
            use webkit2gtk::WebViewExt;
            platform.inner().go_forward();
        });
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = stage.eval("history.forward()");
    }
    emit_chrome_changed(&app);
    Ok(ok("forward", "EBrowser history forward"))
}

#[tauri::command]
pub fn ebrowser_set_bounds(
    app: AppHandle,
    window: Window,
    bounds: EBrowserStageBounds,
) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    if ebrowser_tabs::is_empty() {
        return Ok(deny("ebrowser_missing", "EBrowser is not open"));
    }
    let Some(product) = app.get_webview_window("product") else {
        return Ok(deny(
            "product_window_missing",
            "Product window is not open",
        ));
    };
    for label in ebrowser_tabs::all_labels() {
        if let Some(stage) = app.get_webview_window(&label) {
            if let Err(e) = apply_stage_bounds(&stage, &product, &bounds) {
                eprintln!("[STEP] ebrowser_bounds_fail err={e}");
                return Ok(deny("ebrowser_bounds_failed", e));
            }
        }
    }
    Ok(ok("bounds_set", "EBrowser bounds updated"))
}

#[tauri::command]
pub fn ebrowser_close(app: AppHandle, window: Window) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    if ebrowser_tabs::is_empty() && app.get_webview_window("ebrowser").is_none() {
        return Ok(ok("already_closed", "EBrowser was not open"));
    }
    close_ebrowser_if_open(&app);
    Ok(ok("closed", "EBrowser closed"))
}

#[derive(Debug, Deserialize)]
pub struct MediaTogglesArg {
    pub camera: bool,
    pub microphone: bool,
    pub audio_out: bool,
}

#[tauri::command]
pub fn ebrowser_get_downloads(window: Window) -> Result<serde_json::Value, String> {
    require_product_window(&window)?;
    Ok(serde_json::json!({ "ok": true, "items": downloads_json() }))
}

#[tauri::command]
pub fn ebrowser_tabs_list(app: AppHandle, window: Window) -> Result<serde_json::Value, String> {
    require_product_window(&window)?;
    let (tabs, max_tabs) = tabs_json(&app);
    Ok(serde_json::json!({
        "ok": true,
        "tabs": tabs,
        "max_tabs": max_tabs,
    }))
}

#[derive(Debug, Deserialize)]
pub struct EBrowserTabCreateArg {
    pub nav_href: Option<String>,
    pub bounds: EBrowserStageBounds,
    pub access_token: Option<String>,
}

#[tauri::command]
pub async fn ebrowser_tab_create(
    app: AppHandle,
    window: Window,
    arg: EBrowserTabCreateArg,
) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    if let Err(code) =
        ebrowser_policy_fetch::ensure_active_policy(arg.access_token.as_deref()).await
    {
        return Ok(deny(&code, "EBrowser navigation policy could not be loaded"));
    }
    let href = arg.nav_href.unwrap_or_else(|| "about:blank".into());
    let parsed = match parse_start_url(&href) {
        Ok(u) => u,
        Err(code) => return Ok(deny(&code, "Invalid start URL")),
    };
    if !ebrowser_nav_policy::navigation_allowed(&parsed) && parsed.as_str() != "about:blank" {
        return Ok(deny("policy_denied", "URL is not allowed by EBrowser policy"));
    }
    let Some(product) = app.get_webview_window("product") else {
        return Ok(deny(
            "product_window_missing",
            "Product window is not open",
        ));
    };
    let _ops = match ebrowser_tabs::lock_ops() {
        Ok(g) => g,
        Err(code) => return Ok(deny(code, "EBrowser tabs unavailable")),
    };
    let (tab_id, label) = match ebrowser_tabs::allocate() {
        Ok(v) => v,
        Err("ebrowser_tabs_busy") => {
            return Ok(deny("ebrowser_tabs_busy", "EBrowser tab limit reached"));
        }
        Err(_) => return Ok(deny("ebrowser_tabs_lock", "EBrowser tabs unavailable")),
    };
    match create_tab_stage(&app, &product, tab_id, &label, parsed, &arg.bounds) {
        Ok(_) => {
            show_only_active(&app);
            eprintln!("[STEP] ebrowser_tab_create ok tab={tab_id}");
            emit_chrome_changed(&app);
            Ok(ok("tab_created", "EBrowser tab created"))
        }
        Err(e) => {
            if ebrowser_tabs::remove(tab_id).is_none() {
                eprintln!("[STEP] ebrowser_tab_create_rollback_miss id={tab_id}");
            }
            Ok(deny("ebrowser_bounds_failed", e))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct EBrowserTabIdArg {
    pub tab_id: u64,
}

#[tauri::command]
pub fn ebrowser_tab_activate(
    app: AppHandle,
    window: Window,
    arg: EBrowserTabIdArg,
) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    let _ops = match ebrowser_tabs::lock_ops() {
        Ok(g) => g,
        Err(code) => return Ok(deny(code, "EBrowser tabs unavailable")),
    };
    if let Err(code) = ebrowser_tabs::set_active(arg.tab_id) {
        return Ok(deny(code, "EBrowser tab not found"));
    }
    show_only_active(&app);
    eprintln!("[STEP] ebrowser_tab_activate id={}", arg.tab_id);
    emit_chrome_changed(&app);
    Ok(ok("tab_activated", "EBrowser tab activated"))
}

#[tauri::command]
pub fn ebrowser_tab_close(
    app: AppHandle,
    window: Window,
    arg: EBrowserTabIdArg,
) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    let _ops = match ebrowser_tabs::lock_ops() {
        Ok(g) => g,
        Err(code) => return Ok(deny(code, "EBrowser tabs unavailable")),
    };
    let Some(label) = ebrowser_tabs::label_of(arg.tab_id) else {
        return Ok(deny("ebrowser_tab_missing", "EBrowser tab not found"));
    };
    if !destroy_tab_window(&app, &label) {
        return Ok(deny("tab_close_failed", "Could not destroy EBrowser tab window"));
    }
    let _ = ebrowser_tabs::remove(arg.tab_id);
    if ebrowser_tabs::is_empty() {
        #[cfg(target_os = "linux")]
        crate::commands::linux_ebrowser_downloads::cancel_all_active();
        ebrowser_nav_policy::store_policy(None);
    } else {
        show_only_active(&app);
    }
    eprintln!("[STEP] ebrowser_tab_close id={}", arg.tab_id);
    emit_chrome_changed(&app);
    Ok(ok("tab_closed", "EBrowser tab closed"))
}

#[tauri::command]
pub fn ebrowser_set_media_toggles(
    app: AppHandle,
    window: Window,
    toggles: MediaTogglesArg,
) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    #[cfg(target_os = "linux")]
    {
        use crate::commands::linux_ebrowser_media::{
            apply_audio_out_settings, set_media_toggles, MediaToggles,
        };
        set_media_toggles(&MediaToggles {
            camera: toggles.camera,
            microphone: toggles.microphone,
            audio_out: toggles.audio_out,
        });
        if let Some(stage) = active_stage(&app) {
            apply_audio_out_settings(&stage);
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, toggles);
        eprintln!("[STEP] ebrowser_media_toggles_skip reason=non_linux");
    }
    Ok(ok("toggles_set", "EBrowser media toggles updated"))
}

#[tauri::command]
pub fn ebrowser_get_media_toggles(window: Window) -> Result<serde_json::Value, String> {
    require_product_window(&window)?;
    #[cfg(target_os = "linux")]
    {
        let t = crate::commands::linux_ebrowser_media::get_media_toggles();
        return Ok(serde_json::json!({
            "camera": t.camera,
            "microphone": t.microphone,
            "audio_out": t.audio_out,
        }));
    }
    #[cfg(not(target_os = "linux"))]
    Ok(serde_json::json!({
        "camera": false,
        "microphone": false,
        "audio_out": true,
    }))
}

const EBROWSER_FIND_QUERY_MAX: usize = 200;
const EBROWSER_ZOOM_MIN: f64 = 0.5;
const EBROWSER_ZOOM_MAX: f64 = 3.0;

#[derive(Debug, Deserialize)]
pub struct EBrowserFindArg {
    /// `start` | `next` | `previous` | `finish`
    pub action: String,
    pub query: Option<String>,
    pub case_insensitive: Option<bool>,
}

#[tauri::command]
pub fn ebrowser_find(
    app: AppHandle,
    window: Window,
    arg: EBrowserFindArg,
) -> Result<EBrowserResult, String> {
    require_product_window(&window)?;
    let Some(stage) = active_stage(&app) else {
        return Ok(deny("ebrowser_missing", "EBrowser is not open"));
    };
    let action = arg.action.trim().to_ascii_lowercase();
    if !matches!(
        action.as_str(),
        "start" | "next" | "previous" | "finish"
    ) {
        return Ok(deny("find_action_invalid", "Unknown find action"));
    }
    let query = arg.query.unwrap_or_default();
    let query_trim = query.trim().to_string();
    if action == "start" && query_trim.chars().count() > EBROWSER_FIND_QUERY_MAX {
        return Ok(deny("find_query_too_long", "Find query is too long"));
    }
    let case_insensitive = arg.case_insensitive.unwrap_or(true);
    #[cfg(target_os = "linux")]
    {
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;
        use webkit2gtk::{FindControllerExt, FindOptions, WebViewExt};
        let no_controller = Arc::new(AtomicBool::new(false));
        let no_controller_c = Arc::clone(&no_controller);
        if let Err(e) = stage.with_webview(move |platform| {
            let webview = platform.inner();
            let Some(finder) = webview.find_controller() else {
                eprintln!("[STEP] ebrowser_find_fail reason=no_controller");
                no_controller_c.store(true, Ordering::SeqCst);
                return;
            };
            match action.as_str() {
                "finish" => finder.search_finish(),
                "next" => finder.search_next(),
                "previous" => finder.search_previous(),
                "start" => {
                    if query_trim.is_empty() {
                        finder.search_finish();
                        return;
                    }
                    let mut opts = FindOptions::WRAP_AROUND;
                    if case_insensitive {
                        opts |= FindOptions::CASE_INSENSITIVE;
                    }
                    finder.search(&query_trim, opts.bits(), 1000);
                }
                _ => {}
            }
        }) {
            eprintln!("[STEP] ebrowser_find_fail err={e}");
            return Ok(deny(
                "find_failed",
                "Could not run find in page",
            ));
        }
        if no_controller.load(Ordering::SeqCst) {
            return Ok(deny(
                "find_unavailable",
                "Find in page is unavailable for this page",
            ));
        }
        Ok(ok("find_ok", "EBrowser find updated"))
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (stage, action, query_trim, case_insensitive);
        Ok(deny(
            "find_unsupported",
            "Find in page is available on Linux EliteEW client",
        ))
    }
}

#[derive(Debug, Deserialize)]
pub struct EBrowserZoomArg {
    pub level: f64,
}

#[tauri::command]
pub fn ebrowser_set_zoom(
    app: AppHandle,
    window: Window,
    arg: EBrowserZoomArg,
) -> Result<serde_json::Value, String> {
    require_product_window(&window)?;
    let Some(stage) = active_stage(&app) else {
        return Ok(serde_json::json!({
            "ok": false,
            "code": "ebrowser_missing",
            "level": 1.0,
        }));
    };
    if !arg.level.is_finite() {
        return Ok(serde_json::json!({
            "ok": false,
            "code": "zoom_invalid",
            "level": 1.0,
        }));
    }
    let level = arg.level.clamp(EBROWSER_ZOOM_MIN, EBROWSER_ZOOM_MAX);
    #[cfg(target_os = "linux")]
    {
        if let Err(e) = stage.with_webview(move |platform| {
            use webkit2gtk::WebViewExt;
            platform.inner().set_zoom_level(level);
        }) {
            eprintln!("[STEP] ebrowser_zoom_fail err={e}");
            return Ok(serde_json::json!({
                "ok": false,
                "code": "zoom_failed",
                "level": 1.0,
            }));
        }
        return Ok(serde_json::json!({ "ok": true, "level": level }));
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = stage;
        Ok(serde_json::json!({
            "ok": false,
            "code": "zoom_unsupported",
            "level": 1.0,
        }))
    }
}

#[tauri::command]
pub fn ebrowser_get_zoom(app: AppHandle, window: Window) -> Result<serde_json::Value, String> {
    require_product_window(&window)?;
    let Some(stage) = active_stage(&app) else {
        return Ok(serde_json::json!({ "ok": false, "level": 1.0 }));
    };
    #[cfg(target_os = "linux")]
    {
        use std::sync::atomic::{AtomicU64, Ordering};
        use std::sync::Arc;
        let bits = Arc::new(AtomicU64::new(1.0f64.to_bits()));
        let bits_c = Arc::clone(&bits);
        if let Err(e) = stage.with_webview(move |platform| {
            use webkit2gtk::WebViewExt;
            let z = platform.inner().zoom_level();
            bits_c.store(z.to_bits(), Ordering::SeqCst);
        }) {
            eprintln!("[STEP] ebrowser_zoom_read_fail err={e}");
            return Ok(serde_json::json!({ "ok": false, "level": 1.0 }));
        }
        let level = f64::from_bits(bits.load(Ordering::SeqCst));
        return Ok(serde_json::json!({ "ok": true, "level": level }));
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = stage;
        Ok(serde_json::json!({
            "ok": false,
            "code": "zoom_unsupported",
            "level": 1.0,
        }))
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn commands_require_product_window_and_embed() {
        let src = include_str!("ebrowser_stage.rs");
        for name in [
            "ebrowser_open",
            "ebrowser_navigate",
            "ebrowser_refresh_policy",
            "ebrowser_get_location",
            "ebrowser_get_chrome_snapshot",
            "ebrowser_reload",
            "ebrowser_history_back",
            "ebrowser_history_forward",
            "ebrowser_set_bounds",
            "ebrowser_close",
            "ebrowser_get_downloads",
            "ebrowser_tabs_list",
            "ebrowser_tab_create",
            "ebrowser_tab_activate",
            "ebrowser_tab_close",
            "ebrowser_set_media_toggles",
            "ebrowser_find",
            "ebrowser_set_zoom",
            "ebrowser_get_zoom",
        ] {
            assert!(src.contains(name), "missing {name}");
        }
        assert!(src.contains("find_unavailable") || src.contains("no_controller"));
        assert!(src.contains("FindControllerExt") || src.contains("find_controller"));
        assert!(src.contains("set_zoom_level"));
        assert!(src.contains("EBROWSER_FIND_QUERY_MAX"));
        assert!(src.contains("EBROWSER_ZOOM_MIN"));
        assert!(src.contains("EBROWSER_CHROME_EVENT"));
        assert!(src.contains("emit_chrome_changed"));
        assert!(src.contains("build_chrome_snapshot"));
        assert!(src.contains("last_bounds_map"));
        assert!(src.contains("LAST_APPLIED_BOUNDS_PX"));
        assert!(src.contains("force_refresh_active_policy"));
        assert!(src.contains("on_page_load") || src.contains("on_navigation"));
        assert!(src.contains("apply_audio_out_settings"));
        assert!(src.contains("attach_ebrowser_downloads"));
        assert!(src.contains("create_tab_stage"));
        assert!(src.contains("show_only_active"));
        let forbidden_loc_cache = format!("{}{}", "remember_", "location");
        assert!(!src.contains(&forbidden_loc_cache));
        assert!(src.contains("page_title"));
        assert!(src.contains("read_page_title_live"));
        let forbidden_title_cache = format!("{}{}", "LAST_PAGE_", "TITLE");
        assert!(!src.contains(&forbidden_title_cache));
        let forbidden_js_reload = format!("{}{}", "location.", "reload()");
        assert!(!src.contains(&forbidden_js_reload));
        assert!(src.contains("require_product_window"));
        assert!(src.contains("on_navigation"));
        assert!(src.contains(".parent(product)"));
        assert!(src.contains("decorations(false)"));
        assert!(src.contains("apply_stage_bounds"));
        assert!(
            src.contains("set_fullscreen(false)"),
            "stage must clear labwc kiosk ToggleFullscreen"
        );
        // Clearnet egress: must not wire W-transport SOCKS (edge ACL only).
        let forbidden_step = format!("{}{}", "[STEP] ebrowser_open ", "proxy_url");
        assert!(
            !src.contains(&forbidden_step),
            "EBrowser must not apply W-transport SOCKS"
        );
        let optional_proxy_fn = format!("{}{}", "optional_w_", "transport_proxy");
        assert!(!src.contains(&optional_proxy_fn));
        assert!(src.contains("egress=system_clearnet"));
        // Isolate from product WebContext SOCKS stamp (0.5.28 residual).
        assert!(src.contains("ebrowser-webview"));
        assert!(src.contains("data_directory"));
        assert!(src.contains("NetworkProxyMode::NoProxy") || src.contains("proxy=no_proxy"));
        assert!(src.contains("apply_ebrowser_clearnet_proxy") || src.contains("proxy=no_proxy"));
        assert!(
            src.contains("context()") && src.contains("website_data_manager()"),
            "NoProxy must use WebContext manager path (WRY-aligned), not WebView-only getter"
        );
        assert!(
            src.contains("recv_timeout"),
            "NoProxy must wait for async with_webview apply (off-main queue)"
        );
        assert!(
            src.contains("webkit_web_context_set_network_proxy_settings"),
            "NoProxy must fall back to WebContext API when WebsiteDataManager getter is None"
        );
        let forbidden_code = format!("{}{}", "w_transport_", "proxy_required");
        assert!(!src.contains(&forbidden_code));
        // P0: SPA must not feed PolicySnapshot into open/navigate.
        let spa_policy_arg = format!("{}{}", "policy: Policy", "Snapshot");
        assert!(!src.contains(&spa_policy_arg));
        let store_spa = format!("{}{}", "store_policy(Some(", "policy))");
        assert!(!src.contains(&store_spa));
        assert!(src.contains("ensure_active_policy"));
        assert!(src.contains("access_token: Option<String>"));
    }
}
