// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri commands for Stage 2 FS bridge (allowlisted list/read/atomic-write).
// Invariants:
// - Soft deny returns ok=false + fs_deny (no panic); structured [STEP] logs in core.
// - Does not replace Content Manager / SeaweedFS — import source only.
// - Main-window only: product WebView must not list/read/write Import/staging (F-01 / F-11).
// Related:
// - crate::fs_bridge
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.2
// ---

use base64::Engine;
use serde::Serialize;
use tauri::AppHandle;
use tauri::Manager;
use tauri::Window;

use crate::caller_context::require_main_window;
use crate::fs_bridge::{self, FsBridgeError, FsEntry, FsRootInfo};

#[derive(Debug, Clone, Serialize)]
pub struct FsBridgeRootsView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roots: Option<Vec<FsRootInfo>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FsBridgeListView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entries: Option<Vec<FsEntry>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FsBridgeReadView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// UTF-8 text when decodable; otherwise omit and use `bytes_b64`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_b64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FsBridgeWriteView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

fn app_data(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

fn fail_roots(err: FsBridgeError) -> FsBridgeRootsView {
    FsBridgeRootsView {
        ok: false,
        code: err.code().into(),
        message: err.message(),
        roots: None,
    }
}

fn fail_list(err: FsBridgeError) -> FsBridgeListView {
    FsBridgeListView {
        ok: false,
        code: err.code().into(),
        message: err.message(),
        path: None,
        entries: None,
    }
}

fn fail_read(err: FsBridgeError) -> FsBridgeReadView {
    FsBridgeReadView {
        ok: false,
        code: err.code().into(),
        message: err.message(),
        path: None,
        text: None,
        bytes_b64: None,
        size: None,
    }
}

fn fail_write(err: FsBridgeError) -> FsBridgeWriteView {
    FsBridgeWriteView {
        ok: false,
        code: err.code().into(),
        message: err.message(),
        path: None,
        size: None,
    }
}

/// Ensure allowlisted roots exist and return their absolute paths.
#[tauri::command]
pub fn fs_bridge_roots(app: AppHandle, window: Window) -> Result<FsBridgeRootsView, String> {
    require_main_window(&window)?;
    let data = app_data(&app)?;
    match fs_bridge::ensure_roots(&data) {
        Ok(roots) => Ok(FsBridgeRootsView {
            ok: true,
            code: "ok".into(),
            message: "Разрешённые корни Import и staging готовы".into(),
            roots: Some(roots),
        }),
        Err(e) => Ok(fail_roots(e)),
    }
}

/// List entries under an allowlisted path (`max_depth` capped in core).
#[tauri::command]
pub fn fs_bridge_list_dir(
    app: AppHandle,
    window: Window,
    path: String,
    max_depth: Option<u32>,
) -> Result<FsBridgeListView, String> {
    require_main_window(&window)?;
    let data = app_data(&app)?;
    let depth = max_depth.unwrap_or(0);
    match fs_bridge::list_dir(&data, &path, depth) {
        Ok(entries) => Ok(FsBridgeListView {
            ok: true,
            code: "ok".into(),
            message: format!("Записей: {}", entries.len()),
            path: Some(path),
            entries: Some(entries),
        }),
        Err(e) => Ok(fail_list(e)),
    }
}

/// Read a file under allowlist (≤ 32 MiB). Prefer `text` when UTF-8; always set size.
#[tauri::command]
pub fn fs_bridge_read_file(
    app: AppHandle,
    window: Window,
    path: String,
) -> Result<FsBridgeReadView, String> {
    require_main_window(&window)?;
    let data = app_data(&app)?;
    match fs_bridge::read_file(&data, &path) {
        Ok((resolved, bytes)) => {
            let size = bytes.len() as u64;
            let text = String::from_utf8(bytes.clone()).ok();
            let bytes_b64 = if text.is_some() {
                None
            } else {
                Some(base64::engine::general_purpose::STANDARD.encode(&bytes))
            };
            Ok(FsBridgeReadView {
                ok: true,
                code: "ok".into(),
                message: "Файл прочитан".into(),
                path: Some(resolved.display().to_string()),
                text,
                bytes_b64,
                size: Some(size),
            })
        }
        Err(e) => Ok(fail_read(e)),
    }
}

/// Atomic write (tmp + fsync + rename) under allowlist. Body as UTF-8 text or base64.
#[tauri::command]
pub fn fs_bridge_write_atomic(
    app: AppHandle,
    window: Window,
    path: String,
    text: Option<String>,
    bytes_b64: Option<String>,
) -> Result<FsBridgeWriteView, String> {
    require_main_window(&window)?;
    let data = app_data(&app)?;
    let bytes = match (text, bytes_b64) {
        (Some(t), None) => t.into_bytes(),
        (None, Some(b64)) => {
            match base64::engine::general_purpose::STANDARD.decode(b64.trim()) {
                Ok(v) => v,
                Err(e) => {
                    return Ok(fail_write(FsBridgeError::Invalid(format!(
                        "bytes_b64: {e}"
                    ))));
                }
            }
        }
        (Some(_), Some(_)) => {
            return Ok(fail_write(FsBridgeError::Invalid(
                "задайте либо text, либо bytes_b64 — не оба".into(),
            )));
        }
        (None, None) => {
            return Ok(fail_write(FsBridgeError::Invalid(
                "нужен text или bytes_b64".into(),
            )));
        }
    };
    let size = bytes.len() as u64;
    match fs_bridge::write_atomic(&data, &path, &bytes) {
        Ok(resolved) => Ok(FsBridgeWriteView {
            ok: true,
            code: "written".into(),
            message: "Файл записан атомарно".into(),
            path: Some(resolved.display().to_string()),
            size: Some(size),
        }),
        Err(e) => Ok(fail_write(e)),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn ipc_commands_require_main_window() {
        let src = include_str!("fs_bridge.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(
            prod.contains("require_main_window"),
            "fs_bridge IPC must deny product WebView"
        );
        for name in [
            "fs_bridge_roots",
            "fs_bridge_list_dir",
            "fs_bridge_read_file",
            "fs_bridge_write_atomic",
        ] {
            let needle = format!("pub fn {name}");
            let idx = prod.find(&needle).unwrap_or_else(|| panic!("missing {name}"));
            let window = prod[idx..].find("window: Window");
            let require = prod[idx..].find("require_main_window(&window)");
            assert!(
                window.is_some() && require.is_some() && window.unwrap() < require.unwrap(),
                "{name} must take Window then require_main_window"
            );
        }
    }
}
