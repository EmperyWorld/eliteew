// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Linux WebKitGTK media capture for the Meet stage WebView (camera / mic / WebRTC).
// Invariants:
// - Only UserMedia + DeviceInfo permission requests are allowed (Meet getUserMedia).
// - enable-media-stream + enable-webrtc are forced on; autoplay gesture gate off.
// - Attaches once per WebView; OS Portal prompt still appears when PipeWire asks.
// Related:
// - commands/video_call_meet_stage.rs
// - documentation/product/INTERNAL-VIDEO-CALLS.md
// - documentation/product/mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md (Android grant pattern)
// ---

use tauri::WebviewWindow;

/// Wire WebRTC settings + allow UserMedia/DeviceInfo on the Meet stage WebView.
///
/// Without `permission-request` handling, WebKitGTK denies getUserMedia (NotAllowedError).
/// Product-SPA Portal prompts before the call do **not** cover this separate WebView.
pub fn attach_meet_stage_media(win: &WebviewWindow) {
    if let Err(e) = win.with_webview(|platform| {
        use webkit2gtk::glib::Cast;
        use webkit2gtk::{
            DeviceInfoPermissionRequest, PermissionRequestExt, SettingsExt,
            UserMediaPermissionRequest, UserMediaPermissionRequestExt, WebViewExt,
        };

        let webview = platform.inner();
        if let Some(settings) = webview.settings() {
            settings.set_enable_media(true);
            settings.set_enable_media_stream(true);
            settings.set_enable_mediasource(true);
            settings.set_enable_webrtc(true);
            settings.set_media_playback_allows_inline(true);
            settings.set_media_playback_requires_user_gesture(false);
            eprintln!(
                "[STEP] video_call_meet_stage_media settings webrtc={} media_stream={}",
                settings.enables_webrtc() as u8,
                settings.enables_media_stream() as u8
            );
        } else {
            eprintln!("[STEP] video_call_meet_stage_media_skip reason=no_settings");
        }

        webview.connect_permission_request(move |_view, request| {
            if let Ok(user_media) = request.clone().downcast::<UserMediaPermissionRequest>() {
                let audio = user_media.is_for_audio_device();
                let video = user_media.is_for_video_device();
                eprintln!(
                    "[STEP] video_call_meet_stage_permission allow kind=user_media audio={} video={}",
                    audio as u8, video as u8
                );
                request.allow();
                return true;
            }
            if request
                .clone()
                .downcast::<DeviceInfoPermissionRequest>()
                .is_ok()
            {
                eprintln!("[STEP] video_call_meet_stage_permission allow kind=device_info");
                request.allow();
                return true;
            }
            eprintln!("[STEP] video_call_meet_stage_permission deny kind=other");
            request.deny();
            true
        });
        eprintln!("[STEP] video_call_meet_stage_media attached=permission_request");
    }) {
        eprintln!("[STEP] video_call_meet_stage_media_fail err={e}");
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_documents_permission_cause() {
        let src = include_str!("linux_meet_media.rs");
        assert!(src.contains("connect_permission_request"));
        assert!(src.contains("UserMediaPermissionRequest"));
        assert!(src.contains("set_enable_webrtc"));
        assert!(src.contains("set_enable_media_stream"));
    }
}
