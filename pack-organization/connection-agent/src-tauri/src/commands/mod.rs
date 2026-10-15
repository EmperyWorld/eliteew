// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri command modules for native desktop-client (Wave 3a WG + identity).
// Invariants:
// - Commands stay thin; no mobile tunnel crates.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
// ---

pub mod ai_eliteew;
pub mod ai_local;
pub mod ai_third_party;
pub mod air_enroll;
pub mod app_lifecycle;
pub mod capsule;
pub mod clipboard;
pub mod denylist;
pub mod device_bind;
pub mod device_identity;
pub mod device_request;
pub mod entitlement;
pub mod file_grant;
pub mod fs_bridge;
pub mod health;
pub mod host_network_cmd;
pub mod kernel_offline;
pub mod license;
pub mod license_gate_cmd;
pub mod license_reset;
#[cfg(target_os = "linux")]
pub mod linux_ebrowser_downloads;
#[cfg(target_os = "linux")]
pub mod linux_ebrowser_media;
#[cfg(target_os = "linux")]
pub mod linux_meet_media;
pub mod ebrowser_stage;
pub mod native_audio;
pub mod native_oidc;
pub mod notifications;
pub mod product;
pub mod product_session;
pub mod sealed_store;
pub mod video_call_meet_stage;
pub mod spa_pack;
pub mod updater;
pub mod updater_recovery;
pub mod w_transport;
pub mod webkit_graphics;
#[cfg(feature = "ops-system-wg")]
pub mod wg;
