// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Strict validators for host network IPC inputs (no shell metacharacters).
// ---

pub fn validate_ifname(raw: &str) -> Result<String, String> {
    let s = raw.trim();
    if s.is_empty() || s.len() > 15 {
        return Err("invalid_ifname".into());
    }
    if !s
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'_' || b == b'-')
    {
        return Err("invalid_ifname".into());
    }
    Ok(s.to_string())
}

pub fn validate_ssid(raw: &str) -> Result<String, String> {
    let s = raw.trim();
    if s.is_empty() || s.len() > 32 {
        return Err("invalid_ssid".into());
    }
    if s.contains('\0') || s.contains('\n') || s.contains('\r') {
        return Err("invalid_ssid".into());
    }
    Ok(s.to_string())
}

pub fn validate_wifi_password(raw: &str) -> Result<String, String> {
    if raw.len() > 63 {
        return Err("invalid_wifi_password".into());
    }
    if raw.contains('\0') || raw.contains('\n') || raw.contains('\r') {
        return Err("invalid_wifi_password".into());
    }
    Ok(raw.to_string())
}

/// Accept dotted IPv4 or IPv4/prefix (1-32).
pub fn validate_ipv4(raw: &str) -> Result<String, String> {
    let s = raw.trim();
    let (addr, prefix) = match s.split_once('/') {
        Some((a, p)) => (a, Some(p)),
        None => (s, None),
    };
    let octets: Vec<&str> = addr.split('.').collect();
    if octets.len() != 4 {
        return Err("invalid_ipv4".into());
    }
    for o in octets {
        let n: u8 = o.parse().map_err(|_| "invalid_ipv4".to_string())?;
        let _ = n;
        if o.len() > 1 && o.starts_with('0') {
            return Err("invalid_ipv4".into());
        }
    }
    if let Some(p) = prefix {
        let n: u8 = p.parse().map_err(|_| "invalid_ipv4".to_string())?;
        if !(1..=32).contains(&n) {
            return Err("invalid_ipv4".into());
        }
        return Ok(format!("{addr}/{n}"));
    }
    Ok(addr.to_string())
}

pub fn validate_dns_list(raw: &str) -> Result<String, String> {
    let s = raw.trim();
    if s.is_empty() {
        return Ok(String::new());
    }
    let mut out = Vec::new();
    for part in s.split([',', ' ']) {
        let p = part.trim();
        if p.is_empty() {
            continue;
        }
        out.push(validate_ipv4(p)?);
    }
    if out.is_empty() {
        return Err("invalid_dns".into());
    }
    Ok(out.join(","))
}
