// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Host OS network control for the launcher (wired + Wi-Fi) - Linux first.
// Invariants:
// - No external NetworkManager GUI (nm-connection-editor / GNOME Settings / nmtui).
// - Available without entitlement; IPC is main-window only.
// - argv-only process spawn; Wi-Fi PSK never logged.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md
// - documentation/reference/solution-readiness/2026-09-09-desktop-client-host-network-prelicense.md
// ---

mod apply;
mod link_snapshot;
mod nmcli;
mod networkd;
mod types;
mod validate;

pub use apply::{wifi_connect, wifi_disconnect, wifi_scan, wired_apply};
pub use link_snapshot::link_snapshot_from_status;
#[allow(unused_imports)] // public IPC surface + unit tests
pub use types::{
    HostLinkKind, HostLinkSnapshotView, HostNetworkActionView, HostNetworkBackend,
    HostNetworkStatusView, HostWifiApView, HostWifiConnectRequest, HostWiredApplyRequest,
    HostWiredMode,
};
#[allow(unused_imports)] // validators are the public contract for callers/tests
pub use validate::{validate_ifname, validate_ipv4, validate_ssid};

/// Snapshot host network for the custom launcher panel.
pub fn status() -> HostNetworkStatusView {
    #[cfg(target_os = "linux")]
    {
        if nmcli::available() {
            return nmcli::status();
        }
        if networkd::available() {
            return networkd::status();
        }
        HostNetworkStatusView::unavailable(
            "На этой системе нет NetworkManager и systemd-networkd - настройка сети в EliteEW недоступна.",
        )
    }
    #[cfg(not(target_os = "linux"))]
    {
        HostNetworkStatusView::unavailable(
            "Управление сетью устройства в EliteEW пока доступно только на Linux.",
        )
    }
}

/// Product taskbar: kind + active only (no addresses).
pub fn link_snapshot() -> HostLinkSnapshotView {
    link_snapshot_from_status(&status())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_rejects_shell_meta_ifname() {
        assert!(validate_ifname("eno1;rm").is_err());
        assert!(validate_ifname("../../../etc").is_err());
        assert!(validate_ifname("eno1").is_ok());
    }

    #[test]
    fn validate_ipv4_accepts_cidrs() {
        assert!(validate_ipv4("192.168.8.10").is_ok());
        assert!(validate_ipv4("192.168.8.10/30").is_ok());
        assert!(validate_ipv4("999.1.1.1").is_err());
        assert!(validate_ipv4("1.2.3.4;id").is_err());
    }
}
