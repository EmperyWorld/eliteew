// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Shared OpenAI-compat chat POST for local / third_party native AI (O3c/O3d).
// Invariants:
// - Never log Authorization / API keys; optional bearer only on request.
// Related:
// - commands/ai_local.rs, commands/ai_third_party.rs
// ---

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AiChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct OpenAiChatOutcome {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub reply: Option<String>,
}

pub fn trim_base(raw: &str) -> String {
    raw.trim().trim_end_matches('/').to_string()
}

pub fn extract_openai_assistant_text(body: &serde_json::Value) -> Option<String> {
    let content = body
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    if content.is_some() {
        return content;
    }
    body.get("message")
        .and_then(|m| m.get("content"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(|| {
            body.get("response")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        })
}

/// Local loopback AI — never forced through EliteEW W-transport.
pub async fn post_openai_chat_local(
    base_url: &str,
    model: &str,
    messages: &[AiChatMessage],
) -> Result<OpenAiChatOutcome, String> {
    crate::fofline_egress::assert_local_ai_loopback_url(base_url)?;
    let client = crate::fofline_egress::fofline_native_http_client_for(
        crate::fofline_egress::NativeEgressClass::LocalAiLoopback,
        120,
    )?;
    post_openai_chat_with_client(base_url, model, messages, None, Some(client)).await
}

/// Explicit third-party AI base — direct egress by seat choice.
pub async fn post_openai_chat_third_party(
    base_url: &str,
    model: &str,
    messages: &[AiChatMessage],
    api_key: Option<&str>,
) -> Result<OpenAiChatOutcome, String> {
    let _origin = crate::native_egress_policy::validate_user_approved_third_party_ai_url(base_url)?;
    crate::fofline_egress::assert_third_party_not_eliteew_host(base_url)?;
    let client = crate::fofline_egress::fofline_native_http_client_for(
        crate::fofline_egress::NativeEgressClass::ThirdPartyExplicit,
        120,
    )?;
    post_openai_chat_with_client(base_url, model, messages, api_key, Some(client)).await
}

/// EliteEW platform AI — must use W-transport SOCKS when gate is on (fail-closed).
pub async fn post_openai_chat_eliteew(
    base_url: &str,
    model: &str,
    messages: &[AiChatMessage],
) -> Result<OpenAiChatOutcome, String> {
    let client = crate::fofline_egress::fofline_native_http_client(120)?;
    post_openai_chat_with_client(base_url, model, messages, None, Some(client)).await
}

async fn post_openai_chat_with_client(
    base_url: &str,
    model: &str,
    messages: &[AiChatMessage],
    api_key: Option<&str>,
    client: Option<reqwest::Client>,
) -> Result<OpenAiChatOutcome, String> {
    let base = trim_base(base_url);
    if messages.is_empty() {
        return Ok(OpenAiChatOutcome {
            ok: false,
            code: "empty_messages".into(),
            message: "Пустой запрос".into(),
            reply: None,
        });
    }
    let payload = serde_json::json!({
        "model": model,
        "messages": messages.iter().map(|m| {
            serde_json::json!({ "role": m.role, "content": m.content })
        }).collect::<Vec<_>>(),
        "stream": false,
    });
    let url = format!("{base}/v1/chat/completions");
    let client = client.ok_or_else(|| {
        "http_client_required: native AI HTTP must use typed egress client".to_string()
    })?;

    let mut req = client.post(&url).json(&payload);
    if let Some(key) = api_key.map(str::trim).filter(|s| !s.is_empty()) {
        req = req.bearer_auth(key);
    }

    let response = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            return Ok(OpenAiChatOutcome {
                ok: false,
                code: "unreachable".into(),
                message: format!("AI недоступен ({e}). Endpoint: {base}"),
                reply: None,
            });
        }
    };

    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if !status.is_success() {
        let snippet: String = text.chars().take(200).collect();
        return Ok(OpenAiChatOutcome {
            ok: false,
            code: "http_error".into(),
            message: format!("HTTP {status}: {snippet}"),
            reply: None,
        });
    }

    let body: serde_json::Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => {
            return Ok(OpenAiChatOutcome {
                ok: false,
                code: "bad_json".into(),
                message: "Ответ AI не JSON".into(),
                reply: None,
            });
        }
    };

    match extract_openai_assistant_text(&body) {
        Some(reply) => Ok(OpenAiChatOutcome {
            ok: true,
            code: "ok".into(),
            message: "Ответ получен".into(),
            reply: Some(reply),
        }),
        None => Ok(OpenAiChatOutcome {
            ok: false,
            code: "empty_reply".into(),
            message: "AI вернул пустой ответ".into(),
            reply: None,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_openai_content() {
        let body = serde_json::json!({
            "choices": [{ "message": { "role": "assistant", "content": "  hi  " } }]
        });
        assert_eq!(extract_openai_assistant_text(&body).as_deref(), Some("hi"));
    }

    #[test]
    fn extract_empty_none() {
        let body = serde_json::json!({ "choices": [{ "message": { "content": "" } }] });
        assert!(extract_openai_assistant_text(&body).is_none());
    }
}
