// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// O5 local notifications inbox commands (no push).
// Invariants:
// - Device-local only; honest empty state when inbox empty.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// ---

use serde::Serialize;
use tauri::AppHandle;
use tauri::Manager;

use crate::notifications_store::{self, NotificationItem};
use crate::resource_policy::NOTIFICATION_FIELD_MAX_CHARS;

#[derive(Debug, Clone, Serialize)]
pub struct NotificationsView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub items: Vec<NotificationItem>,
}

fn app_data(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn new_id() -> String {
    let mut buf = [0u8; 8];
    let _ = getrandom::fill(&mut buf);
    format!(
        "n_{}",
        buf.iter().map(|b| format!("{b:02x}")).collect::<String>()
    )
}

#[tauri::command]
pub fn notifications_list(app: AppHandle) -> Result<NotificationsView, String> {
    let data = app_data(&app)?;
    let inbox = notifications_store::load(&data)?;
    Ok(NotificationsView {
        ok: true,
        code: if inbox.items.is_empty() {
            "empty".into()
        } else {
            "ok".into()
        },
        message: if inbox.items.is_empty() {
            "Локальный inbox пуст — это не push с сервера".into()
        } else {
            format!("Локальных записей: {}", inbox.items.len())
        },
        items: inbox.items,
    })
}

#[tauri::command]
pub fn notifications_add(
    app: AppHandle,
    title: String,
    body: String,
) -> Result<NotificationsView, String> {
    if title.chars().count() > NOTIFICATION_FIELD_MAX_CHARS
        || body.chars().count() > NOTIFICATION_FIELD_MAX_CHARS
    {
        return Err(format!(
            "notification_too_large:max={NOTIFICATION_FIELD_MAX_CHARS}"
        ));
    }
    let data = app_data(&app)?;
    let mut inbox = notifications_store::load(&data)?;
    notifications_store::add_item(&mut inbox, new_id(), title, body, now_unix());
    notifications_store::persist(&data, &inbox)?;
    Ok(NotificationsView {
        ok: true,
        code: "added".into(),
        message: "Запись добавлена в локальный inbox".into(),
        items: inbox.items,
    })
}

#[tauri::command]
pub fn notifications_dismiss(app: AppHandle, id: String) -> Result<NotificationsView, String> {
    let data = app_data(&app)?;
    let mut inbox = notifications_store::load(&data)?;
    notifications_store::dismiss(&mut inbox, id.trim());
    notifications_store::persist(&data, &inbox)?;
    Ok(NotificationsView {
        ok: true,
        code: "dismissed".into(),
        message: "Запись удалена".into(),
        items: inbox.items,
    })
}
