// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// FoFline W-transport crate: portal conf validate/map, local SOCKS5 ACL, env gate,
// boringtun + smoltcp TCP-over-WG dialer, fail-closed egress plan (no Tauri/audio deps).
// Invariants:
// - Additive to system wg-portal; bare process default off; retail packages inject env=1.
// - AllowedIPs stay 10.88.89.1/32 family — no OS-wide VPN fantasy.
// - SOCKS never dials the public ISP for ACL misses or when tunnel TCP is not ready.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3 / W-transport
// ---

pub mod acl;
pub mod conf_validate;
pub mod config;
pub mod crypto_session;
pub mod egress;
pub mod gate;
pub mod runtime;
pub mod socks5;
pub mod tcp_over_wg;

pub use config::{parse_userspace_peer_config, UserspacePeerConfig};
pub use egress::{ProxyEgressPlan, PROXY_SCHEME_SOCKS5};
pub use gate::{
    ensure_packaged_w_transport_default, w_transport_enabled, ENV_FOFLINE_W_TRANSPORT,
};
pub use runtime::{
    w_transport_proxy_url, w_transport_start, w_transport_status, w_transport_stop, WTransportStatus,
};
