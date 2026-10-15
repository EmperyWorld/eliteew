// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// O4 denylist refresh/check Tauri commands (soft revoke via OTA channel).
// Invariants:
// - Fetch denylist.json from update base; verify with dedicated denylist pubkey (Wave 8).
// - W-transport on → SOCKS via fofline_native_http_client; proxy/network miss → offline_skip.
// - Missing network/cache → not revoked (soft); cache hit + match → revoked.
// - Missing denylist_pubkey_hex → fail closed (pubkey_missing).
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
// ---

use serde::Serialize;
use tauri::AppHandle;
use tauri::Manager;

use crate::client_defaults;
use crate::commands::sealed_store::app_identifier;
use crate::denylist;
use crate::device_identity;
use crate::entitlement;
use crate::fofline_egress::fofline_native_http_client;

#[derive(Debug, Clone, Serialize)]
pub struct DenylistStatusView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub revoked: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub denylist_url: Option<String>,
}

fn app_data(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

fn pubkey_hex(app: &AppHandle) -> Result<String, String> {
    client_defaults::resolve_denylist_pubkey_hex(app)
        .ok_or_else(|| "pubkey_missing".to_string())
}

fn local_license_id(app: &AppHandle, app_data: &std::path::Path) -> Option<String> {
    let data_buf = app_data.to_path_buf();
    let fp = device_identity::load_or_create(&data_buf)
        .ok()
        .map(|id| id.machine_fingerprint);
    let id = app_identifier(app);
    let doc = entitlement::load_document(app_data, Some(&id), fp.as_deref())
        .ok()
        .flatten()?;
    let lid = doc.payload.license_id.trim().to_string();
    if lid.is_empty() {
        None
    } else {
        Some(lid)
    }
}

fn evaluate_cached(
    app: &AppHandle,
    data: &std::path::Path,
    license_id: Option<&str>,
) -> DenylistStatusView {
    let url = client_defaults::resolve_update_url(app)
        .map(|u| denylist::denylist_url_from_update_base(&u));
    let Some(lid) = license_id.map(str::trim).filter(|s| !s.is_empty()) else {
        return DenylistStatusView {
            ok: true,
            code: "no_license".into(),
            message: "Нет локального license_id — denylist не применяется".into(),
            revoked: false,
            license_id: None,
            denylist_url: url,
        };
    };
    let Ok(Some(doc)) = denylist::load_cached(data) else {
        return DenylistStatusView {
            ok: true,
            code: "no_cache".into(),
            message: "Denylist ещё не загружен — soft revoke не активен офлайн".into(),
            revoked: false,
            license_id: Some(lid.to_string()),
            denylist_url: url,
        };
    };
    let pk = match pubkey_hex(app) {
        Ok(v) => v,
        Err(_) => {
            return DenylistStatusView {
                ok: false,
                code: "pubkey_missing".into(),
                message: "Нет denylist pubkey для проверки списка отзыва".into(),
                revoked: false,
                license_id: Some(lid.to_string()),
                denylist_url: url,
            };
        }
    };
    match denylist::verify_document(&doc, &pk) {
        Ok(payload) if denylist::is_revoked(&payload, lid) => DenylistStatusView {
            ok: false,
            code: "revoked".into(),
            message: "Лицензия soft-отозвана (OTA denylist). Запросите re-issue у ops."
                .into(),
            revoked: true,
            license_id: Some(lid.to_string()),
            denylist_url: url,
        },
        Ok(_) => DenylistStatusView {
            ok: true,
            code: "clear".into(),
            message: "Лицензия не в denylist".into(),
            revoked: false,
            license_id: Some(lid.to_string()),
            denylist_url: url,
        },
        Err(e) => DenylistStatusView {
            ok: false,
            code: "cache_invalid".into(),
            message: format!("Кэш denylist невалиден: {e}"),
            revoked: false,
            license_id: Some(lid.to_string()),
            denylist_url: url,
        },
    }
}

#[tauri::command]
pub fn denylist_status(app: AppHandle) -> Result<DenylistStatusView, String> {
    let data = app_data(&app)?;
    let lid = local_license_id(&app, &data);
    Ok(evaluate_cached(&app, &data, lid.as_deref()))
}

#[tauri::command]
pub async fn denylist_refresh(app: AppHandle) -> Result<DenylistStatusView, String> {
    let data = app_data(&app)?;
    let lid = local_license_id(&app, &data);
    let Some(update_url) = client_defaults::resolve_update_url(&app) else {
        return Ok(DenylistStatusView {
            ok: true,
            code: "not_configured".into(),
            message: "OTA URL не задан — denylist refresh пропущен".into(),
            revoked: false,
            license_id: lid,
            denylist_url: None,
        });
    };
    let url = denylist::denylist_url_from_update_base(&update_url);
    let pk = match pubkey_hex(&app) {
        Ok(v) => v,
        Err(_) => {
            return Ok(DenylistStatusView {
                ok: false,
                code: "pubkey_missing".into(),
                message: "Нет denylist pubkey (bake plugins.eliteew-desktop-client.denylist_pubkey_hex)".into(),
                revoked: false,
                license_id: lid,
                denylist_url: Some(url),
            });
        }
    };

    // W-transport on → SOCKS; if proxy down, soft offline_skip (same as network fail).
    let client = match fofline_native_http_client(15) {
        Ok(c) => c,
        Err(e) => {
            let cached = evaluate_cached(&app, &data, lid.as_deref());
            return Ok(DenylistStatusView {
                ok: cached.ok,
                code: if cached.revoked {
                    "revoked".into()
                } else {
                    "offline_skip".into()
                },
                message: format!(
                    "Denylist недоступен ({e}); используем кэш: {}",
                    cached.message
                ),
                revoked: cached.revoked,
                license_id: lid,
                denylist_url: Some(url),
            });
        }
    };

    let response = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            let cached = evaluate_cached(&app, &data, lid.as_deref());
            return Ok(DenylistStatusView {
                ok: cached.ok,
                code: if cached.revoked {
                    "revoked".into()
                } else {
                    "offline_skip".into()
                },
                message: format!(
                    "Denylist недоступен ({e}); используем кэш: {}",
                    cached.message
                ),
                revoked: cached.revoked,
                license_id: lid,
                denylist_url: Some(url),
            });
        }
    };

    if response.status().as_u16() == 404 {
        return Ok(DenylistStatusView {
            ok: true,
            code: "absent".into(),
            message: "denylist.json отсутствует на канале (нет soft-revokes)".into(),
            revoked: false,
            license_id: lid,
            denylist_url: Some(url),
        });
    }
    if !response.status().is_success() {
        return Ok(DenylistStatusView {
            ok: false,
            code: "http_error".into(),
            message: format!("HTTP {} при загрузке denylist", response.status()),
            revoked: false,
            license_id: lid,
            denylist_url: Some(url),
        });
    }

    let text = response.text().await.unwrap_or_default();
    let doc = match denylist::parse_document_json(&text) {
        Ok(d) => d,
        Err(e) => {
            return Ok(DenylistStatusView {
                ok: false,
                code: "bad_json".into(),
                message: e,
                revoked: false,
                license_id: lid,
                denylist_url: Some(url),
            });
        }
    };
    if let Err(e) = denylist::verify_document(&doc, &pk) {
        return Ok(DenylistStatusView {
            ok: false,
            code: "sig_bad".into(),
            message: format!("denylist подпись невалидна: {e}"),
            revoked: false,
            license_id: lid,
            denylist_url: Some(url),
        });
    }
    denylist::persist(&data, &doc)?;
    Ok(evaluate_cached(&app, &data, lid.as_deref()))
}
