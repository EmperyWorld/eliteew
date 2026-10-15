// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Local notifications inbox for O5 NotificationsApp (no push/SSO).
// Invariants:
// - Device-local JSON only; never claims cloud delivery.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// ---

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const REL: &str = "notifications/inbox_v1.json";
const MAX_ENTRIES: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationItem {
    pub id: String,
    pub title: String,
    pub body: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NotificationsInbox {
    pub items: Vec<NotificationItem>,
}

pub fn store_path(app_data: &Path) -> PathBuf {
    app_data.join(REL)
}

pub fn load(app_data: &Path) -> Result<NotificationsInbox, String> {
    let path = store_path(app_data);
    if !path.is_file() {
        return Ok(NotificationsInbox::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("read_inbox: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parse_inbox: {e}"))
}

pub fn persist(app_data: &Path, inbox: &NotificationsInbox) -> Result<(), String> {
    let path = store_path(app_data);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("inbox_dir: {e}"))?;
    }
    let json = serde_json::to_string_pretty(inbox).map_err(|e| e.to_string())?;
    let mut f = fs::File::create(&path).map_err(|e| format!("create_inbox: {e}"))?;
    f.write_all(json.as_bytes())
        .map_err(|e| format!("write_inbox: {e}"))?;
    Ok(())
}

pub fn add_item(
    inbox: &mut NotificationsInbox,
    id: String,
    title: String,
    body: String,
    created_at: i64,
) {
    let title = title.trim().to_string();
    let body = body.trim().to_string();
    if title.is_empty() && body.is_empty() {
        return;
    }
    inbox.items.insert(
        0,
        NotificationItem {
            id,
            title: if title.is_empty() {
                "Заметка".into()
            } else {
                title
            },
            body,
            created_at,
        },
    );
    if inbox.items.len() > MAX_ENTRIES {
        inbox.items.truncate(MAX_ENTRIES);
    }
}

pub fn dismiss(inbox: &mut NotificationsInbox, id: &str) {
    inbox.items.retain(|i| i.id != id);
}

/// Local factory-reset (W5b): clear notifications inbox file. Idempotent when absent.
pub fn clear(app_data: &Path) -> Result<(), String> {
    let path = store_path(app_data);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("clear_notifications: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_and_dismiss() {
        let mut inbox = NotificationsInbox::default();
        add_item(&mut inbox, "1".into(), "Hi".into(), "body".into(), 1);
        assert_eq!(inbox.items.len(), 1);
        dismiss(&mut inbox, "1");
        assert!(inbox.items.is_empty());
    }
}
