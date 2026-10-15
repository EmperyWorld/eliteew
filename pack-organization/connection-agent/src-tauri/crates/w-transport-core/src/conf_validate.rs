// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Strict typed wg-portal handoff parser + canonical renderer (Wave 2 / F-02).
// Invariants:
// - Exactly one [Interface] and one [Peer]; allowlisted keys only; duplicates fail closed.
// - Forbidden hooks/directives (PreUp/PostUp/Table/SaveConfig/Include/…) always reject.
// - AllowedIPs exactly 10.88.89.1/32; MTU 1380; DNS edge; UDP 51823; no shell metacharacters.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-02
// - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
// ---

use std::collections::BTreeMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use base64::Engine;

pub const EDGE_IP: &str = "10.88.89.1";
pub const REQUIRED_ALLOWED_IPS: &str = "10.88.89.1/32";
pub const REQUIRED_MTU: u16 = 1380;
pub const REQUIRED_PORT: u16 = 51823;

const INTERFACE_KEYS: &[&str] = &["PrivateKey", "Address", "DNS", "MTU"];
const PEER_KEYS: &[&str] = &[
    "PublicKey",
    "Endpoint",
    "AllowedIPs",
    "PersistentKeepalive",
];
const FORBIDDEN_KEYS: &[&str] = &[
    "PreUp",
    "PostUp",
    "PreDown",
    "PostDown",
    "Table",
    "SaveConfig",
    "Include",
    "ListenPort",
    "FwMark",
    "Jc",
    "Jmin",
    "Jmax",
    "S1",
    "S2",
    "H1",
    "H2",
    "H3",
    "H4",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfValidationError {
    pub code: &'static str,
    pub message: String,
}

/// Strict typed portal peer after validation (secrets never logged).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TypedPortalConf {
    pub private_key_b64: String,
    pub address: Ipv4Addr,
    pub dns: Ipv4Addr,
    pub mtu: u16,
    pub peer_public_key_b64: String,
    pub endpoint: SocketAddr,
    pub allowed_ips: String,
    pub persistent_keepalive_secs: Option<u16>,
}

impl ConfValidationError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

/// Validate then return typed fields (Wave 2 SoT).
pub fn parse_typed_portal_conf(conf: &str) -> Result<TypedPortalConf, ConfValidationError> {
    let sections = parse_sections(conf)?;
    if sections.len() != 2 {
        return Err(ConfValidationError::new(
            "section_count",
            "conf must contain exactly one [Interface] and one [Peer] section",
        ));
    }
    let iface = sections
        .get("Interface")
        .ok_or_else(|| ConfValidationError::new("missing_sections", "missing [Interface]"))?;
    let peer = sections
        .get("Peer")
        .ok_or_else(|| ConfValidationError::new("missing_sections", "missing [Peer]"))?;

    require_only_keys(iface, INTERFACE_KEYS, "Interface")?;
    require_only_keys(peer, PEER_KEYS, "Peer")?;
    require_key(iface, "PrivateKey")?;
    require_key(iface, "Address")?;
    require_key(iface, "DNS")?;
    require_key(iface, "MTU")?;
    require_key(peer, "PublicKey")?;
    require_key(peer, "Endpoint")?;
    require_key(peer, "AllowedIPs")?;

    let private_key_b64 = require_wg_key(iface.get("PrivateKey").expect("checked"))?;
    let peer_public_key_b64 = require_wg_key(peer.get("PublicKey").expect("checked"))?;
    let address = parse_address_slash32(iface.get("Address").expect("checked"))?;
    let dns = parse_ipv4_exact(iface.get("DNS").expect("checked"), "DNS")?;
    if dns.to_string() != EDGE_IP {
        return Err(ConfValidationError::new(
            "dns",
            format!("DNS must be exactly {EDGE_IP}"),
        ));
    }
    let mtu = parse_u16(iface.get("MTU").expect("checked"), "MTU")?;
    if mtu != REQUIRED_MTU {
        return Err(ConfValidationError::new(
            "mtu",
            format!("MTU must be {REQUIRED_MTU}"),
        ));
    }
    let endpoint = parse_endpoint(peer.get("Endpoint").expect("checked"))?;
    if endpoint.port() != REQUIRED_PORT {
        return Err(ConfValidationError::new(
            "endpoint_port",
            format!("Endpoint must use UDP {REQUIRED_PORT}"),
        ));
    }
    let allowed_ips = peer.get("AllowedIPs").expect("checked").clone();
    if allowed_ips_is_forbidden(&allowed_ips) {
        return Err(ConfValidationError::new(
            "full_tunnel_forbidden",
            format!("AllowedIPs={allowed_ips} is forbidden (split tunnel only)"),
        ));
    }
    if !allowed_ips_is_exact_edge(&allowed_ips) {
        return Err(ConfValidationError::new(
            "allowed_ips",
            format!("AllowedIPs must be exactly {REQUIRED_ALLOWED_IPS}"),
        ));
    }
    let persistent_keepalive_secs = match peer.get("PersistentKeepalive") {
        Some(raw) => Some(parse_u16(raw, "PersistentKeepalive")?),
        None => None,
    };

    Ok(TypedPortalConf {
        private_key_b64,
        address,
        dns,
        mtu,
        peer_public_key_b64,
        endpoint,
        allowed_ips: REQUIRED_ALLOWED_IPS.to_string(),
        persistent_keepalive_secs,
    })
}

/// Compatibility entry: typed parse success == validated.
pub fn validate_portal_handoff_conf(conf: &str) -> Result<(), ConfValidationError> {
    parse_typed_portal_conf(conf).map(|_| ())
}

/// Canonical conf for install — never re-emits attacker-controlled spacing/hooks.
pub fn render_canonical_conf(typed: &TypedPortalConf) -> String {
    let mut out = String::new();
    out.push_str("[Interface]\n");
    out.push_str(&format!("PrivateKey = {}\n", typed.private_key_b64));
    out.push_str(&format!("Address = {}/32\n", typed.address));
    out.push_str(&format!("DNS = {}\n", typed.dns));
    out.push_str(&format!("MTU = {}\n", typed.mtu));
    out.push('\n');
    out.push_str("[Peer]\n");
    out.push_str(&format!("PublicKey = {}\n", typed.peer_public_key_b64));
    out.push_str(&format!("Endpoint = {}\n", typed.endpoint));
    out.push_str(&format!("AllowedIPs = {}\n", typed.allowed_ips));
    if let Some(ka) = typed.persistent_keepalive_secs {
        out.push_str(&format!("PersistentKeepalive = {ka}\n"));
    }
    out
}

fn parse_sections(
    conf: &str,
) -> Result<BTreeMap<&'static str, BTreeMap<String, String>>, ConfValidationError> {
    let text = conf.trim();
    if text.is_empty() {
        return Err(ConfValidationError::new("empty_conf", "handoff conf is empty"));
    }
    let mut sections: BTreeMap<&'static str, BTreeMap<String, String>> = BTreeMap::new();
    let mut current: Option<&'static str> = None;

    for (idx, raw_line) in text.lines().enumerate() {
        let line_no = idx + 1;
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            let name = &line[1..line.len() - 1];
            reject_unsafe_token(name, "section", line_no)?;
            let canon = match name.to_ascii_lowercase().as_str() {
                "interface" => "Interface",
                "peer" => "Peer",
                _ => {
                    return Err(ConfValidationError::new(
                        "unknown_section",
                        format!("unknown section [{name}] at line {line_no}"),
                    ));
                }
            };
            if sections.contains_key(canon) {
                return Err(ConfValidationError::new(
                    "duplicate_section",
                    format!("duplicate [{canon}] at line {line_no}"),
                ));
            }
            sections.insert(canon, BTreeMap::new());
            current = Some(canon);
            continue;
        }
        let Some(section) = current else {
            return Err(ConfValidationError::new(
                "orphan_line",
                format!("key outside section at line {line_no}"),
            ));
        };
        let Some((k_raw, v_raw)) = line.split_once('=') else {
            return Err(ConfValidationError::new(
                "malformed_line",
                format!("expected key = value at line {line_no}"),
            ));
        };
        let key = k_raw.trim();
        let value = v_raw.trim();
        if key.is_empty() || value.is_empty() {
            return Err(ConfValidationError::new(
                "empty_field",
                format!("empty key/value at line {line_no}"),
            ));
        }
        reject_unsafe_token(key, "key", line_no)?;
        reject_unsafe_value(value, line_no)?;
        if is_forbidden_key(key) {
            return Err(ConfValidationError::new(
                "forbidden_key",
                format!("forbidden key {key} at line {line_no}"),
            ));
        }
        let map = sections.get_mut(section).expect("section inserted");
        let canon_key = canonicalize_known_key(section, key).ok_or_else(|| {
            ConfValidationError::new(
                "unknown_key",
                format!("unknown key {key} in [{section}] at line {line_no}"),
            )
        })?;
        if map.contains_key(canon_key) {
            return Err(ConfValidationError::new(
                "duplicate_key",
                format!("duplicate {canon_key} in [{section}] at line {line_no}"),
            ));
        }
        map.insert(canon_key.to_string(), value.to_string());
    }
    Ok(sections)
}

fn canonicalize_known_key(section: &str, key: &str) -> Option<&'static str> {
    let list = match section {
        "Interface" => INTERFACE_KEYS,
        "Peer" => PEER_KEYS,
        _ => return None,
    };
    list.iter()
        .copied()
        .find(|k| k.eq_ignore_ascii_case(key))
}

fn is_forbidden_key(key: &str) -> bool {
    FORBIDDEN_KEYS
        .iter()
        .any(|k| k.eq_ignore_ascii_case(key))
}

fn require_only_keys(
    map: &BTreeMap<String, String>,
    allowed: &[&str],
    section: &str,
) -> Result<(), ConfValidationError> {
    for key in map.keys() {
        if !allowed.iter().any(|a| a.eq_ignore_ascii_case(key)) {
            return Err(ConfValidationError::new(
                "unknown_key",
                format!("unknown key {key} in [{section}]"),
            ));
        }
    }
    Ok(())
}

fn require_key(
    map: &BTreeMap<String, String>,
    key: &str,
) -> Result<(), ConfValidationError> {
    if map.contains_key(key) {
        Ok(())
    } else {
        Err(ConfValidationError::new(
            "missing_field",
            format!("missing {key}"),
        ))
    }
}

fn reject_unsafe_token(token: &str, kind: &str, line_no: usize) -> Result<(), ConfValidationError> {
    if !token.is_ascii() {
        return Err(ConfValidationError::new(
            "non_ascii",
            format!("non-ASCII {kind} at line {line_no}"),
        ));
    }
    if token.chars().any(|c| c.is_whitespace()) {
        return Err(ConfValidationError::new(
            "whitespace_token",
            format!("{kind} contains whitespace at line {line_no}"),
        ));
    }
    Ok(())
}

fn reject_unsafe_value(value: &str, line_no: usize) -> Result<(), ConfValidationError> {
    if !value.is_ascii() {
        return Err(ConfValidationError::new(
            "non_ascii",
            format!("non-ASCII value at line {line_no}"),
        ));
    }
    const BAD: &[char] = &[
        ';', '|', '&', '`', '$', '(', ')', '<', '>', '\n', '\r', '\0', '\\', '"', '\'',
    ];
    if value.chars().any(|c| BAD.contains(&c)) {
        return Err(ConfValidationError::new(
            "shell_metachar",
            format!("value contains forbidden characters at line {line_no}"),
        ));
    }
    Ok(())
}

fn require_wg_key(raw: &str) -> Result<String, ConfValidationError> {
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(raw.as_bytes())
        .map_err(|_| ConfValidationError::new("keys", "WireGuard key must be standard base64"))?;
    if decoded.len() != 32 {
        return Err(ConfValidationError::new(
            "keys",
            format!("WireGuard key must decode to 32 bytes (got {})", decoded.len()),
        ));
    }
    Ok(raw.to_string())
}

fn parse_address_slash32(raw: &str) -> Result<Ipv4Addr, ConfValidationError> {
    let (host, prefix) = raw
        .split_once('/')
        .ok_or_else(|| ConfValidationError::new("address", "Address must be IPv4/32"))?;
    if prefix != "32" {
        return Err(ConfValidationError::new(
            "address",
            "Address prefix must be /32",
        ));
    }
    host.parse::<Ipv4Addr>()
        .map_err(|_| ConfValidationError::new("address", format!("invalid Address={raw}")))
}

fn parse_ipv4_exact(raw: &str, key: &str) -> Result<Ipv4Addr, ConfValidationError> {
    raw.parse()
        .map_err(|_| ConfValidationError::new("parse", format!("invalid {key}={raw}")))
}

fn parse_u16(raw: &str, key: &str) -> Result<u16, ConfValidationError> {
    raw.parse()
        .map_err(|_| ConfValidationError::new("parse", format!("invalid {key}={raw}")))
}

fn parse_endpoint(raw: &str) -> Result<SocketAddr, ConfValidationError> {
    raw.parse::<SocketAddr>().or_else(|_| -> Result<SocketAddr, ()> {
        let (h, p) = raw.rsplit_once(':').ok_or(())?;
        let ip: IpAddr = h.parse().map_err(|_| ())?;
        let port: u16 = p.parse().map_err(|_| ())?;
        Ok(SocketAddr::new(ip, port))
    })
    .map_err(|_: ()| ConfValidationError::new("endpoint", format!("invalid Endpoint={raw}")))
}

fn allowed_ips_is_forbidden(raw: &str) -> bool {
    raw.split(',').any(|part| {
        let p = part.trim().to_ascii_lowercase();
        p == "0.0.0.0/0" || p == "::/0"
    })
}

fn allowed_ips_is_exact_edge(raw: &str) -> bool {
    let parts: Vec<&str> = raw
        .split(',')
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();
    parts.len() == 1 && parts[0].eq_ignore_ascii_case(REQUIRED_ALLOWED_IPS)
}

#[cfg(test)]
mod tests {
    use super::*;

    const GOOD: &str = r#"
[Interface]
PrivateKey = AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=
Address = 10.88.89.101/32
DNS = 10.88.89.1
MTU = 1380

[Peer]
PublicKey = AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=
Endpoint = 93.77.165.185:51823
AllowedIPs = 10.88.89.1/32
PersistentKeepalive = 25
"#;

    #[test]
    fn accepts_portal_handoff() {
        let typed = parse_typed_portal_conf(GOOD).expect("good");
        assert_eq!(typed.mtu, 1380);
        assert_eq!(typed.endpoint.port(), 51823);
        let canon = render_canonical_conf(&typed);
        assert!(validate_portal_handoff_conf(&canon).is_ok());
        assert!(!canon.contains("PreUp"));
    }

    #[test]
    fn rejects_full_tunnel() {
        let bad = GOOD.replace("10.88.89.1/32", "0.0.0.0/0");
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "full_tunnel_forbidden"
        );
    }

    #[test]
    fn rejects_ipv6_full_tunnel() {
        let bad = GOOD.replace(
            "AllowedIPs = 10.88.89.1/32",
            "AllowedIPs = ::/0",
        );
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "full_tunnel_forbidden"
        );
    }

    #[test]
    fn rejects_extra_cidrs() {
        let bad = GOOD.replace(
            "AllowedIPs = 10.88.89.1/32",
            "AllowedIPs = 10.88.89.1/32, 10.0.0.0/8",
        );
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "allowed_ips"
        );
    }

    #[test]
    fn rejects_wrong_mtu() {
        let bad = GOOD.replace("MTU = 1380", "MTU = 1420");
        assert_eq!(validate_portal_handoff_conf(&bad).unwrap_err().code, "mtu");
    }

    #[test]
    fn rejects_wrong_port() {
        let bad = GOOD.replace(":51823", ":51822");
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "endpoint_port"
        );
    }

    #[test]
    fn rejects_preup_hook() {
        let bad = GOOD.replace(
            "MTU = 1380",
            "MTU = 1380\nPreUp = /bin/true",
        );
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "forbidden_key"
        );
    }

    #[test]
    fn rejects_duplicate_peer() {
        let bad = format!("{GOOD}\n[Peer]\nPublicKey = AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=\nEndpoint = 93.77.165.185:51823\nAllowedIPs = 10.88.89.1/32\n");
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "duplicate_section"
        );
    }

    #[test]
    fn rejects_shell_metachar_in_endpoint() {
        let bad = GOOD.replace(
            "Endpoint = 93.77.165.185:51823",
            "Endpoint = 93.77.165.185:51823;id",
        );
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "shell_metachar"
        );
    }

    #[test]
    fn rejects_unknown_key() {
        let bad = GOOD.replace("MTU = 1380", "MTU = 1380\nFancy = 1");
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "unknown_key"
        );
    }

    #[test]
    fn rejects_duplicate_key() {
        let bad = GOOD.replace("MTU = 1380", "MTU = 1380\nMTU = 1380");
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "duplicate_key"
        );
    }

    #[test]
    fn rejects_option_shaped_whitespace_key() {
        let bad = GOOD.replace("MTU = 1380", "MTU = 1380\n PrivateKey = AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=");
        // leading space trimmed → duplicate PrivateKey
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "duplicate_key"
        );
    }

    #[test]
    fn rejects_malformed_key_length() {
        let bad = GOOD.replace(
            "PrivateKey = AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",
            "PrivateKey = YQ==",
        );
        assert_eq!(validate_portal_handoff_conf(&bad).unwrap_err().code, "keys");
    }

    #[test]
    fn rejects_saveconfig() {
        let bad = GOOD.replace("MTU = 1380", "MTU = 1380\nSaveConfig = true");
        assert_eq!(
            validate_portal_handoff_conf(&bad).unwrap_err().code,
            "forbidden_key"
        );
    }
}
