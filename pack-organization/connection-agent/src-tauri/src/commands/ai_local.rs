// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// O3c local AI chat — OpenAI-compat call to device LLM (ai.local), no stack0.
// Invariants:
// - Fail closed without base URL + model; never log secrets (local has none).
// - third_party handled in ai_third_party (O3d).
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// ---

use crate::ai_http::{self, AiChatMessage};
use crate::client_defaults;
use crate::resource_policy::assert_ai_chat_bounds;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
pub struct AiLocalStatusView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiLocalChatView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply: Option<String>,
}

#[tauri::command]
pub fn ai_local_status(app: AppHandle) -> AiLocalStatusView {
    let base = client_defaults::resolve_ai_local_base_url(&app).map(|s| ai_http::trim_base(&s));
    let model = client_defaults::resolve_ai_local_model(&app);
    match (&base, &model) {
        (None, _) => AiLocalStatusView {
            ok: false,
            code: "not_configured".into(),
            message: "Локальный AI не настроен — задайте ai_local_base_url в релизе"
                .into(),
            base_url: None,
            model: None,
        },
        (Some(url), None) => AiLocalStatusView {
            ok: false,
            code: "model_required".into(),
            message: "Укажите модель (ai_local_model в релизе или поле в панели)".into(),
            base_url: Some(url.clone()),
            model: None,
        },
        (Some(url), Some(m)) => AiLocalStatusView {
            ok: true,
            code: "ready".into(),
            message: format!("Локальный AI · {m}"),
            base_url: Some(url.clone()),
            model: Some(m.clone()),
        },
    }
}

#[tauri::command]
pub async fn ai_local_chat(
    app: AppHandle,
    messages: Vec<AiChatMessage>,
    model: Option<String>,
) -> Result<AiLocalChatView, String> {
    assert_ai_chat_bounds(
        messages.len(),
        messages.iter().map(|m| m.content.as_str()),
    )?;

    let Some(base_raw) = client_defaults::resolve_ai_local_base_url(&app) else {
        return Ok(AiLocalChatView {
            ok: false,
            code: "not_configured".into(),
            message: "Локальный AI: нет base URL".into(),
            reply: None,
        });
    };
    let base = ai_http::trim_base(&base_raw);
    let resolved_model = model
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| client_defaults::resolve_ai_local_model(&app));
    let Some(model_id) = resolved_model else {
        return Ok(AiLocalChatView {
            ok: false,
            code: "model_required".into(),
            message: "Локальный AI: модель не задана".into(),
            reply: None,
        });
    };

    let out = ai_http::post_openai_chat_local(&base, &model_id, &messages).await?;
    Ok(AiLocalChatView {
        ok: out.ok,
        code: out.code,
        message: out.message,
        reply: out.reply,
    })
}
