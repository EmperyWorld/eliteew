// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// TLS WebSocket client for Air Capsule delivery (baked host/path; port from code).
// Invariants:
// - No caller-supplied URL; host/path/subprotocol/header are compile-time constants.
// - Capsule binary bounded; SHA-256 verified before return.
// - Secrets never logged.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md §6
// - DESKTOP-CLIENT-SECURITY-BOUNDARIES.md F-06 / F-13
// ---

use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::{header, HeaderValue};
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{connect_async, tungstenite::Error as WsError};
use zeroize::Zeroize;

use crate::air_enroll_code::{AccessCode, PORT_MAX, PORT_MIN};
use crate::device_request::DeviceRequestV1;

const HOST: &str = "app.eliteew.ru";
const PATH: &str = "/api/v1/desktop-client/air-enroll/ws";
const SUBPROTOCOL: &str = "eliteew-air-enroll-v1";
const INGRESS_HEADER: &str = "edge-v1";
const MAX_CAPSULE_BYTES: usize = 256 * 1024;
const MAX_TEXT_FRAME_BYTES: usize = 16 * 1024;
const CONNECT_TIMEOUT_SECS: u64 = 20;
const FRAME_TIMEOUT_SECS: u64 = 30;
const ACK_TIMEOUT_SECS: u64 = 120;

#[derive(Debug, Deserialize)]
struct CapsuleMeta {
    #[serde(rename = "type")]
    frame_type: String,
    length: usize,
    sha256: String,
    request_id: String,
    #[serde(default)]
    redelivery: bool,
}

pub struct DeliveredCapsule {
    pub bytes: Vec<u8>,
    pub request_id: String,
    pub sha256: String,
    pub redelivery: bool,
}

impl Drop for DeliveredCapsule {
    fn drop(&mut self) {
        self.bytes.zeroize();
    }
}

fn build_wss_request(port: u16) -> Result<tokio_tungstenite::tungstenite::http::Request<()>, String> {
    if !(PORT_MIN..=PORT_MAX).contains(&port) {
        return Err("air_code_port_range".into());
    }
    let url = format!("wss://{HOST}:{port}{PATH}");
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("air_ws_request:{e}"))?;
    // Defense in depth: reject any unexpected rewrite.
    let uri = request.uri();
    if uri.scheme_str() != Some("wss") {
        return Err("air_ws_scheme".into());
    }
    if uri.host() != Some(HOST) {
        return Err("air_ws_host".into());
    }
    if uri.port_u16() != Some(port) {
        return Err("air_ws_port".into());
    }
    if uri.path() != PATH {
        return Err("air_ws_path".into());
    }
    request.headers_mut().insert(
        header::SEC_WEBSOCKET_PROTOCOL,
        HeaderValue::from_static(SUBPROTOCOL),
    );
    request.headers_mut().insert(
        header::HeaderName::from_static("x-eliteew-air-ingress"),
        HeaderValue::from_static(INGRESS_HEADER),
    );
    Ok(request)
}

async fn recv_message<S>(
    stream: &mut S,
    timeout_secs: u64,
) -> Result<Message, String>
where
    S: StreamExt<Item = Result<Message, WsError>> + Unpin,
{
    let next = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        stream.next(),
    )
    .await
    .map_err(|_| "air_ws_timeout".to_string())?;
    match next {
        Some(Ok(msg)) => Ok(msg),
        Some(Err(e)) => Err(format!("air_ws_recv:{e}")),
        None => Err("air_ws_closed".into()),
    }
}

fn text_payload(msg: Message) -> Result<String, String> {
    match msg {
        Message::Text(t) => {
            if t.len() > MAX_TEXT_FRAME_BYTES {
                return Err("air_ws_frame_too_large".into());
            }
            Ok(t.to_string())
        }
        Message::Close(_) => Err("air_ws_closed".into()),
        Message::Ping(_) | Message::Pong(_) | Message::Frame(_) => {
            Err("air_ws_unexpected_control".into())
        }
        Message::Binary(_) => Err("air_ws_text_expected".into()),
    }
}

/// Open baked WSS, authenticate, receive Capsule bytes; leave socket open for ACK via callback.
pub async fn exchange_until_capsule(
    code: &AccessCode,
    device_request: &DeviceRequestV1,
) -> Result<(DeliveredCapsule, AirWsSession), String> {
    let request = build_wss_request(code.port)?;
    let connect = connect_async(request);
    let (mut ws, _resp) = tokio::time::timeout(
        std::time::Duration::from_secs(CONNECT_TIMEOUT_SECS),
        connect,
    )
    .await
    .map_err(|_| "air_ws_connect_timeout".to_string())?
    .map_err(|e| format!("air_ws_connect:{e}"))?;

    let auth = serde_json::json!({
        "type": "auth_and_request",
        "selector": code.selector,
        "secret": code.secret,
        "device_request": device_request,
    });
    let auth_text = serde_json::to_string(&auth).map_err(|e| format!("air_auth_json:{e}"))?;
    if auth_text.len() > MAX_TEXT_FRAME_BYTES {
        return Err("air_auth_frame_too_large".into());
    }
    ws.send(Message::Text(auth_text.into()))
        .await
        .map_err(|e| format!("air_ws_send_auth:{e}"))?;

    // claimed → capsule_meta → binary
    let meta = loop {
        let msg = recv_message(&mut ws, FRAME_TIMEOUT_SECS).await?;
        match msg {
            Message::Text(t) => {
                if t.len() > MAX_TEXT_FRAME_BYTES {
                    return Err("air_ws_frame_too_large".into());
                }
                let value: Value =
                    serde_json::from_str(&t).map_err(|_| "air_ws_invalid_json".to_string())?;
                let frame_type = value
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                match frame_type {
                    "claimed" => continue,
                    "capsule_meta" => {
                        let parsed: CapsuleMeta = serde_json::from_value(value)
                            .map_err(|_| "air_ws_meta_invalid".to_string())?;
                        if parsed.frame_type != "capsule_meta" {
                            return Err("air_ws_meta_type".into());
                        }
                        if parsed.length == 0 || parsed.length > MAX_CAPSULE_BYTES {
                            return Err("air_ws_capsule_size".into());
                        }
                        if parsed.sha256.len() != 64
                            || !parsed.sha256.bytes().all(|b| b.is_ascii_hexdigit())
                        {
                            return Err("air_ws_capsule_digest".into());
                        }
                        break parsed;
                    }
                    "failed" => return Err("air_enroll_failed".into()),
                    _ => return Err("air_ws_unexpected_frame".into()),
                }
            }
            Message::Ping(p) => {
                ws.send(Message::Pong(p))
                    .await
                    .map_err(|e| format!("air_ws_pong:{e}"))?;
            }
            Message::Close(_) => return Err("air_ws_closed".into()),
            Message::Binary(_) => return Err("air_ws_meta_expected".into()),
            Message::Pong(_) | Message::Frame(_) => {}
        }
    };
    let mut bytes = Vec::with_capacity(meta.length);
    while bytes.len() < meta.length {
        let msg = recv_message(&mut ws, FRAME_TIMEOUT_SECS).await?;
        match msg {
            Message::Binary(chunk) => {
                if bytes.len() + chunk.len() > meta.length {
                    return Err("air_ws_capsule_oversize".into());
                }
                bytes.extend_from_slice(&chunk);
            }
            Message::Ping(p) => {
                ws.send(Message::Pong(p))
                    .await
                    .map_err(|e| format!("air_ws_pong:{e}"))?;
            }
            Message::Text(_) => return Err("air_ws_binary_expected".into()),
            Message::Close(_) => return Err("air_ws_closed".into()),
            Message::Pong(_) | Message::Frame(_) => {}
        }
    }
    if bytes.len() != meta.length {
        return Err("air_ws_capsule_length".into());
    }
    let digest = hex::encode(Sha256::digest(&bytes));
    if !constant_time_eq_hex(&digest, &meta.sha256) {
        bytes.zeroize();
        return Err("air_ws_capsule_sha256".into());
    }

    Ok((
        DeliveredCapsule {
            bytes,
            request_id: meta.request_id,
            sha256: meta.sha256,
            redelivery: meta.redelivery,
        },
        AirWsSession { ws },
    ))
}

fn constant_time_eq_hex(a: &str, b: &str) -> bool {
    let a = a.as_bytes();
    let b = b.as_bytes();
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x.to_ascii_lowercase() ^ y.to_ascii_lowercase();
    }
    diff == 0
}

type WsStream = tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
>;

pub struct AirWsSession {
    ws: WsStream,
}

impl AirWsSession {
    pub async fn send_activation_ack(&mut self, ack: Value) -> Result<(), String> {
        let text = serde_json::to_string(&ack).map_err(|e| format!("air_ack_json:{e}"))?;
        if text.len() > 2 * 1024 {
            return Err("air_ack_too_large".into());
        }
        self.ws
            .send(Message::Text(text.into()))
            .await
            .map_err(|e| format!("air_ws_send_ack:{e}"))?;
        // Wait for completed or failed.
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(ACK_TIMEOUT_SECS);
        while std::time::Instant::now() < deadline {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            let next = tokio::time::timeout(remaining, self.ws.next())
                .await
                .map_err(|_| "air_ws_ack_timeout".to_string())?;
            match next {
                Some(Ok(Message::Text(t))) => {
                    let value: Value =
                        serde_json::from_str(&t).map_err(|_| "air_ws_invalid_json".to_string())?;
                    match value.get("type").and_then(|v| v.as_str()) {
                        Some("completed") => {
                            let _ = self.ws.close(None).await;
                            return Ok(());
                        }
                        Some("failed") => return Err("air_enroll_ack_failed".into()),
                        _ => continue,
                    }
                }
                Some(Ok(Message::Ping(p))) => {
                    self.ws
                        .send(Message::Pong(p))
                        .await
                        .map_err(|e| format!("air_ws_pong:{e}"))?;
                }
                Some(Ok(Message::Close(_))) | None => return Err("air_ws_closed".into()),
                Some(Ok(_)) => continue,
                Some(Err(e)) => return Err(format!("air_ws_recv:{e}")),
            }
        }
        Err("air_ws_ack_timeout".into())
    }

    pub async fn send_import_nack(&mut self, code: &str) -> Result<(), String> {
        let sanitized: String = code
            .chars()
            .map(|c| {
                if c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .take(64)
            .collect();
        let nack = serde_json::json!({
            "type": "import_nack",
            "code": if sanitized.len() >= 3 { sanitized } else { "import_failed".into() },
        });
        let text = serde_json::to_string(&nack).map_err(|e| format!("air_nack_json:{e}"))?;
        let _ = self.ws.send(Message::Text(text.into())).await;
        let _ = self.ws.close(None).await;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn baked_request_rejects_bad_port_and_locks_host_path() {
        assert!(build_wss_request(1).is_err());
        let req = build_wss_request(62200).unwrap();
        assert_eq!(req.uri().host(), Some(HOST));
        assert_eq!(req.uri().path(), PATH);
        assert_eq!(
            req.headers()
                .get(header::SEC_WEBSOCKET_PROTOCOL)
                .and_then(|v| v.to_str().ok()),
            Some(SUBPROTOCOL)
        );
        assert_eq!(
            req.headers()
                .get("x-eliteew-air-ingress")
                .and_then(|v| v.to_str().ok()),
            Some(INGRESS_HEADER)
        );
    }
}
