// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Re-export portal conf validation from w-transport-core (single SoT).
// Invariants:
// - AllowedIPs must be exactly 10.88.89.1/32 (no 0.0.0.0/0, ::/0, or extra CIDRs).
// Related:
// - w_transport_core::conf_validate
// ---

pub use w_transport_core::conf_validate::*;
