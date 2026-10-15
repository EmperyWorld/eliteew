// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wire types for host network IPC (launcher ↔ Rust).
// ---

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HostNetworkBackend {
    NetworkManager,
    Networkd,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostNetworkDeviceView {
    pub name: String,
    pub kind: String,
    pub state: String,
    pub connection: Option<String>,
    pub ipv4: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostNetworkStatusView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub backend: HostNetworkBackend,
    pub wifi_supported: bool,
    pub devices: Vec<HostNetworkDeviceView>,
}

/// Product taskbar: physical link class (modem reserved for future hardware).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HostLinkKind {
    Ethernet,
    Wifi,
    Modem,
}

/// Read-only product IPC — kind + active only (no addresses / DNS / gateway).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HostLinkSnapshotView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub kind: Option<HostLinkKind>,
    pub active: bool,
}

impl HostLinkSnapshotView {
    pub fn unavailable(message: impl Into<String>) -> Self {
        Self {
            ok: false,
            code: "unavailable".into(),
            message: message.into(),
            kind: None,
            active: false,
        }
    }
}

impl HostNetworkStatusView {
    pub fn unavailable(message: impl Into<String>) -> Self {
        Self {
            ok: false,
            code: "unavailable".into(),
            message: message.into(),
            backend: HostNetworkBackend::Unavailable,
            wifi_supported: false,
            devices: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostWifiApView {
    pub ssid: String,
    pub signal: u8,
    pub security: String,
    pub in_use: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HostWiredMode {
    Dhcp,
    Static,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostWiredApplyRequest {
    pub ifname: String,
    pub mode: HostWiredMode,
    pub address: Option<String>,
    pub gateway: Option<String>,
    pub dns: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostWifiConnectRequest {
    pub ssid: String,
    pub password: Option<String>,
    pub ifname: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostNetworkActionView {
    pub ok: bool,
    pub code: String,
    pub message: String,
}

impl HostNetworkActionView {
    pub fn ok_msg(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            ok: true,
            code: code.into(),
            message: message.into(),
        }
    }

    pub fn err(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            ok: false,
            code: code.into(),
            message: message.into(),
        }
    }
}
