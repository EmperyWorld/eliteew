// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Shared typed error / stub result for desktop-client Tauri commands (Wave 1).
// Invariants:
// - Stub commands return ok=false with stable code strings (not panics).
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
// ---

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct StubResult {
    pub ok: bool,
    pub code: String,
    pub message: String,
}

impl StubResult {
    /// Reserved for future stub commands (kept for stable `not_implemented` code).
    #[allow(dead_code)]
    pub fn not_implemented(feature: &str) -> Self {
        Self {
            ok: false,
            code: "not_implemented".into(),
            message: format!("{feature} is stubbed until a later wave"),
        }
    }

    pub fn ok_msg(code: &str, message: impl Into<String>) -> Self {
        Self {
            ok: true,
            code: code.into(),
            message: message.into(),
        }
    }
}
