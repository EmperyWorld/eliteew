// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri commands for local entitlement status / import (offline O0+O1).
// Invariants:
// - Import verifies Ed25519 before persist; never accepts unsigned claims.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// ---

use tauri::{Manager, Window};

use crate::caller_context::require_main_window;
use crate::file_grant::{self, FileGrantPurpose};
use crate::resource_policy::{assert_ipc_bytes, ENTITLEMENT_IPC_MAX_BYTES};
use crate::client_defaults;
use crate::commands::sealed_store::app_identifier;
use crate::device_identity;
use crate::entitlement::{self, EntitlementStatusView};

fn app_data(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

fn local_fp(app_data: &std::path::PathBuf) -> Option<String> {
    device_identity::load_or_create(app_data)
        .ok()
        .map(|id| id.machine_fingerprint)
}

fn baked_pk(app: &tauri::AppHandle) -> Option<String> {
    client_defaults::resolve_entitlement_pubkey_hex(app)
}

#[tauri::command]
pub fn entitlement_status(
    app: tauri::AppHandle,
    window: Window,
) -> Result<EntitlementStatusView, String> {
    require_main_window(&window)?;
    let data = app_data(&app)?;
    let fp = local_fp(&data);
    let baked = baked_pk(&app);
    Ok(entitlement::status_from_app_data(
        &data,
        fp.as_deref(),
        baked.as_deref(),
        Some(&app_identifier(&app)),
    ))
}

#[tauri::command]
pub fn entitlement_import_json(
    app: tauri::AppHandle,
    window: Window,
    raw_json: String,
) -> Result<EntitlementStatusView, String> {
    require_main_window(&window)?;
    assert_ipc_bytes("entitlement", &raw_json, ENTITLEMENT_IPC_MAX_BYTES)?;
    let data = app_data(&app)?;
    let fp = local_fp(&data);
    let baked = baked_pk(&app);
    entitlement::import_and_store(
        &data,
        &raw_json,
        fp.as_deref(),
        baked.as_deref(),
        Some(&app_identifier(&app)),
    )
}

/// Import entitlement JSON from an opaque file grant (Wave 7 / F-11).
#[tauri::command]
pub fn entitlement_import_from_grant(
    app: tauri::AppHandle,
    window: Window,
    grant_id: String,
) -> Result<EntitlementStatusView, String> {
    require_main_window(&window)?;
    let data = app_data(&app)?;
    let path = file_grant::consume(&data, &grant_id, FileGrantPurpose::EntitlementImport)?;
    let raw_json = std::fs::read_to_string(&path).map_err(|e| format!("grant_read: {e}"))?;
    assert_ipc_bytes("entitlement", &raw_json, ENTITLEMENT_IPC_MAX_BYTES)?;
    let fp = local_fp(&data);
    let baked = baked_pk(&app);
    entitlement::import_and_store(
        &data,
        &raw_json,
        fp.as_deref(),
        baked.as_deref(),
        Some(&app_identifier(&app)),
    )
}
