// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Issue a Wave 1 binding ticket from Rust (challenge → signed transcript → ticket).
// Invariants:
// - 403/400/429 policy deny is fail-closed; 404/network is honest skip (API not baked).
// - Ticket plaintext is never logged.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 1 / §Wave 2
// ---

use ed25519_dalek::Signer;
use serde::Deserialize;
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::commands::product::BAKED_PRODUCT_APP_ORIGIN;
use crate::device_keys;
use crate::fofline_egress::fofline_native_http_client;
use crate::native_oidc::bounded_json::{json_from_response, OIDC_HTTP_MAX_BYTES};
use crate::native_oidc::transcript::{build_ticket_transcript, TicketTranscriptInput};
use crate::native_oidc::{generic_user_message, NativeOidcClient};

#[derive(Debug)]
pub enum TicketIssueResult {
    Ready { ticket: String },
    Skipped { reason: String },
    Denied { message: String },
}

#[derive(Debug, Deserialize)]
struct ChallengeBody {
    nonce: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TicketBody {
    ticket: Option<String>,
    ticket_id: Option<String>,
    #[serde(default)]
    detail: Option<serde_json::Value>,
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn is_uuid(raw: &str) -> bool {
    let t = raw.trim();
    if t.len() != 36 {
        return false;
    }
    let b = t.as_bytes();
    b[8] == b'-' && b[13] == b'-' && b[18] == b'-' && b[23] == b'-' && t.bytes().all(|c| {
        c.is_ascii_hexdigit() || c == b'-'
    })
}

/// Present-but-invalid device ids are omitted so a valid license can still ticket.
fn normalize_device_id(device_id: Option<&str>) -> Option<String> {
    let Some(raw) = device_id.map(str::trim).filter(|s| !s.is_empty()) else {
        return None;
    };
    if is_uuid(raw) {
        return Some(raw.to_string());
    }
    eprintln!("[STEP] native_oidc_ticket_device_ignored reason=not_uuid");
    None
}

fn deny_live_payload(reason: &str) -> TicketIssueResult {
    eprintln!("[STEP] native_oidc_ticket_deny reason={reason}");
    TicketIssueResult::Denied {
        message: generic_user_message().into(),
    }
}

fn detail_code(detail: &Option<serde_json::Value>) -> Option<String> {
    detail.as_ref().and_then(|d| {
        d.get("code")
            .and_then(|c| c.as_str())
            .map(|s| s.to_string())
    })
}

pub async fn issue_binding_ticket(
    app_data: &std::path::Path,
    app_identifier: Option<&str>,
    client: NativeOidcClient,
    license_id: &str,
    device_id: Option<&str>,
    pkce_challenge: &str,
    dpop_jkt: &str,
) -> TicketIssueResult {
    let license = license_id.trim();
    if !is_uuid(license) {
        eprintln!("[STEP] native_oidc_ticket_skip reason=license_id_not_uuid");
        return TicketIssueResult::Skipped {
            reason: "license_id_not_uuid".into(),
        };
    }
    let device = normalize_device_id(device_id);

    let pub_keys = match device_keys::ensure_device_keys(app_data, app_identifier) {
        Ok(k) => k,
        Err(e) => {
            eprintln!("[STEP] native_oidc_ticket_deny reason=device_keys err={e}");
            return TicketIssueResult::Denied {
                message: generic_user_message().into(),
            };
        }
    };
    let signing = match device_keys::load_signing_sk(app_data, app_identifier) {
        Ok(k) => k,
        Err(e) => {
            eprintln!("[STEP] native_oidc_ticket_deny reason=signing_sk err={e}");
            return TicketIssueResult::Denied {
                message: generic_user_message().into(),
            };
        }
    };

    let client_http = match fofline_native_http_client(20) {
        Ok(c) => c,
        Err(e) => {
            if e.starts_with("w_transport_proxy_required") {
                return TicketIssueResult::Denied {
                    message: generic_user_message().into(),
                };
            }
            eprintln!("[STEP] native_oidc_ticket_skip reason=http_client err={e}");
            return TicketIssueResult::Skipped {
                reason: "http_client".into(),
            };
        }
    };

    let base = BAKED_PRODUCT_APP_ORIGIN.trim_end_matches('/');
    let challenge_url = format!("{base}/api/v1/desktop-client/auth/challenge");
    let challenge_resp = match client_http
        .post(&challenge_url)
        .json(&json!({ "device_pubkey": pub_keys.device_signing_pubkey }))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[STEP] native_oidc_ticket_skip reason=challenge_network err={e}");
            return TicketIssueResult::Skipped {
                reason: "challenge_network".into(),
            };
        }
    };
    let challenge_status = challenge_resp.status();
    if challenge_status.as_u16() == 404 {
        eprintln!("[STEP] native_oidc_ticket_skip reason=challenge_http_404");
        return TicketIssueResult::Skipped {
            reason: "challenge_http_404".into(),
        };
    }
    if !challenge_status.is_success() {
        eprintln!(
            "[STEP] native_oidc_ticket_deny reason=challenge_http_{}",
            challenge_status.as_u16()
        );
        return TicketIssueResult::Denied {
            message: generic_user_message().into(),
        };
    }
    let challenge: ChallengeBody = match json_from_response(challenge_resp, OIDC_HTTP_MAX_BYTES).await {
        Ok(b) => b,
        Err(reason) => return deny_live_payload(&format!("challenge_body_{reason}")),
    };
    let nonce = match challenge.nonce.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        Some(n) => n,
        None => return deny_live_payload("challenge_nonce"),
    };

    let jti = crate::native_oidc::pkce::random_b64url_32();
    let issued_at = now_unix();
    let transcript = build_ticket_transcript(TicketTranscriptInput {
        nonce: &nonce,
        license_id: license,
        device_id: device.as_deref(),
        client_id: client.client_id(),
        channel: client.channel(),
        dpop_jkt,
        pkce_challenge,
        redirect_uri: Some(client.redirect_uri()),
        jti: &jti,
        issued_at,
    });
    let signature_hex = hex::encode(signing.sign(&transcript).to_bytes());

    let ticket_url = format!("{base}/api/v1/desktop-client/auth/ticket");
    let body = json!({
        "device_pubkey": pub_keys.device_signing_pubkey,
        "device_signature_hex": signature_hex,
        "nonce": nonce,
        "license_id": license,
        "device_id": device,
        "client_id": client.client_id(),
        "channel": client.channel(),
        "dpop_jkt": dpop_jkt,
        "pkce_challenge": pkce_challenge,
        "redirect_uri": client.redirect_uri(),
        "jti": jti,
        "issued_at": issued_at,
    });
    let ticket_resp = match client_http.post(&ticket_url).json(&body).send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[STEP] native_oidc_ticket_skip reason=ticket_network err={e}");
            return TicketIssueResult::Skipped {
                reason: "ticket_network".into(),
            };
        }
    };
    let status = ticket_resp.status();
    let parsed: TicketBody = match json_from_response(ticket_resp, OIDC_HTTP_MAX_BYTES).await {
        Ok(b) => b,
        Err(_) => TicketBody {
            ticket: None,
            ticket_id: None,
            detail: None,
        },
    };
    if status.as_u16() == 404 {
        eprintln!("[STEP] native_oidc_ticket_skip reason=ticket_http_404");
        return TicketIssueResult::Skipped {
            reason: "ticket_http_404".into(),
        };
    }
    if !status.is_success() {
        let code = detail_code(&parsed.detail).unwrap_or_default();
        eprintln!(
            "[STEP] native_oidc_ticket_deny reason=ticket_http_{} code={code}",
            status.as_u16()
        );
        return TicketIssueResult::Denied {
            message: generic_user_message().into(),
        };
    }
    let ticket = parsed.ticket.unwrap_or_default();
    let ticket_id = parsed.ticket_id.unwrap_or_default();
    if ticket.trim().is_empty() || ticket_id.trim().is_empty() {
        return deny_live_payload("ticket_empty");
    }
    eprintln!("[STEP] native_oidc_ticket_ok ticket_id={ticket_id}");
    TicketIssueResult::Ready { ticket }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uuid_gate() {
        assert!(is_uuid("11111111-1111-1111-1111-111111111111"));
        assert!(!is_uuid("lic-1"));
        assert!(!is_uuid(""));
    }

    #[test]
    fn invalid_device_is_omitted_not_skip() {
        assert_eq!(
            normalize_device_id(Some("11111111-1111-1111-1111-111111111111")).as_deref(),
            Some("11111111-1111-1111-1111-111111111111")
        );
        assert_eq!(normalize_device_id(Some("lic-1")), None);
        assert_eq!(normalize_device_id(Some("  ")), None);
        assert_eq!(normalize_device_id(None), None);
    }

    #[test]
    fn live_success_without_ticket_is_denied() {
        match deny_live_payload("ticket_empty") {
            TicketIssueResult::Denied { message } => {
                assert_eq!(message, generic_user_message());
            }
            other => panic!("expected deny, got {other:?}"),
        }
    }
}
