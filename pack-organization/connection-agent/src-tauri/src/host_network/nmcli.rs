// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// NetworkManager backend via nmcli argv (no shell, no GUI).
// ---

use std::process::Command;

use super::types::{
    HostNetworkActionView, HostNetworkBackend, HostNetworkDeviceView, HostNetworkStatusView,
    HostWifiApView, HostWifiConnectRequest, HostWiredApplyRequest, HostWiredMode,
};
use super::validate::{
    validate_dns_list, validate_ifname, validate_ipv4, validate_ssid, validate_wifi_password,
};

pub fn available() -> bool {
    Command::new("nmcli")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub fn run(args: &[&str]) -> Result<String, String> {
    let output = Command::new("nmcli")
        .args(args)
        .output()
        .map_err(|e| format!("nmcli_spawn_failed:{e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        let detail = if stderr.is_empty() {
            stdout
        } else {
            stderr
        };
        // Never echo possible secrets from nmcli stderr beyond short code.
        let short = detail.chars().take(180).collect::<String>();
        return Err(format!("nmcli_failed:{short}"));
    }
    Ok(stdout)
}

pub fn status() -> HostNetworkStatusView {
    let raw = match run(&["-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status"]) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[STEP] host_network_nmcli_status_fail err={e}");
            return HostNetworkStatusView {
                ok: false,
                code: "nmcli_status_failed".into(),
                message: "Не удалось прочитать состояние сети.".into(),
                backend: HostNetworkBackend::NetworkManager,
                wifi_supported: true,
                devices: vec![],
            };
        }
    };
    let mut devices = Vec::new();
    for line in raw.lines() {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() < 4 {
            continue;
        }
        let name = parts[0].trim();
        if name.is_empty() || name == "lo" {
            continue;
        }
        let kind = parts[1].trim().to_string();
        let state = parts[2].trim().to_string();
        let conn = parts[3].trim();
        let connection = if conn.is_empty() || conn == "--" {
            None
        } else {
            Some(conn.to_string())
        };
        let ipv4 = ipv4_for_if(name);
        devices.push(HostNetworkDeviceView {
            name: name.to_string(),
            kind,
            state,
            connection,
            ipv4,
        });
    }
    HostNetworkStatusView {
        ok: true,
        code: "ok".into(),
        message: "NetworkManager".into(),
        backend: HostNetworkBackend::NetworkManager,
        wifi_supported: true,
        devices,
    }
}

fn ipv4_for_if(ifname: &str) -> Vec<String> {
    let output = Command::new("ip")
        .args(["-4", "-o", "addr", "show", "dev", ifname])
        .output();
    let Ok(out) = output else {
        return vec![];
    };
    if !out.status.success() {
        return vec![];
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut addrs = Vec::new();
    for line in text.lines() {
        // ... inet 192.168.8.10/30 ...
        if let Some(idx) = line.find("inet ") {
            let rest = &line[idx + 5..];
            if let Some(token) = rest.split_whitespace().next() {
                addrs.push(token.to_string());
            }
        }
    }
    addrs
}

pub fn wired_apply(req: &HostWiredApplyRequest) -> Result<HostNetworkActionView, String> {
    let ifname = validate_ifname(&req.ifname)?;
    let con_name = format!("eliteew-wired-{ifname}");
    // Replace prior EliteEW profile if present (ignore missing).
    let _ = run(&["connection", "delete", &con_name]);
    match req.mode {
        HostWiredMode::Dhcp => {
            run(&[
                "connection",
                "add",
                "type",
                "ethernet",
                "ifname",
                &ifname,
                "con-name",
                &con_name,
                "ipv4.method",
                "auto",
                "ipv6.method",
                "ignore",
            ])?;
        }
        HostWiredMode::Static => {
            let address = req
                .address
                .as_deref()
                .ok_or_else(|| "address_required".to_string())?;
            let address = validate_ipv4(address)?;
            let address = if address.contains('/') {
                address
            } else {
                format!("{address}/24")
            };
            let gateway = req
                .gateway
                .as_deref()
                .ok_or_else(|| "gateway_required".to_string())?;
            let gateway = validate_ipv4(gateway)?;
            if gateway.contains('/') {
                return Err("gateway_must_be_host".into());
            }
            let mut args = vec![
                "connection".into(),
                "add".into(),
                "type".into(),
                "ethernet".into(),
                "ifname".into(),
                ifname.clone(),
                "con-name".into(),
                con_name.clone(),
                "ipv4.method".into(),
                "manual".into(),
                "ipv4.addresses".into(),
                address,
                "ipv4.gateway".into(),
                gateway,
                "ipv6.method".into(),
                "ignore".into(),
            ];
            if let Some(dns) = req.dns.as_deref() {
                let dns = validate_dns_list(dns)?;
                if !dns.is_empty() {
                    args.push("ipv4.dns".into());
                    args.push(dns);
                }
            }
            let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
            run(&arg_refs)?;
        }
    }
    run(&["connection", "up", &con_name])?;
    Ok(HostNetworkActionView::ok_msg(
        "wired_applied",
        "Кабельное подключение обновлено.",
    ))
}

pub fn wifi_scan() -> Result<Vec<HostWifiApView>, String> {
    let raw = run(&[
        "-t",
        "-f",
        "SSID,SIGNAL,SECURITY,IN-USE",
        "device",
        "wifi",
        "list",
        "--rescan",
        "yes",
    ])?;
    let mut out = Vec::new();
    for line in raw.lines() {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() < 4 {
            continue;
        }
        let ssid = parts[0].trim();
        if ssid.is_empty() {
            continue;
        }
        let signal: u8 = parts[1].trim().parse().unwrap_or(0);
        let security = parts[2].trim().to_string();
        let in_use = parts[3].trim() == "*";
        out.push(HostWifiApView {
            ssid: ssid.to_string(),
            signal,
            security,
            in_use,
        });
    }
    Ok(out)
}

pub fn wifi_connect(req: &HostWifiConnectRequest) -> Result<HostNetworkActionView, String> {
    let ssid = validate_ssid(&req.ssid)?;
    let mut args = vec![
        "device".to_string(),
        "wifi".to_string(),
        "connect".to_string(),
        ssid,
    ];
    if let Some(pw) = req.password.as_deref() {
        let pw = validate_wifi_password(pw)?;
        if !pw.is_empty() {
            args.push("password".into());
            args.push(pw);
        }
    }
    if let Some(ifname) = req.ifname.as_deref() {
        let ifname = validate_ifname(ifname)?;
        args.push("ifname".into());
        args.push(ifname);
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    match run(&arg_refs) {
        Ok(_) => Ok(HostNetworkActionView::ok_msg(
            "wifi_connected",
            "Подключение к Wi-Fi установлено.",
        )),
        Err(e) if e.contains("Error: ") || e.contains("nmcli_failed") => {
            eprintln!("[STEP] host_network_wifi_connect_fail");
            Err("wifi_connect_failed".into())
        }
        Err(e) => Err(e),
    }
}

pub fn wifi_disconnect(ifname: Option<&str>) -> Result<HostNetworkActionView, String> {
    if let Some(name) = ifname {
        let name = validate_ifname(name)?;
        run(&["device", "disconnect", &name])?;
    } else {
        // Disconnect first wifi device that is connected.
        let st = status();
        let wifi = st
            .devices
            .iter()
            .find(|d| d.kind == "wifi" && d.state.contains("connected"))
            .ok_or_else(|| "wifi_not_connected".to_string())?;
        run(&["device", "disconnect", &wifi.name])?;
    }
    Ok(HostNetworkActionView::ok_msg(
        "wifi_disconnected",
        "Wi-Fi отключён.",
    ))
}
