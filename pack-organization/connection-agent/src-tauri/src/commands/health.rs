use crate::error::StubResult;

#[tauri::command]
pub fn desktop_client_ping() -> StubResult {
    StubResult::ok_msg("pong", "EliteEW desktop-client native bridge alive")
}
