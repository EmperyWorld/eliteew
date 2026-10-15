// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri IPC for host network: launcher mutate (main-only) + product link snapshot.
// Invariants:
// - Never opens NetworkManager GUI.
// - Mutate / full status: main window only.
// - link_snapshot: main or product; no addresses in payload.
// Related:
// - crate::host_network
// ---

use tauri::Window;

use crate::caller_context::{require_main_or_product, require_main_window};
use crate::host_network::{
    self, HostLinkSnapshotView, HostNetworkActionView, HostNetworkStatusView, HostWifiApView,
    HostWifiConnectRequest, HostWiredApplyRequest,
};

fn map_err(code: String) -> HostNetworkActionView {
    let message = match code.as_str() {
        "elevation_denied" => {
            "Нет права на изменение сети (нужен sudo NOPASSWD для этой учётной записи)."
                .to_string()
        }
        "wifi_unsupported" => {
            "Wi‑Fi недоступен: на этой системе нет NetworkManager.".to_string()
        }
        "backend_unavailable" | "unsupported_os" => {
            "Управление сетью на этой системе недоступно.".to_string()
        }
        "invalid_ifname" | "invalid_ipv4" | "invalid_ssid" | "invalid_wifi_password"
        | "invalid_dns" | "address_required" | "gateway_required" | "gateway_must_be_host" => {
            "Проверьте введённые данные сети.".to_string()
        }
        "wifi_connect_failed" => "Не удалось подключиться к Wi-Fi.".to_string(),
        "wifi_not_connected" => "Активное Wi-Fi подключение не найдено.".to_string(),
        other => {
            eprintln!("[STEP] host_network_action_err code={other}");
            "Не удалось изменить сеть. Повторите попытку.".to_string()
        }
    };
    HostNetworkActionView::err(code, message)
}

#[tauri::command]
pub fn host_network_status(window: Window) -> Result<HostNetworkStatusView, String> {
    require_main_window(&window)?;
    Ok(host_network::status())
}

/// Product taskbar read-only: kind + active (no IP/DNS/gateway).
#[tauri::command]
pub fn host_network_link_snapshot(window: Window) -> Result<HostLinkSnapshotView, String> {
    require_main_or_product(&window)?;
    Ok(host_network::link_snapshot())
}

#[tauri::command]
pub fn host_network_wired_apply(
    window: Window,
    request: HostWiredApplyRequest,
) -> Result<HostNetworkActionView, String> {
    require_main_window(&window)?;
    match host_network::wired_apply(request) {
        Ok(v) => Ok(v),
        Err(code) => Ok(map_err(code)),
    }
}

#[tauri::command]
pub fn host_network_wifi_scan(window: Window) -> Result<Vec<HostWifiApView>, String> {
    require_main_window(&window)?;
    host_network::wifi_scan().map_err(|code| {
        eprintln!("[STEP] host_network_wifi_scan_fail code={code}");
        code
    })
}

#[tauri::command]
pub fn host_network_wifi_connect(
    window: Window,
    request: HostWifiConnectRequest,
) -> Result<HostNetworkActionView, String> {
    require_main_window(&window)?;
    match host_network::wifi_connect(request) {
        Ok(v) => Ok(v),
        Err(code) => Ok(map_err(code)),
    }
}

#[tauri::command]
pub fn host_network_wifi_disconnect(
    window: Window,
    ifname: Option<String>,
) -> Result<HostNetworkActionView, String> {
    require_main_window(&window)?;
    match host_network::wifi_disconnect(ifname) {
        Ok(v) => Ok(v),
        Err(code) => Ok(map_err(code)),
    }
}
