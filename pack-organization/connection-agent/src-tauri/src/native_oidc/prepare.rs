// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Create a native OIDC transaction (PKCE + DPoP JKT + optional binding ticket).
// Invariants:
// - Ticket policy deny fails closed; missing Wave 1 routes skip honestly.
// - Authorization URL never includes ticket or bind ids. Ticket goes to Keycloak PAR only.
// - PAR failure after a live ticket fails closed (Wave 7 enforce).
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 3 / §9.7
// ---

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::device_keys;
use crate::native_oidc::par;
use crate::native_oidc::pkce::{pkce_challenge_s256, random_b64url_32};
use crate::native_oidc::ticket::{issue_binding_ticket, TicketIssueResult};
use crate::native_oidc::transaction::{self, NativeOidcTransaction};
use crate::native_oidc::urls;
use crate::native_oidc::{generic_user_message, NativeOidcClient};

pub enum PrepareOutcome {
    Ready {
        authorization_url: String,
        transaction_id: String,
        dpop_jkt: String,
    },
    Denied {
        message: String,
    },
}

pub async fn prepare_native_oidc(
    app_data: &Path,
    app_identifier: &str,
    client: NativeOidcClient,
    license_id: &str,
    device_id: Option<&str>,
    issue_ticket: bool,
    force_login: bool,
) -> PrepareOutcome {
    if !client.allowed_for_app_identifier(app_identifier) {
        eprintln!(
            "[STEP] native_oidc_prepare_deny reason=client_edition_conflict client={}",
            client.client_id()
        );
        return PrepareOutcome::Denied {
            message: generic_user_message().into(),
        };
    }
    let pub_keys = match device_keys::ensure_device_keys(app_data, Some(app_identifier)) {
        Ok(k) => k,
        Err(e) => {
            eprintln!("[STEP] native_oidc_prepare_deny reason=device_keys err={e}");
            return PrepareOutcome::Denied {
                message: generic_user_message().into(),
            };
        }
    };
    let dpop_jkt = pub_keys.dpop_jkt.trim().to_string();
    if dpop_jkt.is_empty() {
        eprintln!("[STEP] native_oidc_prepare_deny reason=dpop_jkt_missing");
        return PrepareOutcome::Denied {
            message: generic_user_message().into(),
        };
    }

    let verifier = random_b64url_32();
    let challenge = pkce_challenge_s256(&verifier);
    let state = random_b64url_32();
    let nonce = random_b64url_32();
    let tx_id = random_b64url_32();
    let created_unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut ticket = None;
    if issue_ticket {
        match issue_binding_ticket(
            app_data,
            Some(app_identifier),
            client,
            license_id,
            device_id,
            &challenge,
            &dpop_jkt,
        )
        .await
        {
            TicketIssueResult::Ready { ticket: t } => ticket = Some(t),
            TicketIssueResult::Skipped { reason } => {
                eprintln!("[STEP] native_oidc_ticket_skip reason={reason}");
            }
            TicketIssueResult::Denied { message } => {
                return PrepareOutcome::Denied { message };
            }
        }
    }

    let auth_url = if let Some(ref ticket_value) = ticket {
        match par::push_authorization_request(par::ParPushRequest {
            app_data,
            app_identifier,
            client,
            state: &state,
            nonce: &nonce,
            pkce_challenge: &challenge,
            dpop_jkt: &dpop_jkt,
            ticket: Some(ticket_value),
            prompt_login: force_login,
        })
        .await
        {
            Ok(u) => u,
            Err(e) => {
                eprintln!("[STEP] native_oidc_prepare_deny reason=par_fail err={e}");
                return PrepareOutcome::Denied {
                    message: generic_user_message().into(),
                };
            }
        }
    } else {
        match urls::build_authorization_url(
            client.client_id(),
            client.redirect_uri(),
            &state,
            &nonce,
            &challenge,
            &dpop_jkt,
        ) {
            Ok(u) => u,
            Err(e) => {
                eprintln!("[STEP] native_oidc_prepare_deny reason=auth_url err={e}");
                return PrepareOutcome::Denied {
                    message: generic_user_message().into(),
                };
            }
        }
    };

    if let Err(e) = transaction::put(NativeOidcTransaction {
        id: tx_id.clone(),
        client_id: client.client_id().into(),
        channel: client.channel().into(),
        redirect_uri: client.redirect_uri().into(),
        state,
        nonce,
        pkce_verifier: verifier,
        pkce_challenge: challenge,
        dpop_jkt: dpop_jkt.clone(),
        ticket,
        created_unix,
    }) {
        eprintln!("[STEP] native_oidc_prepare_deny reason=tx_store err={e}");
        return PrepareOutcome::Denied {
            message: generic_user_message().into(),
        };
    }

    PrepareOutcome::Ready {
        authorization_url: auth_url.to_string(),
        transaction_id: tx_id,
        dpop_jkt,
    }
}

pub async fn prepare_for_product_open(
    app_data: &Path,
    app_identifier: &str,
    client: NativeOidcClient,
    license_id: &str,
    device_id: Option<&str>,
) -> Result<(), String> {
    match prepare_native_oidc(
        app_data,
        app_identifier,
        client,
        license_id,
        device_id,
        true,
        false,
    )
    .await
    {
        PrepareOutcome::Ready { .. } => Ok(()),
        PrepareOutcome::Denied { message } => Err(message),
    }
}
