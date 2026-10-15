// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri commands for offline MusicPlayer native playback (rodio engine).
// Invariants:
// - Thin wrappers; engine owns mutex + device lifetime.
// - Codec / missing-file failures stay honest (ok=false, stable codes).
// Related:
// - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md §Client edition
// ---

use std::sync::Arc;

use tauri::{AppHandle, Manager, State, Window};

use crate::caller_context::require_main_window;
use crate::file_grant::{self, FileGrantPurpose};
use crate::native_audio::{NativeAudioEngine, NativeAudioView};


#[tauri::command]
pub fn native_audio_pause(
    engine: State<'_, Arc<NativeAudioEngine>>,
) -> Result<NativeAudioView, String> {
    Ok(engine.pause())
}

#[tauri::command]
pub fn native_audio_resume(
    engine: State<'_, Arc<NativeAudioEngine>>,
) -> Result<NativeAudioView, String> {
    Ok(engine.resume())
}

#[tauri::command]
pub fn native_audio_stop(
    engine: State<'_, Arc<NativeAudioEngine>>,
) -> Result<NativeAudioView, String> {
    Ok(engine.stop())
}

#[tauri::command]
pub fn native_audio_seek(
    engine: State<'_, Arc<NativeAudioEngine>>,
    position_secs: f64,
) -> Result<NativeAudioView, String> {
    Ok(engine.seek(position_secs))
}

#[tauri::command]
pub fn native_audio_set_volume(
    engine: State<'_, Arc<NativeAudioEngine>>,
    volume: f32,
) -> Result<NativeAudioView, String> {
    Ok(engine.set_volume(volume))
}

#[tauri::command]
pub fn native_audio_status(
    engine: State<'_, Arc<NativeAudioEngine>>,
) -> Result<NativeAudioView, String> {
    Ok(engine.status())
}

#[tauri::command]
pub fn native_audio_play_from_grant(
    app: AppHandle,
    window: Window,
    engine: State<'_, Arc<NativeAudioEngine>>,
    grant_id: String,
) -> Result<NativeAudioView, String> {
    require_main_window(&window)?;
    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    let path = file_grant::consume(&data, &grant_id, FileGrantPurpose::AudioPlay)?;
    Ok(engine.play_path(&app, &data, &path))
}
