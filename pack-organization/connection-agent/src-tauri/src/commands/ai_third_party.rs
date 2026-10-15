// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// O3d ai.third_party — settings + OS keyring key + OpenAI-compat chat.
// Invariants:
// - API key never returned to FE; URL/model in app data only.
// - Base URL must pass UserApprovedThirdPartyAi policy; key bound to origin.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md F-05/F-06
// ---

use crate::resource_policy::assert_ai_chat_bounds;
use crate::ai_http::{self, AiChatMessage};
use crate::ai_secrets::{self, KeySource};
use crate::ai_third_party_settings::{self, ThirdPartyAiSettings};
use crate::native_egress_policy::validate_user_approved_third_party_ai_url;
use serde::Serialize;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
pub struct AiThirdPartyStatusView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub has_api_key: bool,
    pub key_source: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiThirdPartyChatView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply: Option<String>,
}

fn app_data(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

fn origin_or_none(base: &str) -> Option<String> {
    validate_user_approved_third_party_ai_url(base).ok()
}

#[tauri::command]
pub fn ai_third_party_status(app: AppHandle) -> Result<AiThirdPartyStatusView, String> {
    let data = app_data(&app)?;
    let settings = ai_third_party_settings::load(&data)?;
    let base = ai_http::trim_base(&settings.base_url);
    let model = settings.model.trim().to_string();
    let origin = origin_or_none(&base);
    let src = match origin.as_deref() {
        Some(o) => ai_secrets::probe_key_source_for_origin(o),
        None => KeySource::None,
    };
    let has_key = src != KeySource::None;
    let key_source = ai_secrets::key_source_label(src).to_string();

    if base.is_empty() {
        return Ok(AiThirdPartyStatusView {
            ok: false,
            code: "not_configured".into(),
            message: "Укажите URL стороннего OpenAI-совместимого API".into(),
            base_url: None,
            model: if model.is_empty() { None } else { Some(model) },
            has_api_key: has_key,
            key_source,
        });
    }
    if origin.is_none() {
        return Ok(AiThirdPartyStatusView {
            ok: false,
            code: "url_rejected".into(),
            message: "Адрес API отклонён политикой безопасности (нужен HTTPS и подтверждённый origin)"
                .into(),
            base_url: Some(base),
            model: if model.is_empty() { None } else { Some(model) },
            has_api_key: false,
            key_source,
        });
    }
    if model.is_empty() {
        return Ok(AiThirdPartyStatusView {
            ok: false,
            code: "model_required".into(),
            message: "Укажите модель стороннего AI".into(),
            base_url: Some(base),
            model: None,
            has_api_key: has_key,
            key_source,
        });
    }
    if !has_key {
        return Ok(AiThirdPartyStatusView {
            ok: false,
            code: "key_required".into(),
            message: "Сохраните API key в OS keyring для этого адреса".into(),
            base_url: Some(base),
            model: Some(model),
            has_api_key: false,
            key_source,
        });
    }
    Ok(AiThirdPartyStatusView {
        ok: true,
        code: "ready".into(),
        message: format!("Сторонний AI · {model} ({key_source})"),
        base_url: Some(base),
        model: Some(model),
        has_api_key: true,
        key_source,
    })
}

#[tauri::command]
pub fn ai_third_party_save_settings(
    app: AppHandle,
    api_origin: String,
    model: String,
) -> Result<AiThirdPartyStatusView, String> {
    let data = app_data(&app)?;
    let previous = ai_third_party_settings::load(&data)?;
    let prev_origin = origin_or_none(&ai_http::trim_base(&previous.base_url));
    let next_origin = validate_user_approved_third_party_ai_url(&api_origin)?;
    ai_secrets::clear_api_key_on_origin_change(prev_origin.as_deref(), &next_origin)?;
    let settings = ThirdPartyAiSettings {
        base_url: ai_http::trim_base(&api_origin),
        model: model.trim().to_string(),
    };
    ai_third_party_settings::save(&data, &settings)?;
    ai_third_party_status(app)
}

#[tauri::command]
pub fn ai_third_party_save_api_key(
    app: AppHandle,
    api_key: String,
) -> Result<AiThirdPartyStatusView, String> {
    let data = app_data(&app)?;
    let settings = ai_third_party_settings::load(&data)?;
    let origin = validate_user_approved_third_party_ai_url(&settings.base_url)?;
    ai_secrets::store_api_key_for_origin(&origin, &api_key)?;
    ai_third_party_status(app)
}

#[tauri::command]
pub fn ai_third_party_clear_api_key(app: AppHandle) -> Result<AiThirdPartyStatusView, String> {
    let data = app_data(&app)?;
    let settings = ai_third_party_settings::load(&data)?;
    if let Ok(origin) = validate_user_approved_third_party_ai_url(&settings.base_url) {
        ai_secrets::clear_api_key_for_origin(&origin)?;
    } else {
        ai_secrets::clear_legacy_unbound_api_key()?;
    }
    let mut view = ai_third_party_status(app)?;
    view.code = "key_cleared".into();
    view.message = "API key удалён из keyring".into();
    Ok(view)
}

#[tauri::command]
pub async fn ai_third_party_chat(
    app: AppHandle,
    messages: Vec<AiChatMessage>,
    model: Option<String>,
) -> Result<AiThirdPartyChatView, String> {
    assert_ai_chat_bounds(
        messages.len(),
        messages.iter().map(|m| m.content.as_str()),
    )?;

    let data = app_data(&app)?;
    let settings = ai_third_party_settings::load(&data)?;
    let base = ai_http::trim_base(&settings.base_url);
    let origin = match validate_user_approved_third_party_ai_url(&base) {
        Ok(o) => o,
        Err(msg) => {
            return Ok(AiThirdPartyChatView {
                ok: false,
                code: "url_rejected".into(),
                message: msg,
                reply: None,
            });
        }
    };
    if base.is_empty() {
        return Ok(AiThirdPartyChatView {
            ok: false,
            code: "not_configured".into(),
            message: "Сторонний AI: нет base URL".into(),
            reply: None,
        });
    }
    let model_id = model
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| settings.model.trim().to_string());
    if model_id.is_empty() {
        return Ok(AiThirdPartyChatView {
            ok: false,
            code: "model_required".into(),
            message: "Сторонний AI: модель не задана".into(),
            reply: None,
        });
    }
    let (api_key, _src) = match ai_secrets::load_api_key_for_origin(&origin) {
        Ok(v) => v,
        Err(msg) => {
            return Ok(AiThirdPartyChatView {
                ok: false,
                code: "key_required".into(),
                message: msg,
                reply: None,
            });
        }
    };

    let out =
        ai_http::post_openai_chat_third_party(&base, &model_id, &messages, Some(&api_key)).await?;
    Ok(AiThirdPartyChatView {
        ok: out.ok,
        code: out.code,
        message: out.message,
        reply: out.reply,
    })
}
