// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Typed WebView / app egress plan for FoFline W-transport (proxy_url hook points).
// Invariants:
// - Fail-closed: when W-transport is the active FoFline path, missing proxy is not OK.
// Related:
// - tauri::WebviewWindowBuilder::proxy_url
// ---

use serde::Serialize;

pub const PROXY_SCHEME_SOCKS5: &str = "socks5";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProxyEgressPlan {
    /// When true, product WebView must use proxy_url and must not open without it.
    pub fail_closed: bool,
    /// socks5://127.0.0.1:port when SOCKS is listening.
    pub proxy_url: Option<String>,
    pub code: String,
    pub message: String,
    /// Platform notes for dual-OS PoC residual.
    pub linux_webkitgtk: String,
    pub windows_webview2: String,
}

impl ProxyEgressPlan {
    pub fn disabled() -> Self {
        Self {
            fail_closed: false,
            proxy_url: None,
            code: "disabled".into(),
            message: "W-transport off — connected-client uses system WG egress".into(),
            linux_webkitgtk: "N/A (system WG)".into(),
            windows_webview2: "N/A (system WG)".into(),
        }
    }

    pub fn socks_up(proxy_url: String) -> Self {
        Self {
            fail_closed: true,
            proxy_url: Some(proxy_url),
            code: "proxy_ready".into(),
            message:
                "Local SOCKS ready — apply WebviewWindowBuilder::proxy_url; TCP-over-WG dialer active"
                    .into(),
            linux_webkitgtk:
                "Tauri proxy_url → WebKitGTK network proxy; PoC required before Done".into(),
            windows_webview2:
                "Tauri proxy_url → WebView2; known flaky cases — PoC required before Done".into(),
        }
    }

    pub fn socks_down(reason: impl Into<String>) -> Self {
        Self {
            fail_closed: true,
            proxy_url: None,
            code: "proxy_down".into(),
            message: reason.into(),
            linux_webkitgtk: "Do not open product WebView without proxy when W-transport active"
                .into(),
            windows_webview2: "Do not open product WebView without proxy when W-transport active"
                .into(),
        }
    }

    pub fn format_socks5_url(addr: std::net::SocketAddr) -> String {
        format!("{PROXY_SCHEME_SOCKS5}://{addr}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, SocketAddrV4};

    #[test]
    fn formats_socks_url() {
        let a = std::net::SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 1080));
        assert_eq!(
            ProxyEgressPlan::format_socks5_url(a),
            "socks5://127.0.0.1:1080"
        );
    }
}
