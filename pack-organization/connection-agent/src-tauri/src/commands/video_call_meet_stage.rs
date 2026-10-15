// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Top-level Meet WebviewWindow staged over VideoCallApp (no nested iframe).
// Nested cross-origin Meet iframes paint blank in WebKitGTK product WebView.
// Invariants:
// - Product window only; join_url allowlisted to https://meet.eliteew.ru with jwt=.
// - Bounds are CSS pixels relative to the product webview viewport.
// - W-transport SOCKS applied when fail-closed (same as product_open).
// - Linux: Meet stage WebView gets WebRTC settings + UserMedia permission allow
//   (product SPA Portal grant does not cover this separate WebView).
// Related:
// - documentation/product/INTERNAL-VIDEO-CALLS.md
// - documentation/product/mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md (Android top-level WebView)
// ---

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder, Window,
};

use crate::caller_context::require_product_window;
use crate::fofline_egress::navigation_allowed_for_connected_cloud;
use crate::wg::userspace::{w_transport_enabled, w_transport_proxy_url};

pub const MEET_STAGE_LABEL: &str = "video-call-meet";

#[derive(Debug, Clone, Deserialize)]
pub struct MeetStageBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize)]
pub struct MeetStageResult {
    pub ok: bool,
    pub code: String,
    pub message: String,
}

fn deny(code: &str, message: impl AsRef<str>) -> MeetStageResult {
    MeetStageResult {
        ok: false,
        code: code.into(),
        message: message.as_ref().into(),
    }
}

fn ok(code: &str, message: &str) -> MeetStageResult {
    MeetStageResult {
        ok: true,
        code: code.into(),
        message: message.into(),
    }
}

/// Fail-closed join URL parser — https meet.eliteew.ru + non-empty jwt query only.
pub fn parse_meet_join_url(raw: &str) -> Result<url::Url, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("meet_join_url_empty".into());
    }
    if trimmed.len() > 8192 {
        return Err("meet_join_url_too_long".into());
    }
    let parsed = url::Url::parse(trimmed).map_err(|_| "meet_join_url_invalid".to_string())?;
    if parsed.scheme() != "https" {
        return Err("meet_join_url_scheme".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("meet_join_url_userinfo".into());
    }
    let Some(host) = parsed.host_str() else {
        return Err("meet_join_url_host".into());
    };
    let host_l = host.to_ascii_lowercase();
    if host_l != "meet.eliteew.ru" && !host_l.ends_with(".meet.eliteew.ru") {
        return Err("meet_join_url_host".into());
    }
    let has_jwt = parsed
        .query_pairs()
        .any(|(k, v)| k == "jwt" && !v.trim().is_empty());
    if !has_jwt {
        return Err("meet_join_url_jwt_required".into());
    }
    Ok(parsed)
}

fn apply_stage_bounds(
    stage: &WebviewWindow,
    product: &WebviewWindow,
    bounds: &MeetStageBounds,
) -> Result<(), String> {
    if !bounds.x.is_finite()
        || !bounds.y.is_finite()
        || !bounds.width.is_finite()
        || !bounds.height.is_finite()
    {
        return Err("meet_stage_bounds_invalid".into());
    }
    if bounds.width < 48.0 || bounds.height < 48.0 {
        let _ = stage.hide();
        return Ok(());
    }
    let scale = product.scale_factor().unwrap_or(1.0);
    if scale <= 0.0 {
        return Err("meet_stage_scale_invalid".into());
    }
    let origin = product
        .inner_position()
        .map_err(|e| format!("product_inner_position: {e}"))?;
    let px = (origin.x as f64 + bounds.x * scale).round() as i32;
    let py = (origin.y as f64 + bounds.y * scale).round() as i32;
    let pw = (bounds.width * scale).round().max(48.0) as u32;
    let ph = (bounds.height * scale).round().max(48.0) as u32;
    stage
        .set_position(Position::Physical(PhysicalPosition::new(px, py)))
        .map_err(|e| format!("meet_stage_set_position: {e}"))?;
    stage
        .set_size(Size::Physical(PhysicalSize::new(pw, ph)))
        .map_err(|e| format!("meet_stage_set_size: {e}"))?;
    if let Err(e) = stage.set_fullscreen(false) {
        eprintln!("[STEP] meet_stage fullscreen_clear_fail err={e}");
    }
    let _ = stage.show();
    Ok(())
}

fn optional_w_transport_proxy() -> Result<Option<url::Url>, String> {
    if !w_transport_enabled() {
        return Ok(None);
    }
    let plan = w_transport_proxy_url();
    match plan.proxy_url.filter(|_| plan.fail_closed) {
        Some(proxy) => {
            let parsed: url::Url = proxy
                .parse()
                .map_err(|e| format!("invalid W-transport proxy_url: {e}"))?;
            Ok(Some(parsed))
        }
        None => Err(format!(
            "w_transport_proxy_required:{}",
            plan.message
        )),
    }
}

/// Close Meet stage if open (logout / end-call / product teardown).
pub fn close_meet_stage_if_open(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MEET_STAGE_LABEL) {
        match w.destroy() {
            Ok(()) => eprintln!("[STEP] video_call_meet_stage_close destroyed=true"),
            Err(e) => eprintln!("[STEP] video_call_meet_stage_close_fail err={e}"),
        }
    }
}

#[tauri::command]
pub fn video_call_meet_stage_open(
    app: AppHandle,
    window: Window,
    join_url: String,
    bounds: MeetStageBounds,
) -> Result<MeetStageResult, String> {
    require_product_window(&window)?;
    let parsed = match parse_meet_join_url(&join_url) {
        Ok(u) => u,
        Err(code) => {
            eprintln!("[STEP] video_call_meet_stage_open_deny code={code}");
            return Ok(deny(&code, "Meet URL is not allowed"));
        }
    };
    let Some(product) = app.get_webview_window("product") else {
        return Ok(deny(
            "product_window_missing",
            "Product window is not open",
        ));
    };

    let proxy = match optional_w_transport_proxy() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[STEP] video_call_meet_stage_open_deny reason=w_transport err={e}");
            return Ok(deny(
                "w_transport_proxy_required",
                "Private tunnel required for Meet",
            ));
        }
    };

    if let Some(existing) = app.get_webview_window(MEET_STAGE_LABEL) {
        if let Err(e) = existing.navigate(parsed.clone()) {
            eprintln!("[STEP] video_call_meet_stage_navigate_fail err={e}");
            let _ = existing.destroy();
        } else if let Err(e) = apply_stage_bounds(&existing, &product, &bounds) {
            eprintln!("[STEP] video_call_meet_stage_bounds_fail err={e}");
            return Ok(deny("meet_stage_bounds_failed", e));
        } else {
            let _ = existing.set_focus();
            eprintln!("[STEP] video_call_meet_stage_open reused=true");
            return Ok(ok("focused", "Meet stage reused"));
        }
    }

    let mut builder = WebviewWindowBuilder::new(&app, MEET_STAGE_LABEL, WebviewUrl::External(parsed))
        .title("EliteEW Video")
        .decorations(false)
        .skip_taskbar(true)
        .resizable(false)
        .inner_size(bounds.width.max(48.0), bounds.height.max(48.0))
        .on_navigation(|nav_url| navigation_allowed_for_connected_cloud(nav_url));

    builder = builder
        .parent(&product)
        .map_err(|e| format!("meet_stage_parent: {e}"))?;

    if let Some(proxy_url) = proxy {
        builder = builder.proxy_url(proxy_url);
        eprintln!("[STEP] video_call_meet_stage_open proxy_url applied");
    }

    let stage = builder
        .build()
        .map_err(|e| format!("create meet stage window: {e}"))?;

    #[cfg(target_os = "linux")]
    crate::commands::linux_meet_media::attach_meet_stage_media(&stage);

    if let Err(e) = apply_stage_bounds(&stage, &product, &bounds) {
        eprintln!("[STEP] video_call_meet_stage_bounds_fail err={e}");
        let _ = stage.destroy();
        return Ok(deny("meet_stage_bounds_failed", e));
    }

    eprintln!("[STEP] video_call_meet_stage_open opened=true");
    Ok(ok("opened", "Meet stage opened"))
}

#[tauri::command]
pub fn video_call_meet_stage_set_bounds(
    app: AppHandle,
    window: Window,
    bounds: MeetStageBounds,
) -> Result<MeetStageResult, String> {
    require_product_window(&window)?;
    let Some(stage) = app.get_webview_window(MEET_STAGE_LABEL) else {
        return Ok(deny("meet_stage_missing", "Meet stage is not open"));
    };
    let Some(product) = app.get_webview_window("product") else {
        return Ok(deny(
            "product_window_missing",
            "Product window is not open",
        ));
    };
    if let Err(e) = apply_stage_bounds(&stage, &product, &bounds) {
        eprintln!("[STEP] video_call_meet_stage_bounds_fail err={e}");
        return Ok(deny("meet_stage_bounds_failed", e));
    }
    Ok(ok("bounds_set", "Meet stage bounds updated"))
}

#[tauri::command]
pub fn video_call_meet_stage_close(
    app: AppHandle,
    window: Window,
) -> Result<MeetStageResult, String> {
    require_product_window(&window)?;
    if app.get_webview_window(MEET_STAGE_LABEL).is_none() {
        return Ok(ok("already_closed", "Meet stage was not open"));
    }
    close_meet_stage_if_open(&app);
    Ok(ok("closed", "Meet stage closed"))
}

#[cfg(test)]
mod tests {
    use super::parse_meet_join_url;

    #[test]
    fn allowlists_https_meet_with_jwt() {
        let u = parse_meet_join_url(
            "https://meet.eliteew.ru/ew-gaf-abc?jwt=eyJhbGciOiJIUzI1NiJ9.e30.sig#config.x=1",
        )
        .unwrap();
        assert_eq!(u.host_str(), Some("meet.eliteew.ru"));
    }

    #[test]
    fn denies_missing_jwt_and_foreign_hosts() {
        assert_eq!(
            parse_meet_join_url("https://meet.eliteew.ru/room").unwrap_err(),
            "meet_join_url_jwt_required"
        );
        assert_eq!(
            parse_meet_join_url("https://evil.example/x?jwt=a").unwrap_err(),
            "meet_join_url_host"
        );
        assert_eq!(
            parse_meet_join_url("http://meet.eliteew.ru/x?jwt=a").unwrap_err(),
            "meet_join_url_scheme"
        );
        assert!(parse_meet_join_url(
            "https://user:pass@meet.eliteew.ru/x?jwt=a"
        )
        .is_err());
    }
}
