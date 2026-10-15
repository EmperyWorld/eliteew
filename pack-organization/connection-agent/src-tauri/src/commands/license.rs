// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// License status probe; HTTP license_redeem retired (Capsule v2 / device request).
// Invariants:
// - license_redeem never performs caller-URL HTTP (Wave 5 / F-06).
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md F-06
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
// ---

use crate::error::StubResult;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct RedeemFailView {
    pub ok: bool,
    pub status: u16,
    pub code: String,
    pub message: String,
}

/// Wave 3a+ status probe (HTTP redeem retired in Wave 5).
#[tauri::command]
pub fn license_status() -> StubResult {
    StubResult::ok_msg(
        "capsule_activation",
        "use capsule_import_channel / device request — license_redeem IPC is retired",
    )
}

/// Wave 5: Capsule activation supersedes HTTP license_redeem (no caller HTTP base).
#[tauri::command]
pub async fn license_redeem(
    legacy_a: String,
    legacy_b: String,
    legacy_c: String,
    legacy_d: String,
) -> Result<serde_json::Value, String> {
    let _ = (legacy_a, legacy_b, legacy_c, legacy_d);
    Ok(serde_json::to_value(RedeemFailView {
        ok: false,
        status: 410,
        code: "license_redeem_removed".into(),
        message: "Активация ключом недоступна. Импортируйте файл доступа от администратора."
            .into(),
    })
    .map_err(|e| e.to_string())?)
}
