// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---

//! Brand tokens — palette v2 cyan/metal (FHD installer shell).

use egui::{Color32, FontFamily, FontId, Stroke, TextStyle, Visuals};

/// Page canvas `#0a0c0e`
pub const INK: Color32 = Color32::from_rgb(0x0a, 0x0c, 0x0e);
/// Primary accent `#2ec4c6`
pub const ACCENT: Color32 = Color32::from_rgb(0x2e, 0xc4, 0xc6);
/// Bright CTA `#3ad7d9`
pub const ACCENT_BRIGHT: Color32 = Color32::from_rgb(0x3a, 0xd7, 0xd9);
/// Legacy aliases (cyan, not matrix-green)
pub const LIME: Color32 = ACCENT;
pub const LIME_SOFT: Color32 = ACCENT_BRIGHT;
/// Muted text `#8b97a3`
pub const MUTED: Color32 = Color32::from_rgb(0x8b, 0x97, 0xa3);
/// Danger `#ff3b4a`
pub const DANGER: Color32 = Color32::from_rgb(0xff, 0x3b, 0x4a);
/// Panel `#12161a`
pub const PANEL: Color32 = Color32::from_rgb(0x12, 0x16, 0x1a);
/// Elevated / input `#0e1216`
pub const ELEVATED: Color32 = Color32::from_rgb(0x0e, 0x12, 0x16);
/// Hairline `#1e262e`
pub const HAIR: Color32 = Color32::from_rgb(0x1e, 0x26, 0x2e);
/// Progress track
pub const TRACK: Color32 = Color32::from_rgb(0x16, 0x1c, 0x22);
/// Primary readable ink on bright buttons
pub const TEXT: Color32 = Color32::from_rgb(0xe8, 0xee, 0xf2);

pub fn apply_visuals(ctx: &egui::Context) {
    let mut visuals = Visuals::dark();
    visuals.panel_fill = INK;
    visuals.window_fill = PANEL;
    visuals.override_text_color = Some(TEXT);
    visuals.widgets.noninteractive.bg_fill = PANEL;
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0_f32, HAIR);
    visuals.widgets.inactive.bg_fill = ELEVATED;
    visuals.widgets.inactive.bg_stroke = Stroke::new(1.0_f32, HAIR);
    visuals.widgets.hovered.bg_fill = Color32::from_rgb(0x14, 0x1a, 0x20);
    visuals.widgets.hovered.bg_stroke = Stroke::new(1.0_f32, ACCENT);
    visuals.widgets.active.bg_fill = Color32::from_rgb(0x12, 0x22, 0x26);
    visuals.widgets.active.bg_stroke = Stroke::new(1.0_f32, ACCENT_BRIGHT);
    visuals.selection.bg_fill = Color32::from_rgb(0x12, 0x28, 0x2c);
    visuals.hyperlink_color = ACCENT_BRIGHT;
    visuals.window_stroke = Stroke::new(1.0_f32, HAIR);
    visuals.extreme_bg_color = INK;
    ctx.set_visuals(visuals);

    let mut style = (*ctx.style()).clone();
    style.spacing.item_spacing = egui::vec2(14.0, 12.0);
    style.spacing.button_padding = egui::vec2(20.0, 11.0);
    style.text_styles.insert(
        TextStyle::Body,
        FontId::new(15.0, FontFamily::Monospace),
    );
    style.text_styles.insert(
        TextStyle::Button,
        FontId::new(15.0, FontFamily::Proportional),
    );
    style.text_styles.insert(
        TextStyle::Heading,
        FontId::new(26.0, FontFamily::Proportional),
    );
    style.text_styles.insert(
        TextStyle::Small,
        FontId::new(12.5, FontFamily::Monospace),
    );
    ctx.set_style(style);
}
