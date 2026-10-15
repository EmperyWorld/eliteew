// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// In-app WebKitGTK graphics escalate recovery — clear sticky software-compositing
// without shell `rm` (user-product obligations).
// Invariants:
// - Linux-only effect; other OS returns honest not_linux / idle status.
// - Reset clears sticky + strikes; env applies on next process start (restart).
// Related:
// - crate::webkit_linux
// - documentation/product/desktop/DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md
// ---

use crate::error::StubResult;
use crate::webkit_linux;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct WebkitGraphicsStatusView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub sticky_compositing_off: bool,
    pub process_escalated: bool,
    pub unclean_strikes: u32,
    /// True when UI should offer «Вернуть плавность» (sticky and/or this process escalated).
    pub recovery_available: bool,
}

fn view_from(status: webkit_linux::GraphicsRecoveryView) -> WebkitGraphicsStatusView {
    let recovery_available = status.sticky_compositing_off || status.process_escalated;
    let (code, message) = if !cfg!(target_os = "linux") {
        (
            "not_linux".to_string(),
            "WebKit graphics recovery is Linux-only".to_string(),
        )
    } else if recovery_available {
        (
            "escalated".to_string(),
            "Compatibility graphics mode is active — interface may feel slow".to_string(),
        )
    } else {
        (
            "ok".to_string(),
            "GPU compositing path (no sticky escalate)".to_string(),
        )
    };
    WebkitGraphicsStatusView {
        ok: true,
        code,
        message,
        sticky_compositing_off: status.sticky_compositing_off,
        process_escalated: status.process_escalated,
        unclean_strikes: status.unclean_strikes,
        recovery_available,
    }
}

#[tauri::command]
pub fn webkit_graphics_status() -> WebkitGraphicsStatusView {
    view_from(webkit_linux::graphics_recovery_status())
}

/// Clear sticky escalate artifacts; FE must restart for GPU path to apply.
#[tauri::command]
pub fn webkit_graphics_reset() -> Result<StubResult, String> {
    if !cfg!(target_os = "linux") {
        return Ok(StubResult {
            ok: false,
            code: "not_linux".into(),
            message: "WebKit graphics recovery is Linux-only".into(),
        });
    }
    let before = webkit_linux::graphics_recovery_status();
    if !before.sticky_compositing_off && !before.process_escalated {
        return Ok(StubResult {
            ok: true,
            code: "already_ok".into(),
            message: "Graphics path already clear — restart not required".into(),
        });
    }
    let _after = webkit_linux::clear_graphics_sticky_for_user_recovery();
    Ok(StubResult {
        ok: true,
        code: "cleared_restart_required".into(),
        message: "Compatibility mode cleared — restart to restore smooth UI".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_view_links() {
        let v = webkit_graphics_status();
        assert!(v.ok);
        assert!(!v.code.is_empty());
    }
}
