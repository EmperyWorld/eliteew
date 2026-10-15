// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// O5 clipboard read/write + local history (ClipboardManager panel).
// Invariants:
// - OS clipboard via arboard; history stays in app data.
// - Product WebView (`label=product`) cannot invoke OS clipboard IPC (FoFline quarantine).
// - FoFline bundle identifier → isolated history file.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md
// ---

use serde::Serialize;
use tauri::AppHandle;
use tauri::Manager;
use tauri::Window;

use crate::clipboard_history::{self, ClipboardEntry};

#[derive(Debug, Clone, Serialize)]
pub struct ClipboardView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub history: Option<Vec<ClipboardEntry>>,
}

fn app_data(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

fn is_fofline_bundle(app: &AppHandle) -> bool {
    app.config().identifier.contains("fofline")
}

fn deny_if_product_window(window: &Window) -> Option<ClipboardView> {
    if window.label() != "product" {
        return None;
    }
    eprintln!("[STEP] clipboard_quarantine deny window=product");
    Some(ClipboardView {
        ok: false,
        code: "clipboard_quarantine".into(),
        message: "Буфер ОС недоступен из окна продукта (карантин)".into(),
        text: None,
        history: None,
    })
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn clipboard_status(app: AppHandle, window: Window) -> Result<ClipboardView, String> {
    if let Some(deny) = deny_if_product_window(&window) {
        return Ok(deny);
    }
    let data = app_data(&app)?;
    let fofline = is_fofline_bundle(&app);
    let history = clipboard_history::load_for(&data, fofline)?;
    let text = arboard::Clipboard::new()
        .ok()
        .and_then(|mut c| c.get_text().ok());
    Ok(ClipboardView {
        ok: true,
        code: "ok".into(),
        message: "Буфер и история доступны локально".into(),
        text,
        history: Some(history.entries),
    })
}

#[tauri::command]
pub fn clipboard_read(app: AppHandle, window: Window) -> Result<ClipboardView, String> {
    if let Some(deny) = deny_if_product_window(&window) {
        return Ok(deny);
    }
    let data = app_data(&app)?;
    let fofline = is_fofline_bundle(&app);
    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("clipboard_init: {e}"))?;
    let text = clipboard
        .get_text()
        .map_err(|e| format!("clipboard_read: {e}"))?;
    let mut history = clipboard_history::load_for(&data, fofline)?;
    clipboard_history::push_entry(&mut history, text.clone(), now_unix());
    clipboard_history::persist_for(&data, &history, fofline)?;
    Ok(ClipboardView {
        ok: true,
        code: "read".into(),
        message: "Скопировано в историю".into(),
        text: Some(text),
        history: Some(history.entries),
    })
}

#[tauri::command]
pub fn clipboard_write(
    app: AppHandle,
    window: Window,
    text: String,
) -> Result<ClipboardView, String> {
    if let Some(deny) = deny_if_product_window(&window) {
        return Ok(deny);
    }
    let data = app_data(&app)?;
    let fofline = is_fofline_bundle(&app);
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return Ok(ClipboardView {
            ok: false,
            code: "empty".into(),
            message: "Пустой текст — нечего записать в буфер".into(),
            text: None,
            history: None,
        });
    }
    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("clipboard_init: {e}"))?;
    clipboard
        .set_text(trimmed.clone())
        .map_err(|e| format!("clipboard_write: {e}"))?;
    let mut history = clipboard_history::load_for(&data, fofline)?;
    clipboard_history::push_entry(&mut history, trimmed.clone(), now_unix());
    clipboard_history::persist_for(&data, &history, fofline)?;
    Ok(ClipboardView {
        ok: true,
        code: "written".into(),
        message: "Текст записан в системный буфер".into(),
        text: Some(trimmed),
        history: Some(history.entries),
    })
}
