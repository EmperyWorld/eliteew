// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// O3e ai.eliteew — platform LLM OpenAI-compat when network reachable.
// Invariants:
// - Fail closed without base URL/model; offline → honest offline code (no fake success).
// - No third-party API keys; no silent call when unreachable.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// ---

use crate::ai_http::{self, AiChatMessage};
use crate::client_defaults;
use crate::resource_policy::assert_ai_chat_bounds;
use crate::fofline_egress::fofline_native_http_client;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
pub struct AiEliteewStatusView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub network_ok: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiEliteewChatView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply: Option<String>,
}

async fn probe_reachable(base: &str) -> bool {
    let client = match fofline_native_http_client(3) {
        Ok(c) => c,
        Err(_) => return false,
    };
    let paths = ["/health", "/v1/models", "/api/tags"];
    for path in paths {
        let url = format!("{base}{path}");
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() || resp.status().as_u16() == 401 {
                return true;
            }
        }
    }
    false
}

#[tauri::command]
pub async fn ai_eliteew_status(app: AppHandle) -> AiEliteewStatusView {
    let base = client_defaults::resolve_ai_eliteew_base_url(&app).map(|s| ai_http::trim_base(&s));
    let model = client_defaults::resolve_ai_eliteew_model(&app);

    let Some(url) = base else {
        return AiEliteewStatusView {
            ok: false,
            code: "not_configured".into(),
            message: "EliteEW AI не настроен — задайте ai_eliteew_base_url в релизе"
                .into(),
            base_url: None,
            model: None,
            network_ok: false,
        };
    };

    let network_ok = probe_reachable(&url).await;
    if model.as_ref().map(|m| m.is_empty()).unwrap_or(true) {
        return AiEliteewStatusView {
            ok: false,
            code: "model_required".into(),
            message: "Укажите модель EliteEW AI (ai_eliteew_model в релизе или поле в панели)"
                .into(),
            base_url: Some(url),
            model: None,
            network_ok,
        };
    }

    if !network_ok {
        return AiEliteewStatusView {
            ok: false,
            code: "offline".into(),
            message: "Нет сети до EliteEW AI — поднимите туннель или проверьте endpoint".into(),
            base_url: Some(url),
            model,
            network_ok: false,
        };
    }

    let m = model.clone().unwrap_or_default();
    AiEliteewStatusView {
        ok: true,
        code: "ready".into(),
        message: format!("EliteEW AI · {m}"),
        base_url: Some(url),
        model,
        network_ok: true,
    }
}

#[tauri::command]
pub async fn ai_eliteew_chat(
    app: AppHandle,
    messages: Vec<AiChatMessage>,
    model: Option<String>,
) -> Result<AiEliteewChatView, String> {
    assert_ai_chat_bounds(
        messages.len(),
        messages.iter().map(|m| m.content.as_str()),
    )?;

    let Some(base_raw) = client_defaults::resolve_ai_eliteew_base_url(&app) else {
        return Ok(AiEliteewChatView {
            ok: false,
            code: "not_configured".into(),
            message: "EliteEW AI: нет base URL".into(),
            reply: None,
        });
    };
    let base = ai_http::trim_base(&base_raw);
    if !probe_reachable(&base).await {
        return Ok(AiEliteewChatView {
            ok: false,
            code: "offline".into(),
            message: "EliteEW AI недоступен по сети".into(),
            reply: None,
        });
    }
    let resolved_model = model
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| client_defaults::resolve_ai_eliteew_model(&app));
    let Some(model_id) = resolved_model else {
        return Ok(AiEliteewChatView {
            ok: false,
            code: "model_required".into(),
            message: "EliteEW AI: модель не задана".into(),
            reply: None,
        });
    };

    let out = ai_http::post_openai_chat_eliteew(&base, &model_id, &messages).await?;
    Ok(AiEliteewChatView {
        ok: out.ok,
        code: out.code,
        message: out.message,
        reply: out.reply,
    })
}
