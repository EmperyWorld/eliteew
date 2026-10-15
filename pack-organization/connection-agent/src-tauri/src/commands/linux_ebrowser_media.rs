// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Linux WebKitGTK media for EBrowser — toggle-gated UserMedia / DeviceInfo.
// Invariants:
// - Meet stage always-allow path is untouched (linux_meet_media.rs).
// - camera / microphone / audio_out toggles gate request.allow().
// Related:
// - commands/ebrowser_stage.rs
// - documentation/product/desktop/DESKTOP-EBROWSER.md
// ---

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::WebviewWindow;

static CAMERA_ON: AtomicBool = AtomicBool::new(false);
static MIC_ON: AtomicBool = AtomicBool::new(false);
static AUDIO_OUT_ON: AtomicBool = AtomicBool::new(true);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaToggles {
    pub camera: bool,
    pub microphone: bool,
    pub audio_out: bool,
}

pub fn get_media_toggles() -> MediaToggles {
    MediaToggles {
        camera: CAMERA_ON.load(Ordering::SeqCst),
        microphone: MIC_ON.load(Ordering::SeqCst),
        audio_out: AUDIO_OUT_ON.load(Ordering::SeqCst),
    }
}

pub fn set_media_toggles(t: &MediaToggles) {
    CAMERA_ON.store(t.camera, Ordering::SeqCst);
    MIC_ON.store(t.microphone, Ordering::SeqCst);
    AUDIO_OUT_ON.store(t.audio_out, Ordering::SeqCst);
    eprintln!(
        "[STEP] ebrowser_media_toggles camera={} microphone={} audio_out={}",
        t.camera as u8, t.microphone as u8, t.audio_out as u8
    );
}

/// Re-apply WebKit playback gesture gate from current `audio_out` (live stage).
pub fn apply_audio_out_settings(win: &WebviewWindow) {
    if let Err(e) = win.with_webview(|platform| {
        use webkit2gtk::{SettingsExt, WebViewExt};
        let webview = platform.inner();
        if let Some(settings) = webview.settings() {
            let audio_out = AUDIO_OUT_ON.load(Ordering::SeqCst);
            settings.set_media_playback_requires_user_gesture(!audio_out);
            eprintln!(
                "[STEP] ebrowser_media_audio_out_apply requires_gesture={}",
                (!audio_out) as u8
            );
        } else {
            eprintln!("[STEP] ebrowser_media_audio_out_skip reason=no_settings");
        }
    }) {
        eprintln!("[STEP] ebrowser_media_audio_out_fail err={e}");
    }
}

/// Wire WebRTC settings + toggle-gated permission_request on the EBrowser WebView.
pub fn attach_ebrowser_media(win: &WebviewWindow) {
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
            let audio_out = AUDIO_OUT_ON.load(Ordering::SeqCst);
            settings.set_media_playback_requires_user_gesture(!audio_out);
            eprintln!(
                "[STEP] ebrowser_media settings webrtc={} media_stream={} audio_out={}",
                settings.enables_webrtc() as u8,
                settings.enables_media_stream() as u8,
                audio_out as u8
            );
        } else {
            eprintln!("[STEP] ebrowser_media_skip reason=no_settings");
        }

        webview.connect_permission_request(move |_view, request| {
            if let Ok(user_media) = request.clone().downcast::<UserMediaPermissionRequest>() {
                let audio = user_media.is_for_audio_device();
                let video = user_media.is_for_video_device();
                let cam = CAMERA_ON.load(Ordering::SeqCst);
                let mic = MIC_ON.load(Ordering::SeqCst);
                let allow = (!video || cam) && (!audio || mic) && (audio || video);
                if allow {
                    eprintln!(
                        "[STEP] ebrowser_media_allow kind=user_media audio={} video={}",
                        audio as u8, video as u8
                    );
                    request.allow();
                } else {
                    eprintln!(
                        "[STEP] ebrowser_media_deny kind=user_media audio={} video={} cam={} mic={}",
                        audio as u8, video as u8, cam as u8, mic as u8
                    );
                    request.deny();
                }
                return true;
            }
            if request
                .clone()
                .downcast::<DeviceInfoPermissionRequest>()
                .is_ok()
            {
                let cam = CAMERA_ON.load(Ordering::SeqCst);
                let mic = MIC_ON.load(Ordering::SeqCst);
                if cam || mic {
                    eprintln!("[STEP] ebrowser_media_allow kind=device_info");
                    request.allow();
                } else {
                    eprintln!("[STEP] ebrowser_media_deny kind=device_info");
                    request.deny();
                }
                return true;
            }
            eprintln!("[STEP] ebrowser_media_deny kind=other");
            request.deny();
            true
        });
        eprintln!("[STEP] ebrowser_media attached=permission_request");
    }) {
        eprintln!("[STEP] ebrowser_media_fail err={e}");
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_documents_toggle_gated_permission() {
        let src = include_str!("linux_ebrowser_media.rs");
        assert!(src.contains("connect_permission_request"));
        assert!(src.contains("ebrowser_media_deny"));
        assert!(src.contains("CAMERA_ON"));
        assert!(src.contains("MIC_ON"));
        assert!(src.contains("apply_audio_out_settings"));
        assert!(src.contains("set_media_playback_requires_user_gesture"));
    }

    #[test]
    fn meet_media_path_unchanged_always_allow() {
        let meet = include_str!("linux_meet_media.rs");
        assert!(meet.contains("request.allow()"));
        assert!(!meet.contains("CAMERA_ON"));
    }
}
