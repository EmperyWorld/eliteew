// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Pure mapper: full host status → product taskbar link snapshot (kind + active).
// Invariants:
// - No IP / gateway / DNS in output.
// - Modem kind reserved (gsm/wwan/cdma) even before hardware support.
// Related:
// - types.rs HostLinkSnapshotView
// ---

use super::types::{
    HostLinkKind, HostLinkSnapshotView, HostNetworkDeviceView, HostNetworkStatusView,
};

const KIND_PRIORITY: [HostLinkKind; 3] = [
    HostLinkKind::Ethernet,
    HostLinkKind::Wifi,
    HostLinkKind::Modem,
];

pub fn link_snapshot_from_status(status: &HostNetworkStatusView) -> HostLinkSnapshotView {
    if !status.ok {
        return HostLinkSnapshotView::unavailable(status.message.clone());
    }

    let mut classified: Vec<(HostLinkKind, bool)> = Vec::new();
    for device in &status.devices {
        let Some(kind) = classify_kind(&device.kind) else {
            continue;
        };
        classified.push((kind, device_is_active(device)));
    }

    if classified.is_empty() {
        return HostLinkSnapshotView::unavailable(
            "Нет распознанных сетевых интерфейсов.".to_string(),
        );
    }

    for prefer in KIND_PRIORITY {
        if let Some((kind, _)) = classified
            .iter()
            .find(|(k, active)| *k == prefer && *active)
            .copied()
        {
            return HostLinkSnapshotView {
                ok: true,
                code: "ok".into(),
                message: String::new(),
                kind: Some(kind),
                active: true,
            };
        }
    }

    for prefer in KIND_PRIORITY {
        if let Some((kind, _)) = classified.iter().find(|(k, _)| *k == prefer).copied() {
            return HostLinkSnapshotView {
                ok: true,
                code: "ok".into(),
                message: String::new(),
                kind: Some(kind),
                active: false,
            };
        }
    }

    HostLinkSnapshotView::unavailable("Нет распознанных сетевых интерфейсов.".to_string())
}

fn classify_kind(raw: &str) -> Option<HostLinkKind> {
    let t = raw.trim().to_ascii_lowercase();
    if t.is_empty() {
        return None;
    }
    // Modem before wifi: type tokens like `wwan` must not match a bare `w*` heuristic.
    if matches!(
        t.as_str(),
        "gsm" | "cdma" | "wwan" | "modem" | "bluetooth" | "mobile"
    ) || t.contains("modem")
        || t.contains("wwan")
    {
        return Some(HostLinkKind::Modem);
    }
    if matches!(
        t.as_str(),
        "wifi" | "802-11-wireless" | "wireless" | "wlan"
    ) {
        return Some(HostLinkKind::Wifi);
    }
    if matches!(
        t.as_str(),
        "ethernet" | "802-3-ethernet" | "wired" | "bond" | "bridge" | "vlan"
    ) {
        return Some(HostLinkKind::Ethernet);
    }
    None
}

fn device_is_active(device: &HostNetworkDeviceView) -> bool {
    let state = device.state.trim().to_ascii_lowercase();
    if state.is_empty() {
        return false;
    }
    // NetworkManager: "connected", "connected (externally)", …
    if state.starts_with("connected") {
        return true;
    }
    // ip -br / networkd: UP
    if state == "up" {
        return true;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host_network::types::{HostNetworkBackend, HostNetworkDeviceView};

    fn status_with(devices: Vec<HostNetworkDeviceView>) -> HostNetworkStatusView {
        HostNetworkStatusView {
            ok: true,
            code: "ok".into(),
            message: "test".into(),
            backend: HostNetworkBackend::NetworkManager,
            wifi_supported: true,
            devices,
        }
    }

    fn dev(name: &str, kind: &str, state: &str) -> HostNetworkDeviceView {
        HostNetworkDeviceView {
            name: name.into(),
            kind: kind.into(),
            state: state.into(),
            connection: None,
            ipv4: vec!["10.0.0.2/24".into()],
        }
    }

    #[test]
    fn prefers_active_ethernet_over_wifi() {
        let snap = link_snapshot_from_status(&status_with(vec![
            dev("wlan0", "wifi", "connected"),
            dev("eno1", "ethernet", "connected"),
        ]));
        assert!(snap.ok);
        assert_eq!(snap.kind, Some(HostLinkKind::Ethernet));
        assert!(snap.active);
        assert!(snap.message.is_empty());
    }

    #[test]
    fn wifi_when_ethernet_down() {
        let snap = link_snapshot_from_status(&status_with(vec![
            dev("eno1", "ethernet", "disconnected"),
            dev("wlan0", "wifi", "connected"),
        ]));
        assert_eq!(snap.kind, Some(HostLinkKind::Wifi));
        assert!(snap.active);
    }

    #[test]
    fn inactive_ethernet_when_all_down() {
        let snap = link_snapshot_from_status(&status_with(vec![
            dev("eno1", "ethernet", "disconnected"),
            dev("wlan0", "wifi", "unavailable"),
        ]));
        assert_eq!(snap.kind, Some(HostLinkKind::Ethernet));
        assert!(!snap.active);
    }

    #[test]
    fn modem_kind_reserved() {
        let snap = link_snapshot_from_status(&status_with(vec![dev(
            "wwan0", "gsm", "connected",
        )]));
        assert_eq!(snap.kind, Some(HostLinkKind::Modem));
        assert!(snap.active);
    }

    #[test]
    fn networkd_up_state() {
        let snap = link_snapshot_from_status(&status_with(vec![dev("eth0", "ethernet", "UP")]));
        assert!(snap.active);
        assert_eq!(snap.kind, Some(HostLinkKind::Ethernet));
    }

    #[test]
    fn unavailable_status_maps_red() {
        let snap = link_snapshot_from_status(&HostNetworkStatusView::unavailable("нет бэкенда"));
        assert!(!snap.ok);
        assert!(!snap.active);
        assert!(snap.kind.is_none());
    }

    #[test]
    fn snapshot_omits_addresses() {
        let snap = link_snapshot_from_status(&status_with(vec![dev(
            "eno1", "ethernet", "connected",
        )]));
        let json = serde_json::to_string(&snap).expect("serialize");
        assert!(!json.contains("10.0.0.2"));
        assert!(!json.contains("ipv4"));
        assert!(!json.contains("gateway"));
        assert!(!json.contains("dns"));
    }
}
