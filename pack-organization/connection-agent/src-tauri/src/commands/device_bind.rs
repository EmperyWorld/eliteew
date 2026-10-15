// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri commands for local hardware seat bind (bind-at-first-import).
// Invariants:
// - Retail mismatch is fail-closed; standalone bind clearing is not exposed.
// Related:
// - crate::device_bind · DESKTOP-FOFLINE-EDITION.md §device bind
// ---

use serde::Serialize;
use tauri::{AppHandle, Manager, Window};

use crate::caller_context::require_main_window;
use crate::device_bind::{self, BindAssert};

#[derive(Debug, Serialize)]
pub struct DeviceBindView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub bound: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub machine_fingerprint: Option<String>,
}

fn app_data(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

#[tauri::command]
pub fn device_bind_status(
    app: AppHandle,
    window: Window,
) -> Result<DeviceBindView, String> {
    require_main_window(&window)?;
    let data = app_data(&app)?;
    match device_bind::assert_local(&data)? {
        BindAssert::Unbound => Ok(DeviceBindView {
            ok: true,
            code: "unbound".into(),
            message: "Лицензия ещё не привязана к этому устройству".into(),
            bound: false,
            license_id: None,
            machine_fingerprint: None,
        }),
        BindAssert::Matched => {
            let b = device_bind::load(&data)?.expect("matched implies bind file");
            Ok(DeviceBindView {
                ok: true,
                code: "bound".into(),
                message: "Лицензия привязана к этому устройству".into(),
                bound: true,
                license_id: Some(b.license_id),
                machine_fingerprint: Some(b.machine_fingerprint),
            })
        }
        BindAssert::Mismatch => {
            let b = device_bind::load(&data)?;
            Ok(DeviceBindView {
                ok: false,
                code: "fingerprint_mismatch".into(),
                message: "Лицензия привязана к другому устройству. Нужен новый пакет доступа для этого компьютера.".into(),
                bound: true,
                license_id: b.as_ref().map(|x| x.license_id.clone()),
                machine_fingerprint: b.map(|x| x.machine_fingerprint),
            })
        }
    }
}

#[tauri::command]
pub fn device_bind_ensure(
    app: AppHandle,
    window: Window,
    license_id: String,
) -> Result<DeviceBindView, String> {
    require_main_window(&window)?;
    let data = app_data(&app)?;
    match device_bind::ensure_bind(&data, &license_id) {
        Ok(b) => Ok(DeviceBindView {
            ok: true,
            code: "bound".into(),
            message: "Лицензия привязана к этому устройству".into(),
            bound: true,
            license_id: Some(b.license_id),
            machine_fingerprint: Some(b.machine_fingerprint),
        }),
        Err(code) if code == "fingerprint_mismatch" => Ok(DeviceBindView {
            ok: false,
            code: "fingerprint_mismatch".into(),
            message: "Лицензия привязана к другому устройству. Нужен новый пакет доступа для этого компьютера.".into(),
            bound: true,
            license_id: Some(license_id),
            machine_fingerprint: None,
        }),
        Err(e) => Ok(DeviceBindView {
            ok: false,
            code: e,
            message: "Не удалось привязать лицензию к устройству".into(),
            bound: false,
            license_id: None,
            machine_fingerprint: None,
        }),
    }
}
