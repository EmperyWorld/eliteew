// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Dispatch host network mutations to the detected Linux backend.
// ---

use super::nmcli;
use super::networkd;
use super::types::{
    HostNetworkActionView, HostWifiApView, HostWifiConnectRequest, HostWiredApplyRequest,
};

pub fn wired_apply(req: HostWiredApplyRequest) -> Result<HostNetworkActionView, String> {
    #[cfg(target_os = "linux")]
    {
        if nmcli::available() {
            return nmcli::wired_apply(&req);
        }
        if networkd::available() {
            return networkd::wired_apply(&req);
        }
        Err("backend_unavailable".into())
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = req;
        Err("unsupported_os".into())
    }
}

pub fn wifi_scan() -> Result<Vec<HostWifiApView>, String> {
    #[cfg(target_os = "linux")]
    {
        if nmcli::available() {
            return nmcli::wifi_scan();
        }
        Err("wifi_unsupported".into())
    }
    #[cfg(not(target_os = "linux"))]
    {
        Err("unsupported_os".into())
    }
}

pub fn wifi_connect(req: HostWifiConnectRequest) -> Result<HostNetworkActionView, String> {
    #[cfg(target_os = "linux")]
    {
        if nmcli::available() {
            return nmcli::wifi_connect(&req);
        }
        Err("wifi_unsupported".into())
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = req;
        Err("unsupported_os".into())
    }
}

pub fn wifi_disconnect(ifname: Option<String>) -> Result<HostNetworkActionView, String> {
    #[cfg(target_os = "linux")]
    {
        if nmcli::available() {
            return nmcli::wifi_disconnect(ifname.as_deref());
        }
        Err("wifi_unsupported".into())
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = ifname;
        Err("unsupported_os".into())
    }
}
