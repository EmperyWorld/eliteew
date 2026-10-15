// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// EBrowser multi-tab registry — Rust-owned labels ebrowser-{id}, active tab SoT.
// Invariants:
// - SPA never supplies WebviewWindow labels (F-01).
// - Max 3 concurrent stages (F-13).
// - Document URL SoT is the live WebView (`stage.url()`), not a Rust cache.
// Related:
// - commands/ebrowser_stage.rs
// - documentation/product/desktop/DESKTOP-EBROWSER.md
// - documentation/reference/solution-readiness/2026-09-10-ebrowser-multi-tab-v0.md
// ---

use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};

pub const MAX_TABS: usize = 3;

static NEXT_ID: AtomicU64 = AtomicU64::new(1);
static TABS: Mutex<Vec<TabRecord>> = Mutex::new(Vec::new());
static ACTIVE: Mutex<Option<u64>> = Mutex::new(None);
/// Serializes create/activate/close/show so hide/show cannot race allocate.
static TAB_OPS: Mutex<()> = Mutex::new(());

pub fn lock_ops() -> Result<MutexGuard<'static, ()>, &'static str> {
    TAB_OPS.lock().map_err(|_| "ebrowser_tabs_lock")
}

#[derive(Debug, Clone)]
struct TabRecord {
    id: u64,
    label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TabView {
    pub id: u64,
    pub label: String,
    pub active: bool,
    /// Live href filled by stage command (empty here).
    pub href: String,
}

pub fn label_for(id: u64) -> String {
    format!("ebrowser-{id}")
}

pub fn list_meta() -> Vec<(u64, String, bool)> {
    let active = ACTIVE.lock().ok().and_then(|g| *g);
    TABS.lock()
        .map(|tabs| {
            tabs.iter()
                .map(|t| (t.id, t.label.clone(), Some(t.id) == active))
                .collect()
        })
        .unwrap_or_default()
}

pub fn active_id() -> Option<u64> {
    ACTIVE.lock().ok().and_then(|g| *g)
}

pub fn active_label() -> Option<String> {
    let id = active_id()?;
    Some(label_for(id))
}

pub fn all_labels() -> Vec<String> {
    TABS.lock()
        .map(|tabs| tabs.iter().map(|t| t.label.clone()).collect())
        .unwrap_or_default()
}

/// Allocate a new tab slot (does not create the window).
pub fn allocate() -> Result<(u64, String), &'static str> {
    let mut tabs = TABS.lock().map_err(|_| "ebrowser_tabs_lock")?;
    if tabs.len() >= MAX_TABS {
        return Err("ebrowser_tabs_busy");
    }
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    let label = label_for(id);
    tabs.push(TabRecord {
        id,
        label: label.clone(),
    });
    drop(tabs);
    if let Ok(mut a) = ACTIVE.lock() {
        *a = Some(id);
    }
    Ok((id, label))
}

pub fn set_active(id: u64) -> Result<(), &'static str> {
    let tabs = TABS.lock().map_err(|_| "ebrowser_tabs_lock")?;
    if !tabs.iter().any(|t| t.id == id) {
        return Err("ebrowser_tab_missing");
    }
    drop(tabs);
    if let Ok(mut a) = ACTIVE.lock() {
        *a = Some(id);
    }
    Ok(())
}

pub fn label_of(id: u64) -> Option<String> {
    TABS.lock()
        .ok()
        .and_then(|tabs| tabs.iter().find(|t| t.id == id).map(|t| t.label.clone()))
}

pub fn remove(id: u64) -> Option<String> {
    let label = {
        let mut tabs = TABS.lock().ok()?;
        let pos = tabs.iter().position(|t| t.id == id)?;
        let removed = tabs.remove(pos);
        removed.label
    };
    if let Ok(mut a) = ACTIVE.lock() {
        if *a == Some(id) {
            let neighbor = TABS.lock().ok().and_then(|tabs| tabs.last().map(|t| t.id));
            *a = neighbor;
        }
    }
    Some(label)
}

pub fn clear_all() {
    if let Ok(mut tabs) = TABS.lock() {
        tabs.clear();
    }
    if let Ok(mut a) = ACTIVE.lock() {
        *a = None;
    }
}

pub fn is_empty() -> bool {
    TABS.lock().map(|t| t.is_empty()).unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex as TestMutex;

    static TEST_GATE: TestMutex<()> = TestMutex::new(());

    #[test]
    fn allocate_respects_max_and_labels() {
        let _g = TEST_GATE.lock().unwrap();
        clear_all();
        NEXT_ID.store(1, Ordering::SeqCst);
        let mut ids = Vec::new();
        for _ in 0..MAX_TABS {
            let (id, label) = allocate().expect("slot");
            assert_eq!(label, label_for(id));
            ids.push(id);
        }
        assert_eq!(allocate().unwrap_err(), "ebrowser_tabs_busy");
        assert_eq!(list_meta().len(), MAX_TABS);
        for id in ids {
            let _ = remove(id);
        }
        clear_all();
    }

    #[test]
    fn set_active_rejects_unknown() {
        let _g = TEST_GATE.lock().unwrap();
        clear_all();
        NEXT_ID.store(50, Ordering::SeqCst);
        let (id, _) = allocate().unwrap();
        assert!(set_active(id).is_ok());
        assert_eq!(set_active(999_999).unwrap_err(), "ebrowser_tab_missing");
        let _ = remove(id);
        clear_all();
    }
}
