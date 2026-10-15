// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri commands for ops-only wg-portal handoff (Wave 2 typed helper contour).
// Invariants:
// - Conf must pass portal split-tunnel checks before elevation / staging.
// Related:
// - crate::wg
// ---

use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::wg::conf_validate::validate_portal_handoff_conf;
use crate::ops::portal_service::{
    app_wg_staging_dir, bring_down, bring_up, install_handoff_conf, probe_status, WgPortalStatus,
};

#[tauri::command]
pub fn wg_status(app: AppHandle) -> WgPortalStatus {
    #[cfg(windows)]
    {
        let data = match app.path().app_data_dir() {
            Ok(p) => p,
            Err(_) => {
                return WgPortalStatus {
                    ok: false,
                    code: "status_error".into(),
                    message: "Не удалось открыть каталог данных приложения".into(),
                    unit_active: false,
                    conf_present: false,
                    staged_path: None,
                };
            }
        };
        return probe_status(&app_wg_staging_dir(data));
    }
    #[cfg(unix)]
    {
        let _ = app;
        probe_status()
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = app;
        WgPortalStatus {
            ok: false,
            code: "unsupported".into(),
            message: "unsupported platform".into(),
            unit_active: false,
            conf_present: false,
            staged_path: None,
        }
    }
}

#[tauri::command]
pub fn wg_validate_handoff(conf_text: String) -> Result<WgPortalStatus, String> {
    validate_portal_handoff_conf(&conf_text).map_err(|e| format!("{}: {}", e.code, e.message))?;
    Ok(WgPortalStatus {
        ok: true,
        code: "valid".into(),
        message: "Конфиг проходит проверки портала".into(),
        unit_active: false,
        conf_present: false,
        staged_path: None,
    })
}

#[tauri::command]
pub fn wg_install_handoff(app: AppHandle, conf_text: String) -> Result<WgPortalStatus, String> {
    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    install_handoff_conf(&conf_text, &app_wg_staging_dir(data))
}

#[tauri::command]
pub fn wg_bring_up() -> Result<WgPortalStatus, String> {
    bring_up()
}

#[tauri::command]
pub fn wg_bring_down() -> Result<WgPortalStatus, String> {
    bring_down()
}

#[tauri::command]
pub fn wg_reveal_staged(app: AppHandle) -> Result<WgPortalStatus, String> {
    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    let staging = app_wg_staging_dir(data);
    let staged = staging.join("wg-portal.conf");
    if !staged.is_file() {
        return Ok(WgPortalStatus {
            ok: false,
            code: "conf_missing".into(),
            message: "Сначала установите конфиг — файл ещё не сохранён".into(),
            unit_active: false,
            conf_present: false,
            staged_path: None,
        });
    }
    let path = staged
        .to_str()
        .ok_or_else(|| "staged path not utf-8".to_string())?;
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|e| format!("reveal_staged: {e}"))?;
    Ok(WgPortalStatus {
        ok: true,
        code: "windows_conf_staged".into(),
        message: format!("Открыта папка с конфигом: {path}"),
        unit_active: false,
        conf_present: true,
        staged_path: Some(path.to_string()),
    })
}
