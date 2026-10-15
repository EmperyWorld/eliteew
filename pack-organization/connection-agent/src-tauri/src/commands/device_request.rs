// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// IPC: prepare signed device_request_v1 and export under Import allowlist.
// Invariants:
// - Returns public request JSON only; never private keys.
// - Export path is under EliteEW/Import only.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-03
// ---

use tauri::{AppHandle, Manager};

use crate::commands::sealed_store::app_identifier;
use crate::device_request::{self, DeviceRequestPrepareView};

#[tauri::command]
pub fn device_request_prepare(app: AppHandle) -> Result<DeviceRequestPrepareView, String> {
    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    let id = app_identifier(&app);
    let (req, display) = device_request::build_signed_request(&data, &id)?;
    device_request::verify_request(&req)?;
    let request_json = serde_json::to_string(&req).map_err(|e| e.to_string())?;
    // Fail closed: code-alone is not a handoff — Admin needs the JSON file.
    let export_path = device_request::export_to_import(&data, &req)
        .map(|p| p.display().to_string())
        .map_err(|e| {
            eprintln!("[STEP] device_request_export_fail reason={e}");
            format!(
                "Не удалось сохранить файл запроса устройства ({e}). Проверьте каталог ~/EliteEW/Import и повторите."
            )
        })?;
    Ok(DeviceRequestPrepareView {
        ok: true,
        code: "ready".into(),
        message: format!(
            "Запрос устройства готов. Файл: {export_path}. Передайте его администратору."
        ),
        display_fingerprint: display,
        request: req,
        request_json,
        export_path: Some(export_path),
    })
}

#[tauri::command]
pub fn device_request_status(app: AppHandle) -> Result<DeviceRequestPrepareView, String> {
    // Status reuses prepare for idempotent key ensure + fresh request each call
    // (each hand-to-hand issue needs a fresh request_id/nonce).
    device_request_prepare(app)
}
