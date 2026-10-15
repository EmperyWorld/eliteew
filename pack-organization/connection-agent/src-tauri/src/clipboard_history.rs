// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Local clipboard history persistence for O5 ClipboardManager panel.
// Invariants:
// - Cap history length; never sync to cloud from this store.
// - FoFline bundle uses a separate history file (edition isolation).
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md
// ---

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const REL: &str = "clipboard/history_v1.json";
const REL_FOFLINE: &str = "clipboard/history_fofline_v1.json";
const MAX_ENTRIES: usize = 40;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardEntry {
    pub text: String,
    pub saved_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClipboardHistory {
    pub entries: Vec<ClipboardEntry>,
}

pub fn store_path_for(app_data: &Path, fofline: bool) -> PathBuf {
    app_data.join(if fofline { REL_FOFLINE } else { REL })
}

pub fn load_for(app_data: &Path, fofline: bool) -> Result<ClipboardHistory, String> {
    let path = store_path_for(app_data, fofline);
    if !path.is_file() {
        return Ok(ClipboardHistory::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("read_clipboard: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parse_clipboard: {e}"))
}

pub fn persist_for(
    app_data: &Path,
    history: &ClipboardHistory,
    fofline: bool,
) -> Result<(), String> {
    let path = store_path_for(app_data, fofline);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("clipboard_dir: {e}"))?;
    }
    let json = serde_json::to_string_pretty(history).map_err(|e| e.to_string())?;
    let mut f = fs::File::create(&path).map_err(|e| format!("create_clipboard: {e}"))?;
    f.write_all(json.as_bytes())
        .map_err(|e| format!("write_clipboard: {e}"))?;
    Ok(())
}

pub fn push_entry(history: &mut ClipboardHistory, text: String, saved_at: i64) {
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return;
    }
    history.entries.retain(|e| e.text != trimmed);
    history.entries.insert(
        0,
        ClipboardEntry {
            text: trimmed,
            saved_at,
        },
    );
    if history.entries.len() > MAX_ENTRIES {
        history.entries.truncate(MAX_ENTRIES);
    }
}

fn remove_file_idempotent(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("clear_clipboard: {e}")),
    }
}

/// Local factory-reset (W5b): clear Connected + FoFline clipboard history files.
pub fn clear_all(app_data: &Path) -> Result<(), String> {
    remove_file_idempotent(&store_path_for(app_data, false))?;
    remove_file_idempotent(&store_path_for(app_data, true))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_dedupes_and_caps() {
        let mut h = ClipboardHistory::default();
        push_entry(&mut h, "a".into(), 1);
        push_entry(&mut h, "b".into(), 2);
        push_entry(&mut h, "a".into(), 3);
        assert_eq!(h.entries.len(), 2);
        assert_eq!(h.entries[0].text, "a");
    }

    #[test]
    fn fofline_store_path_is_isolated() {
        let base = Path::new("/tmp/eliteew-app-data");
        assert_eq!(
            store_path_for(base, false),
            base.join("clipboard/history_v1.json")
        );
        assert_eq!(
            store_path_for(base, true),
            base.join("clipboard/history_fofline_v1.json")
        );
    }
}
