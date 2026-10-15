// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---

//! Network step helpers — DHCP status + static form validation.

use std::fs;
use std::io::Write;
use std::net::Ipv4Addr;
use std::process::{Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::thread;

use crate::logutil;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetMode {
    Dhcp,
    Static,
    Wifi,
    Skip,
}

#[derive(Debug, Clone, Default)]
pub struct StaticForm {
    pub iface: String,
    pub address_cidr: String,
    pub gateway: String,
    pub dns: String,
}

#[derive(Debug, Clone)]
pub struct NetStatus {
    pub ifaces: Vec<NetworkInterface>,
    pub pci_devices: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Clone)]
pub struct NetworkInterface {
    pub name: String,
    pub kind: &'static str,
    pub carrier: bool,
    pub driver: String,
    pub mac: String,
}

#[derive(Debug, Clone)]
pub struct WifiNetwork {
    pub ssid: String,
    pub signal_percent: u8,
    pub security: String,
}

pub enum NetworkEvent {
    Applied(Result<String, String>),
    Scanned(Result<Vec<WifiNetwork>, String>),
}

pub fn refresh_status() -> NetStatus {
    let ifaces = list_ifaces();
    let has_default_route = Command::new("ip")
        .args(["-4", "route", "show", "default"])
        .output()
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false);
    let has_carrier = ifaces.iter().any(|interface| interface.carrier);
    let pci_devices = list_pci_network_devices();
    let addrs = ipv4_addrs();
    let summary = if !addrs.is_empty() {
        format!("Сеть: {}", addrs.join(", "))
    } else if has_default_route {
        "Сеть: маршрут по умолчанию есть".to_string()
    } else if has_carrier {
        "Сеть: носитель есть, адреса ещё нет".to_string()
    } else if ifaces.is_empty() {
        "Сеть: интерфейсы не найдены".to_string()
    } else {
        format!(
            "Сеть: интерфейсы {}",
            ifaces
                .iter()
                .map(|interface| interface.name.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        )
    };
    NetStatus {
        ifaces,
        pci_devices,
        summary,
    }
}

fn list_pci_network_devices() -> Vec<String> {
    let Ok(entries) = fs::read_dir("/sys/bus/pci/devices") else {
        return Vec::new();
    };
    let mut devices = entries
        .flatten()
        .filter_map(|entry| {
            let root = entry.path();
            let class = read_trim(&root.join("class"))?;
            if !class.starts_with("0x02") {
                return None;
            }
            let vendor = read_trim(&root.join("vendor")).unwrap_or_else(|| "unknown".to_string());
            let device = read_trim(&root.join("device")).unwrap_or_else(|| "unknown".to_string());
            let driver = fs::read_link(root.join("driver"))
                .ok()
                .and_then(|path| path.file_name().map(|name| name.to_string_lossy().into_owned()))
                .unwrap_or_else(|| "UNBOUND".to_string());
            Some(format!(
                "{} vendor={} device={} driver={}",
                entry.file_name().to_string_lossy(),
                vendor,
                device,
                driver
            ))
        })
        .collect::<Vec<_>>();
    devices.sort();
    devices
}

fn ipv4_addrs() -> Vec<String> {
    let output = Command::new("ip")
        .args(["-4", "-br", "addr", "show"])
        .output();
    let Ok(out) = output else {
        return Vec::new();
    };
    let mut rows = Vec::new();
    for line in String::from_utf8_lossy(&out.stdout).lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }
        let iface = parts[0];
        if iface == "lo" {
            continue;
        }
        // ip -br: eth0 UP 192.168.1.1/24 ...
        for p in &parts[2..] {
            if p.contains('.') && p.contains('/') {
                rows.push(format!("{iface} {p}"));
            }
        }
    }
    rows
}

fn list_ifaces() -> Vec<NetworkInterface> {
    let Ok(entries) = fs::read_dir("/sys/class/net") else {
        return Vec::new();
    };
    let mut out: Vec<NetworkInterface> = entries
        .filter_map(|e| e.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name == "lo" {
                return None;
            }
            let root = entry.path();
            let kind = if root.join("wireless").is_dir() || root.join("phy80211").is_dir() {
                "wifi"
            } else {
                "ethernet"
            };
            let driver = fs::read_link(root.join("device/driver"))
                .ok()
                .and_then(|path| path.file_name().map(|name| name.to_string_lossy().into_owned()))
                .unwrap_or_else(|| "нет драйвера".to_string());
            let mac = read_trim(&root.join("address")).unwrap_or_else(|| "—".to_string());
            Some(NetworkInterface {
                carrier: carrier_up(&name),
                name,
                kind,
                driver,
                mac,
            })
        })
        .collect();
    out.sort_by(|left, right| left.name.cmp(&right.name));
    out
}

fn read_trim(path: &std::path::Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn carrier_up(iface: &str) -> bool {
    fs::read_to_string(format!("/sys/class/net/{iface}/carrier"))
        .map(|s| s.trim() == "1")
        .unwrap_or(false)
}

pub fn validate_static(form: &StaticForm) -> Result<(), String> {
    let iface = form.iface.trim();
    if iface.is_empty() {
        return Err("Укажите интерфейс".into());
    }
    if !iface
        .chars()
        .enumerate()
        .all(|(i, c)| {
            if i == 0 {
                c.is_ascii_alphabetic()
            } else {
                c.is_ascii_alphanumeric() || c == '_' || c == '-'
            }
        })
    {
        return Err("Некорректное имя интерфейса".into());
    }
    if !std::path::Path::new(&format!("/sys/class/net/{iface}")).exists() {
        return Err(format!("Интерфейс {iface} не найден"));
    }
    let cidr = form.address_cidr.trim();
    let (addr, prefix) = cidr
        .split_once('/')
        .ok_or_else(|| "Адрес должен быть в формате 192.168.1.10/24".to_string())?;
    let _: Ipv4Addr = addr
        .parse()
        .map_err(|_| "Некорректный IPv4 адрес".to_string())?;
    let p: u8 = prefix
        .parse()
        .map_err(|_| "Префикс должен быть числом 0–32".to_string())?;
    if p > 32 {
        return Err("Префикс должен быть 0–32".into());
    }
    if !form.gateway.trim().is_empty() {
        let _: Ipv4Addr = form
            .gateway
            .trim()
            .parse()
            .map_err(|_| "Некорректный шлюз".to_string())?;
    }
    if !form.dns.trim().is_empty() {
        let _: Ipv4Addr = form
            .dns
            .trim()
            .parse()
            .map_err(|_| "Некорректный DNS".to_string())?;
    }
    Ok(())
}

fn apply_helper_path() -> String {
    std::env::var("ELITEEW_TS_INSTALL_APPLY")
        .unwrap_or_else(|_| "/usr/local/bin/eliteew-ts-install-apply".into())
}

pub fn apply_static(form: &StaticForm) -> Result<(), String> {
    validate_static(form)?;
    let helper = apply_helper_path();
    crate::apply::run_helper_capture(
        &helper,
        &[
            "network-static",
            "--iface",
            form.iface.trim(),
            "--address",
            form.address_cidr.trim(),
            "--gateway",
            form.gateway.trim(),
            "--dns",
            form.dns.trim(),
        ],
    )
    .map_err(|e| {
        let error = format!("network-static failed: {e}");
        logutil::error(&error);
        error
    })?;
    logutil::info("network-static applied");
    Ok(())
}

pub fn request_dhcp(interface: &str) -> Result<(), String> {
    validate_interface_name(interface)?;
    let helper = apply_helper_path();
    crate::apply::run_helper_capture(&helper, &["network-dhcp", "--iface", interface])
        .map_err(|e| {
            let error = format!("network-dhcp failed: {e}");
            logutil::error(&error);
            error
        })?;
    logutil::info("network-dhcp requested");
    Ok(())
}

pub fn start_dhcp(interface: String) -> Receiver<NetworkEvent> {
    spawn_applied(move || {
        request_dhcp(&interface)?;
        Ok(format!("DHCP подтверждён на {interface}"))
    })
}

pub fn start_static(form: StaticForm) -> Receiver<NetworkEvent> {
    spawn_applied(move || {
        apply_static(&form)?;
        Ok(format!(
            "Статический адрес {} подтверждён на {}",
            form.address_cidr, form.iface
        ))
    })
}

pub fn start_wifi_scan(interface: String) -> Receiver<NetworkEvent> {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let result = scan_wifi(&interface);
        let _ = tx.send(NetworkEvent::Scanned(result));
    });
    rx
}

pub fn start_wifi_connect(
    interface: String,
    ssid: String,
    passphrase: String,
    security: String,
    country: String,
) -> Receiver<NetworkEvent> {
    spawn_applied(move || {
        validate_interface_name(&interface)?;
        if ssid.is_empty() || ssid.as_bytes().len() > 32 || ssid.chars().any(char::is_control) {
            return Err("SSID должен содержать 1–32 байта без управляющих символов".to_string());
        }
        let open = security == "open";
        validate_wifi_passphrase(&passphrase, open)?;
        logutil::info(&format!(
            "network-wifi start iface={interface} ssid={ssid} country={country} open={open}"
        ));

        let mut command = crate::apply::installer_helper_command();
        command
            .args([
                "network-wifi",
                "--iface",
                &interface,
                "--ssid",
                &ssid,
                "--country",
                &country,
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if open {
            command.arg("--allow-open");
        }
        let mut child = command
            .spawn()
            .map_err(|error| format!("Не удалось запустить настройку Wi‑Fi: {error}"))?;
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Не удалось открыть защищённый канал пароля Wi‑Fi".to_string())?;
        stdin
            .write_all(format!("{passphrase}\n").as_bytes())
            .map_err(|error| format!("Не удалось передать пароль Wi‑Fi: {error}"))?;
        drop(stdin);
        let output = child
            .wait_with_output()
            .map_err(|error| format!("Не удалось дождаться настройки Wi‑Fi: {error}"))?;
        command_result(output, "network-wifi")?;
        Ok(format!("Wi‑Fi {ssid} подключён и проверен на {interface}"))
    })
}

fn spawn_applied(
    operation: impl FnOnce() -> Result<String, String> + Send + 'static,
) -> Receiver<NetworkEvent> {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(NetworkEvent::Applied(operation()));
    });
    rx
}

fn scan_wifi(interface: &str) -> Result<Vec<WifiNetwork>, String> {
    validate_interface_name(interface)?;
    let output = crate::apply::installer_helper_command()
        .args(["wifi-scan", "--iface", interface])
        .output()
        .map_err(|error| format!("Не удалось запустить сканирование Wi‑Fi: {error}"))?;
    if !output.status.success() {
        return Err(command_failure(&output, "wifi-scan"));
    }
    let networks = parse_iw_scan(&String::from_utf8_lossy(&output.stdout));
    if networks.is_empty() {
        return Err("Сканирование завершилось, но точки доступа не обнаружены".to_string());
    }
    Ok(networks)
}

fn command_result(output: std::process::Output, operation: &str) -> Result<(), String> {
    if output.status.success() {
        Ok(())
    } else {
        Err(command_failure(&output, operation))
    }
}

fn command_failure(output: &std::process::Output, operation: &str) -> String {
    let detail = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout)
    )
    .trim()
    .replace(['\r', '\n'], " ");
    let error = if detail.is_empty() {
        format!("{operation} завершился с кодом {}", output.status)
    } else {
        format!("{operation}: {detail}")
    };
    logutil::error(&error);
    error
}

pub fn validate_wifi_passphrase(passphrase: &str, open: bool) -> Result<(), String> {
    if open {
        return Ok(());
    }
    let bytes = passphrase.as_bytes();
    if bytes.len() < 8 {
        return Err("Пароль Wi‑Fi: минимум 8 символов".to_string());
    }
    if bytes.len() > 63 {
        return Err("Пароль Wi‑Fi: максимум 63 символа".to_string());
    }
    if !bytes.iter().all(|byte| (0x20..=0x7e).contains(byte)) {
        return Err(
            "Пароль Wi‑Fi только латиницей (ASCII). Alt+Shift переключает раскладку.".to_string(),
        );
    }
    Ok(())
}

fn validate_interface_name(interface: &str) -> Result<(), String> {
    if interface.is_empty()
        || interface.len() > 15
        || !interface.bytes().enumerate().all(|(index, byte)| {
            if index == 0 {
                byte.is_ascii_alphanumeric()
            } else {
                byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.')
            }
        })
        || interface == "lo"
        || !std::path::Path::new("/sys/class/net")
            .join(interface)
            .is_dir()
    {
        return Err("Некорректный или отсутствующий сетевой интерфейс".to_string());
    }
    Ok(())
}

fn parse_iw_scan(output: &str) -> Vec<WifiNetwork> {
    #[derive(Default)]
    struct Pending {
        ssid: Option<String>,
        signal: Option<f32>,
        secured: bool,
        sae: bool,
    }

    fn finish(pending: &mut Pending, networks: &mut Vec<WifiNetwork>) {
        let Some(ssid) = pending.ssid.take() else {
            *pending = Pending::default();
            return;
        };
        if ssid.is_empty() {
            *pending = Pending::default();
            return;
        }
        networks.push(WifiNetwork {
            ssid,
            signal_percent: pending
                .signal
                .map(|dbm| ((dbm + 100.0) * 2.0).round().clamp(0.0, 100.0) as u8)
                .unwrap_or(0),
            security: if pending.sae {
                "wpa3".to_string()
            } else if pending.secured {
                "wpa2".to_string()
            } else {
                "open".to_string()
            },
        });
        *pending = Pending::default();
    }

    let mut networks = Vec::new();
    let mut pending = Pending::default();
    for line in output.lines().map(str::trim) {
        if line.starts_with("BSS ") {
            finish(&mut pending, &mut networks);
        } else if let Some(value) = line.strip_prefix("SSID: ") {
            pending.ssid = Some(value.to_string());
        } else if let Some(value) = line.strip_prefix("signal: ") {
            pending.signal = value
                .split_whitespace()
                .next()
                .and_then(|raw| raw.parse::<f32>().ok());
        } else if line.starts_with("RSN:") || line.starts_with("WPA:") {
            pending.secured = true;
        } else if line.contains("Authentication suites: SAE") {
            pending.secured = true;
            pending.sae = true;
        }
    }
    finish(&mut pending, &mut networks);
    networks.sort_by(|left, right| right.signal_percent.cmp(&left.signal_percent));
    networks.dedup_by(|left, right| left.ssid == right.ssid);
    networks
}

#[cfg(test)]
mod tests {
    use super::{parse_iw_scan, validate_wifi_passphrase};

    #[test]
    fn iw_scan_parser_reports_observed_networks_only() {
        let parsed = parse_iw_scan(
            "BSS aa:bb:cc:dd:ee:ff\n\tsignal: -48.00 dBm\n\tSSID: Plant\n\tRSN:\n\
             BSS 11:22:33:44:55:66\n\tsignal: -70.00 dBm\n\tSSID: Guest\n",
        );
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].ssid, "Plant");
        assert_eq!(parsed[0].security, "wpa2");
        assert_eq!(parsed[1].security, "open");
    }

    #[test]
    fn wifi_passphrase_accepts_eight_ascii_and_rejects_cyrillic() {
        assert!(validate_wifi_passphrase("12345678", false).is_ok());
        assert!(validate_wifi_passphrase("secret12", false).is_ok());
        assert!(validate_wifi_passphrase("short", false).is_err());
        assert!(validate_wifi_passphrase("пароль12", false).is_err());
        assert!(validate_wifi_passphrase("anything", true).is_ok());
    }
}
