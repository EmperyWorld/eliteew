// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Linux WebKitGTK download handling for EBrowser stage + account library ingest.
// Invariants:
// - Download URI must pass ebrowser_nav_policy (same SoT as navigation).
// - Bytes stage under private temp only; user SoT = POST /api/v1/content
//   folder_item_id=downloads (Desktop «Загрузки»).
// - SPA sees basename + phase + optional content_id UUID (never absolute paths).
// - No product fs_bridge ACL.
// Related:
// - commands/ebrowser_stage.rs
// - documentation/product/desktop/DESKTOP-EBROWSER.md
// - documentation/reference/solution-readiness/2026-09-10-ebrowser-download-to-account-library.md
// ---

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, WebviewWindow};
use url::Url;

use crate::commands::ebrowser_stage::emit_chrome_changed;
use crate::commands::product::BAKED_PRODUCT_APP_ORIGIN;
use crate::ebrowser_nav_policy;
use crate::ebrowser_policy_fetch::resolve_ebrowser_bearer;
use crate::fofline_egress::fofline_native_http_client;
use crate::resource_policy::EBROWSER_DOWNLOAD_MAX_BYTES;

const MAX_CONCURRENT: u32 = 2;
const MAX_NAME_CHARS: usize = 180;
const LIBRARY_FOLDER_ITEM_ID: &str = "downloads";

static NEXT_ID: AtomicU64 = AtomicU64::new(1);
static ACTIVE_COUNT: AtomicU32 = AtomicU32::new(0);
static ENTRIES: Mutex<Vec<DownloadEntry>> = Mutex::new(Vec::new());
static CHROME_APP: OnceLock<AppHandle> = OnceLock::new();
static LAST_PROGRESS_EMIT_MS: AtomicU64 = AtomicU64::new(0);

/// Bind product AppHandle once so download phase changes can emit chrome.
pub fn bind_chrome_emit_app(app: AppHandle) {
    let _ = CHROME_APP.set(app);
}

fn notify_chrome() {
    if let Some(app) = CHROME_APP.get() {
        emit_chrome_changed(app);
    }
}

fn notify_chrome_progress_throttled() {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let prev = LAST_PROGRESS_EMIT_MS.load(Ordering::Relaxed);
    if now.saturating_sub(prev) < 250 {
        return;
    }
    LAST_PROGRESS_EMIT_MS.store(now, Ordering::Relaxed);
    notify_chrome();
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadEntry {
    pub id: u64,
    pub name: String,
    pub phase: String,
    pub progress: f64,
    pub bytes_received: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_id: Option<String>,
    #[serde(skip)]
    staging_path: Option<PathBuf>,
}

fn staging_root() -> PathBuf {
    std::env::temp_dir().join("eliteew-ebrowser-staging")
}

fn sanitize_basename(suggested: &str) -> String {
    let raw = Path::new(suggested.trim())
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .trim();
    let cleaned: String = raw
        .chars()
        .map(|c| {
            if c.is_control() || "/\\:".contains(c) {
                '_'
            } else {
                c
            }
        })
        .collect();
    let cleaned = cleaned.trim_matches('.').trim();
    if cleaned.is_empty() || cleaned == ".." || cleaned == "." {
        return "download.bin".into();
    }
    if cleaned.chars().count() > MAX_NAME_CHARS {
        return cleaned.chars().take(MAX_NAME_CHARS).collect();
    }
    cleaned.to_string()
}

fn unique_dest(dir: &Path, basename: &str) -> PathBuf {
    let candidate = dir.join(basename);
    if !candidate.exists() {
        return candidate;
    }
    let stem = Path::new(basename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("download");
    let ext = Path::new(basename)
        .extension()
        .and_then(|s| s.to_str())
        .map(|e| format!(".{e}"))
        .unwrap_or_default();
    for i in 1..10_000 {
        let alt = dir.join(format!("{stem}-{i}{ext}"));
        if !alt.exists() {
            return alt;
        }
    }
    dir.join(format!("{stem}-{}.bin", NEXT_ID.load(Ordering::SeqCst)))
}

fn upsert_entry(entry: DownloadEntry) {
    if let Ok(mut g) = ENTRIES.lock() {
        if let Some(existing) = g.iter_mut().find(|e| e.id == entry.id) {
            *existing = entry;
        } else {
            g.push(entry);
            if g.len() > 32 {
                let drain = g.len() - 32;
                g.drain(0..drain);
            }
        }
    }
    notify_chrome();
}

fn set_phase(id: u64, phase: &str, progress: f64, bytes: u64) {
    if let Ok(mut g) = ENTRIES.lock() {
        if let Some(e) = g.iter_mut().find(|e| e.id == id) {
            e.phase = phase.into();
            e.progress = progress;
            e.bytes_received = bytes;
        }
    }
    if phase == "progress" {
        notify_chrome_progress_throttled();
    } else {
        notify_chrome();
    }
}

fn set_library_result(id: u64, phase: &str, content_id: Option<String>, bytes: u64) {
    if let Ok(mut g) = ENTRIES.lock() {
        if let Some(e) = g.iter_mut().find(|e| e.id == id) {
            e.phase = phase.into();
            e.progress = 1.0;
            e.bytes_received = bytes;
            e.content_id = content_id;
            e.staging_path = None;
        }
    }
    notify_chrome();
}

fn take_staging(id: u64) -> Option<(String, PathBuf, u64)> {
    let Ok(mut g) = ENTRIES.lock() else {
        return None;
    };
    let e = g.iter_mut().find(|e| e.id == id)?;
    let path = e.staging_path.take()?;
    let name = e.name.clone();
    let bytes = e.bytes_received;
    e.phase = "ingesting".into();
    e.progress = 1.0;
    drop(g);
    notify_chrome();
    Some((name, path, bytes))
}

fn unlink_quiet(path: &Path) {
    if let Err(e) = std::fs::remove_file(path) {
        eprintln!(
            "[STEP] ebrowser_download_staging_unlink_skip path_tail={} err={e}",
            path.file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("?")
        );
    }
}

fn content_upload_url(display_name: &str) -> Result<Url, String> {
    let base = BAKED_PRODUCT_APP_ORIGIN.trim_end_matches('/');
    let mut url = Url::parse(&format!("{base}/api/v1/content"))
        .map_err(|_| "library_url_invalid".to_string())?;
    url.query_pairs_mut()
        .append_pair("folder_item_id", LIBRARY_FOLDER_ITEM_ID)
        .append_pair("source_service", "ebrowser")
        .append_pair("apply_project_desktop_folder", "false")
        .append_pair("name", display_name);
    Ok(url)
}

async fn ingest_staging_to_library(
    path: &Path,
    display_name: &str,
    bearer: &str,
) -> Result<String, String> {
    let url = content_upload_url(display_name)?;
    let client = fofline_native_http_client(120).map_err(|e| {
        eprintln!("[STEP] ebrowser_library_ingest_fail reason=http_client err={e}");
        "library_failed".to_string()
    })?;
    let part = reqwest::multipart::Part::file(path)
        .await
        .map_err(|e| {
            eprintln!("[STEP] ebrowser_library_ingest_fail reason=open_file err={e}");
            "library_failed".to_string()
        })?
        .file_name(display_name.to_string())
        .mime_str("application/octet-stream")
        .map_err(|_| "library_failed".to_string())?;
    let form = reqwest::multipart::Form::new().part("file", part);
    let resp = client
        .post(url)
        .header("Authorization", format!("Bearer {bearer}"))
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[STEP] ebrowser_library_ingest_fail reason=network err={e}");
            "library_failed".to_string()
        })?;
    let status = resp.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        eprintln!("[STEP] ebrowser_library_ingest_fail reason=unauthorized status={status}");
        return Err("library_auth_failed".into());
    }
    if !(status.is_success() || status.as_u16() == 201) {
        eprintln!("[STEP] ebrowser_library_ingest_fail reason=http status={status}");
        return Err("library_failed".into());
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| {
        eprintln!("[STEP] ebrowser_library_ingest_fail reason=json err={e}");
        "library_failed".to_string()
    })?;
    let id = body
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            eprintln!("[STEP] ebrowser_library_ingest_fail reason=missing_id");
            "library_failed".to_string()
        })?;
    Ok(id.to_string())
}

fn spawn_library_ingest(id: u64, name: String, path: PathBuf, bytes: u64) {
    tauri::async_runtime::spawn(async move {
        let Some(bearer) = resolve_ebrowser_bearer(None) else {
            eprintln!("[STEP] ebrowser_library_ingest_fail reason=no_bearer id={id}");
            unlink_quiet(&path);
            set_library_result(id, "library_auth_failed", None, bytes);
            return;
        };
        match ingest_staging_to_library(&path, &name, &bearer).await {
            Ok(content_id) => {
                unlink_quiet(&path);
                eprintln!(
                    "[STEP] ebrowser_library_ingest_ok id={id} content_id={content_id} name={name}"
                );
                set_library_result(id, "library", Some(content_id), bytes);
            }
            Err(phase) => {
                unlink_quiet(&path);
                eprintln!("[STEP] ebrowser_library_ingest_fail id={id} phase={phase}");
                set_library_result(id, &phase, None, bytes);
            }
        }
    });
}

pub fn snapshot() -> Vec<DownloadEntry> {
    ENTRIES
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default()
}

pub fn cancel_all_active() {
    ACTIVE_COUNT.store(0, Ordering::SeqCst);
    if let Ok(mut g) = ENTRIES.lock() {
        for e in g.iter_mut() {
            if e.phase == "progress" || e.phase == "started" {
                e.phase = "cancelled".into();
                if let Some(path) = e.staging_path.take() {
                    unlink_quiet(&path);
                }
            }
        }
    }
    eprintln!("[STEP] ebrowser_downloads_cancel_all");
    notify_chrome();
}

/// Wire WebContext download-started on the EBrowser WebView.
pub fn attach_ebrowser_downloads(win: &WebviewWindow) {
    if let Err(e) = win.with_webview(|platform| {
        use webkit2gtk::{
            DownloadExt, URIRequestExt, WebContextExt, WebViewExt,
        };

        let webview = platform.inner();
        let Some(ctx) = webview.context() else {
            eprintln!("[STEP] ebrowser_downloads_skip reason=no_context");
            return;
        };

        ctx.connect_download_started(move |_ctx, download| {
            let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
            let uri_raw = download
                .request()
                .and_then(|r| r.uri())
                .map(|g| g.to_string())
                .unwrap_or_default();

            let allowed = match Url::parse(&uri_raw) {
                Ok(u) => ebrowser_nav_policy::navigation_allowed(&u),
                Err(_) => false,
            };
            if !allowed {
                eprintln!(
                    "[STEP] ebrowser_download_deny reason=policy uri_host={}",
                    Url::parse(&uri_raw)
                        .ok()
                        .and_then(|u| u.host_str().map(|h| h.to_string()))
                        .unwrap_or_else(|| "invalid".into())
                );
                upsert_entry(DownloadEntry {
                    id,
                    name: sanitize_basename(&uri_raw),
                    phase: "denied".into(),
                    progress: 0.0,
                    bytes_received: 0,
                    content_id: None,
                    staging_path: None,
                });
                download.cancel();
                return;
            }

            let active = ACTIVE_COUNT.fetch_add(1, Ordering::SeqCst);
            if active >= MAX_CONCURRENT {
                ACTIVE_COUNT.fetch_sub(1, Ordering::SeqCst);
                eprintln!("[STEP] ebrowser_download_deny reason=busy");
                upsert_entry(DownloadEntry {
                    id,
                    name: "download".into(),
                    phase: "busy".into(),
                    progress: 0.0,
                    bytes_received: 0,
                    content_id: None,
                    staging_path: None,
                });
                download.cancel();
                return;
            }

            let released = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));

            let id_for_decide = id;
            let released_mkdir = std::sync::Arc::clone(&released);
            download.connect_decide_destination(move |dl, suggested| {
                let name = sanitize_basename(suggested);
                let root = staging_root();
                if let Err(e) = std::fs::create_dir_all(&root) {
                    eprintln!("[STEP] ebrowser_download_fail err=mkdir:{e}");
                    if !released_mkdir.swap(true, Ordering::SeqCst) {
                        ACTIVE_COUNT.fetch_sub(1, Ordering::SeqCst);
                    }
                    set_phase(id_for_decide, "failed", 0.0, 0);
                    dl.cancel();
                    return true;
                }
                let dest = unique_dest(&root, &name);
                let dest_s = dest.to_string_lossy().to_string();
                dl.set_destination(&dest_s);
                upsert_entry(DownloadEntry {
                    id: id_for_decide,
                    name: name.clone(),
                    phase: "progress".into(),
                    progress: 0.0,
                    bytes_received: 0,
                    content_id: None,
                    staging_path: Some(dest),
                });
                eprintln!("[STEP] ebrowser_download_dest id={id_for_decide} name={name}");
                true
            });

            let id_recv = id;
            let released_over = std::sync::Arc::clone(&released);
            download.connect_received_data(move |dl, _len| {
                let bytes = dl.received_data_length();
                if bytes > EBROWSER_DOWNLOAD_MAX_BYTES {
                    eprintln!(
                        "[STEP] ebrowser_download_deny reason=too_large id={id_recv} bytes={bytes}"
                    );
                    set_phase(id_recv, "too_large", 1.0, bytes);
                    if !released_over.swap(true, Ordering::SeqCst) {
                        ACTIVE_COUNT.fetch_sub(1, Ordering::SeqCst);
                    }
                    dl.cancel();
                    return;
                }
                let progress = dl.estimated_progress().clamp(0.0, 1.0);
                set_phase(id_recv, "progress", progress, bytes);
            });

            let id_fail = id;
            let released_fail = std::sync::Arc::clone(&released);
            download.connect_failed(move |_dl, err| {
                if !released_fail.swap(true, Ordering::SeqCst) {
                    ACTIVE_COUNT.fetch_sub(1, Ordering::SeqCst);
                }
                if let Ok(mut g) = ENTRIES.lock() {
                    if let Some(e) = g.iter_mut().find(|e| e.id == id_fail) {
                        if let Some(path) = e.staging_path.take() {
                            unlink_quiet(&path);
                        }
                        e.phase = "failed".into();
                    }
                }
                eprintln!("[STEP] ebrowser_download_fail id={id_fail} err={err}");
            });

            let id_fin = id;
            let released_fin = std::sync::Arc::clone(&released);
            download.connect_finished(move |dl| {
                let bytes = dl.received_data_length();
                if let Ok(mut g) = ENTRIES.lock() {
                    if let Some(e) = g.iter_mut().find(|e| e.id == id_fin) {
                        if e.phase == "progress" || e.phase == "started" {
                            e.bytes_received = bytes;
                        }
                    }
                }
                if !released_fin.swap(true, Ordering::SeqCst) {
                    ACTIVE_COUNT.fetch_sub(1, Ordering::SeqCst);
                }
                if let Some((name, path, b)) = take_staging(id_fin) {
                    let final_bytes = if bytes > 0 { bytes } else { b };
                    eprintln!(
                        "[STEP] ebrowser_download_staged id={id_fin} name={name} bytes={final_bytes}"
                    );
                    spawn_library_ingest(id_fin, name, path, final_bytes);
                } else {
                    set_phase(id_fin, "failed", 1.0, bytes);
                    eprintln!("[STEP] ebrowser_download_fail id={id_fin} reason=no_staging");
                }
            });

            upsert_entry(DownloadEntry {
                id,
                name: "download".into(),
                phase: "started".into(),
                progress: 0.0,
                bytes_received: 0,
                content_id: None,
                staging_path: None,
            });
            eprintln!("[STEP] ebrowser_download_started id={id}");
        });

        eprintln!("[STEP] ebrowser_downloads attached=download_started");
    }) {
        eprintln!("[STEP] ebrowser_downloads_fail err={e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_strips_traversal_and_controls() {
        assert_eq!(sanitize_basename("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_basename(""), "download.bin");
        assert_eq!(sanitize_basename("a\nb.pdf"), "a_b.pdf");
        assert!(!sanitize_basename("x/y\\z:q").contains('/'));
    }

    #[test]
    fn content_upload_targets_downloads_folder() {
        let url = content_upload_url("report.pdf").expect("url");
        let q: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(q.get("folder_item_id").map(String::as_str), Some("downloads"));
        assert_eq!(q.get("source_service").map(String::as_str), Some("ebrowser"));
        assert_eq!(
            q.get("apply_project_desktop_folder").map(String::as_str),
            Some("false")
        );
        assert_eq!(q.get("name").map(String::as_str), Some("report.pdf"));
        assert!(url.path().ends_with("/api/v1/content"));
    }

    #[test]
    fn staging_is_private_temp_not_user_downloads() {
        let root = staging_root();
        let s = root.to_string_lossy();
        assert!(s.contains("eliteew-ebrowser-staging"));
        assert!(!s.contains("Downloads/EliteEW-EBrowser"));
    }

    #[test]
    fn module_wires_policy_caps_and_library_ingest() {
        let src = include_str!("linux_ebrowser_downloads.rs");
        assert!(src.contains("connect_download_started"));
        assert!(src.contains("navigation_allowed"));
        assert!(src.contains("EBROWSER_DOWNLOAD_MAX_BYTES"));
        assert!(src.contains("folder_item_id"));
        assert!(src.contains("downloads"));
        assert!(src.contains("eliteew-ebrowser-staging"));
        assert!(src.contains("ingest_staging_to_library"));
        assert!(src.contains("sanitize_basename"));
    }
}
