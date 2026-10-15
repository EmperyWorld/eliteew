// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// App lifecycle commands (post-OTA restart) for user-facing relaunch CTA.
// Invariants:
// - app_restart requires one Rust-owned pending reason and accepts only `main`.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// ---

use serde::Deserialize;
use tauri::{AppHandle, State, Window};
use tauri_plugin_opener::OpenerExt;

use crate::action_tickets::ActionTickets;
use crate::caller_context::require_main_window;

/// Fixed external links — Wave 6 / F-10 (no caller URL).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LauncherExternalLink {
    Site,
    SupportMail,
    SourceCode,
}

fn external_url(kind: LauncherExternalLink) -> &'static str {
    match kind {
        LauncherExternalLink::Site => "https://eliteew.ru",
        LauncherExternalLink::SupportMail => "mailto:license@eliteew.ru",
        LauncherExternalLink::SourceCode => "https://github.com/EmperyWorld/eliteew",
    }
}

#[tauri::command]
pub fn launcher_open_external(
    app: AppHandle,
    window: Window,
    kind: LauncherExternalLink,
) -> Result<(), String> {
    require_main_window(&window)?;
    let url = external_url(kind);
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| format!("launcher_open_external: {e}"))?;
    eprintln!("[STEP] launcher_open_external ok");
    Ok(())
}

/// Relaunch the current binary (OTA install CTA). Does not return.
#[tauri::command]
pub fn app_restart(
    app: AppHandle,
    window: Window,
    tickets: State<'_, ActionTickets>,
) -> Result<(), String> {
    require_main_window(&window)?;
    let reason = tickets.consume_restart_ticket()?;
    eprintln!("[STEP] app_restart authorized reason={reason}");
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::{external_url, LauncherExternalLink};

    #[test]
    fn external_links_are_fixed_and_source_points_to_corresponding_repository() {
        assert_eq!(
            external_url(LauncherExternalLink::Site),
            "https://eliteew.ru"
        );
        assert_eq!(
            external_url(LauncherExternalLink::SupportMail),
            "mailto:license@eliteew.ru"
        );
        assert_eq!(
            external_url(LauncherExternalLink::SourceCode),
            "https://github.com/EmperyWorld/eliteew"
        );
    }
}
