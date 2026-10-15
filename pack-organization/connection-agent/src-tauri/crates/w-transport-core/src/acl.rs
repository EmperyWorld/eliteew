// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Destination ACL for W-transport SOCKS/TCP forward — edge /32 only.
// Invariants:
// - Deny 0.0.0.0/0 fantasy and any host outside 10.88.89.1.
// Related:
// - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
// ---

use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use super::config::{EDGE_IPV4, EDGE_PUBLIC_IPV4};

/// Ports allowed through the userspace tunnel toward the portal edge.
pub const ALLOWED_EDGE_PORTS: &[u16] = &[443, 80, 53];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AclDeny {
    pub code: &'static str,
    pub message: String,
}

/// Map ISP-resolved public edge VIP → tunnel edge /32 (same nginx/API front).
pub fn normalize_destination(addr: SocketAddr) -> SocketAddr {
    match addr.ip() {
        IpAddr::V4(v4) if v4 == EDGE_PUBLIC_IPV4 => {
            SocketAddr::new(IpAddr::V4(EDGE_IPV4), addr.port())
        }
        _ => addr,
    }
}

/// Return Ok when destination is the portal edge IP on an allowed port.
pub fn allow_destination(addr: SocketAddr) -> Result<(), AclDeny> {
    let addr = normalize_destination(addr);
    match addr.ip() {
        IpAddr::V4(v4) if v4 == EDGE_IPV4 => {
            if !ALLOWED_EDGE_PORTS.contains(&addr.port()) {
                return Err(AclDeny {
                    code: "port_denied",
                    message: format!(
                        "port {} not in allowlist for edge (allowed: {:?})",
                        addr.port(),
                        ALLOWED_EDGE_PORTS
                    ),
                });
            }
            Ok(())
        }
        IpAddr::V4(v4) => Err(AclDeny {
            code: "host_denied",
            message: format!("destination {v4} is outside AllowedIPs {EDGE_IPV4}/32"),
        }),
        IpAddr::V6(_) => Err(AclDeny {
            code: "ipv6_denied",
            message: "IPv6 destinations are denied for FoFline W-transport (leak posture)".into(),
        }),
    }
}

/// True when hostname is in the W-transport product map (HTTPS/WSS via edge /32).
/// Includes Meet so VideoCallApp Meet stage can CONNECT through fail-closed SOCKS
/// (WebKit surfaces ACL deny as «SOCKSv5 connection not allowed by ruleset»).
fn is_product_map_hostname(host: &str) -> bool {
    let h = host.trim_end_matches('.').to_ascii_lowercase();
    h == "app.eliteew.ru"
        || h == "auth.eliteew.ru"
        || h == "meet.eliteew.ru"
        || h.ends_with(".meet.eliteew.ru")
}

/// Parse SOCKS5 address form into SocketAddr for ACL.
///
/// Hostnames: portal product map (`app` / `auth` / `meet.eliteew.ru` → edge IP).
/// This is **not** full DNS-over-tunnel (no UDP/53 query to `10.88.89.1` yet) — honest
/// hostname→edge rewrite so WebView cannot silently use public DNS for those names.
/// Public edge VIP (`EDGE_PUBLIC_IPV4`) is rewritten to tunnel edge (local DNS + `socks5://`).
/// WebRTC media UDP to the public edge VIP still bypasses this TCP SOCKS map (see Meet media canon).
pub fn socket_from_host_port(host: &str, port: u16) -> Result<SocketAddr, AclDeny> {
    if let Ok(ip) = host.parse::<IpAddr>() {
        return Ok(normalize_destination(SocketAddr::new(ip, port)));
    }
    if is_product_map_hostname(host) {
        return Ok(SocketAddr::new(IpAddr::V4(EDGE_IPV4), port));
    }
    Err(AclDeny {
        code: "hostname_unresolved",
        message: format!(
            "hostname {host} not in W-transport product map (app|auth|meet.eliteew.ru → {EDGE_IPV4}); full DNS-over-tunnel residual"
        ),
    })
}

pub fn is_edge_ipv4(ip: Ipv4Addr) -> bool {
    ip == EDGE_IPV4
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::EDGE_PUBLIC_IPV4;
    use std::net::SocketAddrV4;

    #[test]
    fn allows_edge_https() {
        let a = SocketAddr::V4(SocketAddrV4::new(EDGE_IPV4, 443));
        assert!(allow_destination(a).is_ok());
    }

    #[test]
    fn denies_public_host() {
        let a: SocketAddr = "1.1.1.1:443".parse().unwrap();
        let err = allow_destination(a).unwrap_err();
        assert_eq!(err.code, "host_denied");
    }

    #[test]
    fn denies_full_tunnel_ports_on_wrong_host() {
        let a: SocketAddr = "8.8.8.8:53".parse().unwrap();
        assert_eq!(allow_destination(a).unwrap_err().code, "host_denied");
    }

    #[test]
    fn denies_edge_random_port() {
        let a = SocketAddr::V4(SocketAddrV4::new(EDGE_IPV4, 22));
        assert_eq!(allow_destination(a).unwrap_err().code, "port_denied");
    }

    #[test]
    fn maps_product_hostnames_to_edge() {
        let a = socket_from_host_port("app.eliteew.ru", 443).unwrap();
        assert_eq!(a.ip(), IpAddr::V4(EDGE_IPV4));
        assert_eq!(a.port(), 443);
        let auth = socket_from_host_port("auth.eliteew.ru", 443).unwrap();
        assert_eq!(auth.ip(), IpAddr::V4(EDGE_IPV4));
        let meet = socket_from_host_port("meet.eliteew.ru", 443).unwrap();
        assert_eq!(meet.ip(), IpAddr::V4(EDGE_IPV4));
        let meet_sub = socket_from_host_port("xmpp.meet.eliteew.ru", 443).unwrap();
        assert_eq!(meet_sub.ip(), IpAddr::V4(EDGE_IPV4));
    }

    #[test]
    fn denies_unknown_hostname_not_in_product_map() {
        let err = socket_from_host_port("cdn.example.com", 443).unwrap_err();
        assert_eq!(err.code, "hostname_unresolved");
        assert!(err.message.contains("product map"));
    }

    #[test]
    fn rewrites_public_edge_vip_to_tunnel_edge() {
        let public = SocketAddr::V4(SocketAddrV4::new(EDGE_PUBLIC_IPV4, 443));
        assert!(allow_destination(public).is_ok());
        let norm = normalize_destination(public);
        assert_eq!(norm.ip(), IpAddr::V4(EDGE_IPV4));
        let from_host = socket_from_host_port("93.77.165.185", 443).unwrap();
        assert_eq!(from_host.ip(), IpAddr::V4(EDGE_IPV4));
    }
}
