// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Parse validated portal handoff conf into userspace peer fields (no secrets logged).
// Invariants:
// - Must pass conf_validate first; re-deny full-tunnel at mapping layer.
// Related:
// - crate::conf_validate
// ---

use std::net::{Ipv4Addr, SocketAddr};

use crate::conf_validate::ConfValidationError;

/// Portal edge API/DNS IP — only AllowedIPs target for W-transport.
pub const EDGE_IPV4: Ipv4Addr = Ipv4Addr::new(10, 88, 89, 1);
pub const EDGE_ALLOWED_CIDR: &str = "10.88.89.1/32";
/// Public edge VIP (DNS for app|auth|meet.eliteew.ru). Local SOCKS clients that resolve
/// via ISP (`socks5://`, not `socks5h://`) CONNECT here — rewrite to [`EDGE_IPV4`].
pub const EDGE_PUBLIC_IPV4: Ipv4Addr = Ipv4Addr::new(93, 77, 165, 185);

#[derive(Debug, Clone)]
pub struct UserspacePeerConfig {
    /// Interface private key (base64) — never log.
    pub private_key_b64: String,
    /// Peer (edge) public key (base64) — never log.
    pub peer_public_key_b64: String,
    /// Assigned tunnel address (host /32), e.g. 10.88.89.101.
    pub address: Ipv4Addr,
    /// UDP endpoint of portal edge.
    pub endpoint: SocketAddr,
    /// DNS = edge (product name resolution over tunnel when wired).
    pub dns: Ipv4Addr,
    pub mtu: u16,
    pub persistent_keepalive_secs: Option<u16>,
    /// Exact AllowedIPs string after validate (must be EDGE_ALLOWED_CIDR).
    pub allowed_ips: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserspaceConfigError {
    pub code: &'static str,
    pub message: String,
}

impl From<ConfValidationError> for UserspaceConfigError {
    fn from(e: ConfValidationError) -> Self {
        Self {
            code: e.code,
            message: e.message,
        }
    }
}

/// Validate portal invariants then map to userspace peer config.
pub fn parse_userspace_peer_config(conf: &str) -> Result<UserspacePeerConfig, UserspaceConfigError> {
    let typed = crate::conf_validate::parse_typed_portal_conf(conf)?;
    Ok(UserspacePeerConfig {
        private_key_b64: typed.private_key_b64,
        peer_public_key_b64: typed.peer_public_key_b64,
        address: typed.address,
        endpoint: typed.endpoint,
        dns: typed.dns,
        mtu: typed.mtu,
        persistent_keepalive_secs: typed.persistent_keepalive_secs,
        allowed_ips: typed.allowed_ips,
    })
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
    fn maps_portal_conf() {
        let cfg = parse_userspace_peer_config(GOOD).expect("good conf");
        assert_eq!(cfg.address, Ipv4Addr::new(10, 88, 89, 101));
        assert_eq!(cfg.dns, EDGE_IPV4);
        assert_eq!(cfg.mtu, 1380);
        assert_eq!(cfg.endpoint.port(), 51823);
        assert_eq!(cfg.allowed_ips, EDGE_ALLOWED_CIDR);
        assert_eq!(cfg.persistent_keepalive_secs, Some(25));
    }

    #[test]
    fn denies_full_tunnel_fantasy() {
        let bad = GOOD.replace("10.88.89.1/32", "0.0.0.0/0");
        let err = parse_userspace_peer_config(&bad).unwrap_err();
        assert_eq!(err.code, "full_tunnel_forbidden");
    }

    #[test]
    fn denies_extra_cidrs() {
        let bad = GOOD.replace(
            "AllowedIPs = 10.88.89.1/32",
            "AllowedIPs = 10.88.89.1/32, 10.0.0.0/8",
        );
        let err = parse_userspace_peer_config(&bad).unwrap_err();
        assert_eq!(err.code, "allowed_ips");
    }
}
