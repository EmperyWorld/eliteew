// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// systemd-networkd backend for Trusted Substrate (wired; Wi-Fi unsupported here).
// Elevation: sudo -n (wheel NOPASSWD on TS). Drop-in name must sort before 20-wired.
// ---

use std::process::Command;

use super::types::{
    HostNetworkActionView, HostNetworkBackend, HostNetworkDeviceView, HostNetworkStatusView,
    HostWiredApplyRequest, HostWiredMode,
};
use super::validate::{validate_dns_list, validate_ifname, validate_ipv4};

/// Lexical first-match: must sort before SoT `20-wired.network`.
pub const NETWORKD_DROPIN_PREFIX: &str = "10-eliteew-";

pub fn available() -> bool {
    Command::new("networkctl")
        .arg("--no-pager")
        .arg("status")
        .output()
        .map(|o| o.status.success() || o.status.code() == Some(1))
        .unwrap_or(false)
        && std::path::Path::new("/run/systemd/netif").exists()
}

pub fn status() -> HostNetworkStatusView {
    let output = Command::new("ip").args(["-br", "link"]).output();
    let Ok(out) = output else {
        return HostNetworkStatusView::unavailable("Не удалось прочитать интерфейсы.");
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let mut devices = Vec::new();
    for line in text.lines() {
        let mut parts = line.split_whitespace();
        let Some(name) = parts.next() else {
            continue;
        };
        if name == "lo" || name.starts_with("wg") || name.starts_with("docker") {
            continue;
        }
        let state = parts.next().unwrap_or("UNKNOWN").to_string();
        let kind = if name.starts_with('w') {
            "wifi".to_string()
        } else {
            "ethernet".to_string()
        };
        let ipv4 = ipv4_for_if(name);
        devices.push(HostNetworkDeviceView {
            name: name.to_string(),
            kind,
            state,
            connection: None,
            ipv4,
        });
    }
    HostNetworkStatusView {
        ok: true,
        code: "ok".into(),
        message: "systemd-networkd".into(),
        backend: HostNetworkBackend::Networkd,
        wifi_supported: false,
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
        if let Some(idx) = line.find("inet ") {
            let rest = &line[idx + 5..];
            if let Some(token) = rest.split_whitespace().next() {
                addrs.push(token.to_string());
            }
        }
    }
    addrs
}

/// Apply wired config via `sudo -n` + networkd drop-in (validated argv only).
///
/// Trusted Substrate kiosk has no Polkit agent; `%wheel NOPASSWD: ALL` is the elevation SoT.
pub fn wired_apply(req: &HostWiredApplyRequest) -> Result<HostNetworkActionView, String> {
    let ifname = validate_ifname(&req.ifname)?;
    let (dhcp, address, gateway, dns) = match req.mode {
        HostWiredMode::Dhcp => ("yes", String::new(), String::new(), String::new()),
        HostWiredMode::Static => {
            let address = req
                .address
                .as_deref()
                .ok_or_else(|| "address_required".to_string())?;
            let mut address = validate_ipv4(address)?;
            if !address.contains('/') {
                address = format!("{address}/24");
            }
            let gateway = req
                .gateway
                .as_deref()
                .ok_or_else(|| "gateway_required".to_string())?;
            let gateway = validate_ipv4(gateway)?;
            if gateway.contains('/') {
                return Err("gateway_must_be_host".into());
            }
            let dns = match req.dns.as_deref() {
                Some(d) => validate_dns_list(d)?,
                None => String::new(),
            };
            ("no", address, gateway, dns)
        }
    };

    // Root helper: write 10-eliteew-* (before 20-wired), drop stale 30-/install units, reconfigure.
    let script = r#"set -euo pipefail
ifname="$1"
dhcp="$2"
address="$3"
gateway="$4"
dns="$5"
case "$ifname" in
  ''|*[!a-zA-Z0-9._-]*) echo invalid_ifname >&2; exit 2 ;;
esac
dest="/etc/systemd/network/10-eliteew-${ifname}.network"
tmp="$(mktemp)"
{
  echo '[Match]'
  echo "Name=${ifname}"
  echo
  echo '[Network]'
  if [ "$dhcp" = "yes" ]; then
    echo 'DHCP=yes'
  else
    echo 'DHCP=no'
    echo "Address=${address}"
    echo "Gateway=${gateway}"
    if [ -n "$dns" ]; then
      oldifs="$IFS"
      IFS=','
      for d in $dns; do
        d="$(echo "$d" | tr -d ' ')"
        [ -n "$d" ] && echo "DNS=${d}"
      done
      IFS="$oldifs"
    fi
  fi
  echo 'LLMNR=no'
  echo 'MulticastDNS=no'
} >"$tmp"
install -m 0644 "$tmp" "$dest"
rm -f "$tmp"
# Stale names that lose to 20-wired or conflict with this drop-in.
rm -f "/etc/systemd/network/30-eliteew-${ifname}.network"
rm -f "/etc/systemd/network/20-eliteew-ts-install-${ifname}.network"
networkctl reload
networkctl reconfigure "$ifname" || true
"#;

    let output = Command::new("sudo")
        .args([
            "-n",
            "bash",
            "-c",
            script,
            "eliteew-host-network",
            &ifname,
            dhcp,
            &address,
            &gateway,
            &dns,
        ])
        .output()
        .map_err(|e| format!("sudo_spawn_failed:{e}"))?;

    if !output.status.success() {
        let code = output.status.code().unwrap_or(-1);
        eprintln!("[STEP] host_network_networkd_apply_fail code={code}");
        let stderr = String::from_utf8_lossy(&output.stderr);
        let combined = format!("{stderr} {}", String::from_utf8_lossy(&output.stdout)).to_ascii_lowercase();
        if code == 1
            && (combined.contains("password is required")
                || combined.contains("a password is required")
                || combined.contains("no askpass")
                || combined.contains("a terminal is required"))
        {
            return Err("elevation_denied".into());
        }
        if combined.contains("not allowed") || combined.contains("permission denied") {
            return Err("elevation_denied".into());
        }
        return Err("networkd_apply_failed".into());
    }

    Ok(HostNetworkActionView::ok_msg(
        "wired_applied",
        "Кабельное подключение обновлено.",
    ))
}

#[cfg(test)]
mod tests {
    use super::NETWORKD_DROPIN_PREFIX;

    #[test]
    fn dropin_sorts_before_wired_default() {
        let elite = format!("{NETWORKD_DROPIN_PREFIX}eno1.network");
        assert!(elite.as_str() < "20-wired.network");
        assert!(elite.as_str() < "30-eliteew-eno1.network");
    }
}
