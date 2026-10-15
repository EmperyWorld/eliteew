// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wave 7 — opaque TTL file grants via relative Import path or native rfd picker.
// Invariants:
// - JS never receives or re-sends absolute host paths for privileged ops.
// - Picker copies into Import then issues a relative grant.
// Related:
// - crate::file_grant
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §Wave 7
// ---

use std::fs;
use std::path::Path;

use tauri::{AppHandle, Manager, Window};

use crate::caller_context::require_main_window;
use crate::file_grant::{self, FileGrantView};
use crate::fs_bridge;

fn app_data(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

fn sanitize_name(name: &str) -> Option<String> {
    let base = Path::new(name)
        .file_name()
        .and_then(|s| s.to_str())?
        .trim();
    if base.is_empty() || base == "." || base == ".." {
        return None;
    }
    if base.chars().any(|c| matches!(c, '/' | '\\' | '\0')) {
        return None;
    }
    Some(base.to_string())
}

fn assert_known_purpose(purpose: &str) -> Result<(), String> {
    match purpose.trim() {
        "entitlement_import" | "audio_play" | "fs_read" => Ok(()),
        other => Err(format!("unknown_grant_purpose:{other}")),
    }
}

/// Issue a grant for a relative path already under Import/staging.
#[tauri::command]
pub fn file_grant_issue(
    app: AppHandle,
    window: Window,
    root: String,
    relative: String,
    purpose: String,
) -> Result<FileGrantView, String> {
    require_main_window(&window)?;
    let data = app_data(&app)?;
    file_grant::issue(&data, &root, &relative, &purpose)
}

/// Native OS file picker → copy into Import → opaque grant (no absolute path to JS).
#[tauri::command]
pub async fn file_grant_pick(
    app: AppHandle,
    window: Window,
    purpose: String,
) -> Result<FileGrantView, String> {
    require_main_window(&window)?;
    let data = app_data(&app)?;
    assert_known_purpose(&purpose)?;

    let picked = rfd::AsyncFileDialog::new()
        .set_title("Выберите файл EliteEW")
        .pick_file()
        .await
        .ok_or_else(|| "grant_pick_cancelled".to_string())?;

    let src = picked.path().to_path_buf();
    let name = sanitize_name(
        src.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("picked.bin"),
    )
    .ok_or_else(|| "grant_pick_bad_name".to_string())?;

    let _ = fs_bridge::ensure_roots(&data).map_err(|e| e.message())?;
    let dest = fs_bridge::resolve_relative_under_root(&data, "import", &name)
        .map_err(|e| e.message())?;
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir import: {e}"))?;
    }
    fs::copy(&src, &dest).map_err(|e| format!("copy_into_import: {e}"))?;
    eprintln!(
        "[STEP] file_grant_pick_copied purpose={} name={name}",
        purpose.trim()
    );
    file_grant::issue(&data, "import", &name, purpose.trim())
}
