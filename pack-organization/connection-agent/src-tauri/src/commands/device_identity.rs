// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Expose local device identity for license redeem (Wave 3a).
// Invariants:
// - Persists under app data; does not call mobile APIs.
// Related:
// - crate::device_identity
// ---

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::device_identity::{self, DeviceIdentity};

#[derive(Debug, Serialize)]
pub struct DeviceIdentityView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub device_pubkey: String,
    pub machine_fingerprint: String,
}

#[tauri::command]
pub fn device_identity_ensure(app: AppHandle) -> Result<DeviceIdentityView, String> {
    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    let identity: DeviceIdentity = device_identity::load_or_create(&data)?;
    Ok(DeviceIdentityView {
        ok: true,
        code: "ready".into(),
        message: "device identity ready".into(),
        device_pubkey: identity.device_pubkey,
        machine_fingerprint: identity.machine_fingerprint,
    })
}

#[tauri::command]
pub fn device_identity_status(app: AppHandle) -> Result<DeviceIdentityView, String> {
    device_identity_ensure(app)
}
