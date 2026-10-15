// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Typed native OIDC owner for empery-desktop / empery-fofline (Wave 2).
// Invariants:
// - Ticket, PKCE verifier, DPoP SK, refresh token never leave Rust.
// - Product/nginx Start URL never carries license/device/ticket.
// - start/complete/refresh/logout/interactive are main-window; product inject uses product_session_*.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 2 / pre-Wave-7
// ---

pub mod bounded_json;
pub mod dpop_iat;
pub mod hub_login;
pub mod linux_form_gate;
pub mod par;
pub mod pkce;
pub mod prepare;
pub mod product_bridge;
pub mod refresh_store;
pub mod session_cache;
pub mod ticket;
pub mod token;
pub mod transaction;
pub mod transcript;
pub mod urls;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeOidcClient {
    EmperyDesktop,
    EmperyFofline,
}

impl NativeOidcClient {
    pub fn client_id(self) -> &'static str {
        match self {
            Self::EmperyDesktop => "empery-desktop",
            Self::EmperyFofline => "empery-fofline",
        }
    }

    pub fn channel(self) -> &'static str {
        match self {
            Self::EmperyDesktop => "desktop",
            Self::EmperyFofline => "fofline",
        }
    }

    pub fn redirect_uri(self) -> &'static str {
        match self {
            Self::EmperyDesktop => urls::BAKED_DESKTOP_REDIRECT,
            Self::EmperyFofline => urls::BAKED_FOFLINE_REDIRECT,
        }
    }

    /// Dual-edition conflict: FoFline binary cannot start desktop OIDC and vice versa.
    pub fn allowed_for_app_identifier(self, app_identifier: &str) -> bool {
        let id = app_identifier.to_ascii_lowercase();
        let is_fofline = id.contains("fofline");
        match self {
            Self::EmperyFofline => is_fofline,
            Self::EmperyDesktop => !is_fofline,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct NativeOidcCommandView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authorization_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dpop_jkt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_in: Option<u64>,
}

impl NativeOidcCommandView {
    pub fn deny(code: &str, message: impl Into<String>) -> Self {
        Self {
            ok: false,
            code: code.into(),
            message: message.into(),
            authorization_url: None,
            transaction_id: None,
            dpop_jkt: None,
            access_token: None,
            id_token: None,
            expires_in: None,
        }
    }

    pub fn generic_deny() -> Self {
        Self::deny(
            "auth_policy_denied",
            "Authentication could not be completed",
        )
    }
}

pub fn generic_user_message() -> &'static str {
    "Authentication could not be completed"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_ids_are_native_only() {
        assert_eq!(NativeOidcClient::EmperyDesktop.client_id(), "empery-desktop");
        assert_eq!(NativeOidcClient::EmperyFofline.client_id(), "empery-fofline");
    }

    #[test]
    fn edition_conflict_is_fail_closed() {
        assert!(NativeOidcClient::EmperyFofline
            .allowed_for_app_identifier("world.empery.fofline"));
        assert!(!NativeOidcClient::EmperyDesktop
            .allowed_for_app_identifier("world.empery.fofline"));
        assert!(NativeOidcClient::EmperyDesktop
            .allowed_for_app_identifier("world.empery.desktop.connected.v1"));
        assert!(!NativeOidcClient::EmperyFofline
            .allowed_for_app_identifier("world.empery.desktop.connected.v1"));
    }

    #[test]
    fn command_view_has_no_refresh_field() {
        let src = include_str!("mod.rs");
        let view = src
            .split("pub struct NativeOidcCommandView")
            .nth(1)
            .unwrap()
            .split("impl NativeOidcCommandView")
            .next()
            .unwrap();
        assert!(!view.contains("refresh"));
    }
}
