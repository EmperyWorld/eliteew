// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// WireGuard module root: userspace transport in every build.
// System portal service lives under ops/ (ops-system-wg feature).
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-02
// ---

pub mod conf_validate;
pub mod userspace;
