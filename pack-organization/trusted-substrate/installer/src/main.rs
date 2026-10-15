// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
//! First-party MIT disk installer for Trusted Substrate live media.
//! Brand: cyan/metal FHD shell; no operator console; log + optional aplay chime.

#![deny(clippy::unwrap_used)]

mod apply;
mod audio;
mod brand;
mod logutil;
mod net;
mod regional;
mod ui;

use eframe::egui;

fn main() -> eframe::Result<()> {
    logutil::init();
    // Headless UX capture (docs): X11 + EFRAME_SCREENSHOT_TO, no chime.
    if std::env::var_os("ELITEEW_TS_INSTALLER_STEP").is_some()
        || std::env::var_os("EFRAME_SCREENSHOT_TO").is_some()
    {
        // SAFETY: single-threaded before eframe.
        std::env::set_var("WINIT_UNIX_BACKEND", "x11");
        std::env::set_var("ELITEEW_TS_CHIME_ALREADY", "1");
    } else if std::env::var_os("WINIT_UNIX_BACKEND").is_none() {
        // Prefer native Wayland. X11→Xwayland+sw glamor was a major lag source.
        // SAFETY: single-threaded before eframe; set only when unset so ops can override.
        std::env::set_var("WINIT_UNIX_BACKEND", "wayland");
    }
    // Do NOT force WLR_RENDERER=pixman here — that made metal UI unusable.
    // Session wrapper owns compositor renderer selection.
    logutil::info("eliteew-ts-installer starting");

    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("EliteEW Trusted Substrate — Install")
            .with_inner_size([1920.0, 1080.0])
            .with_min_inner_size([1280.0, 720.0])
            .with_decorations(false)
            .with_maximized(true),
        ..Default::default()
    };

    eframe::run_native(
        "eliteew-ts-installer",
        options,
        Box::new(|cc| Ok(Box::new(ui::InstallerApp::new(cc)))),
    )
}
