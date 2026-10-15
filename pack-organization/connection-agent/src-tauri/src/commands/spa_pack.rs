// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Tauri commands: FoFline SPA pack status/sync (L2) + L4 check + A2 optional
// asset-group background sync (disk spool, hash skip).
// Invariants:
// - allow_fofline=false → denied (no sync).
// - Empty/invalid signature → fail-closed; keep previous ready pack.
// - Idempotent when local app_build_id matches spa-latest.
// - Core ready never waits on optional groups; groups use disk spool (no multi-GiB Vec).
// - L5: native HTTP uses W-transport SOCKS fail-closed when gate is on.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md L2 / L4 / L5 / §17.4
// - crate::spa_pack / crate::spa_assets / crate::fofline_egress
// ---

use crate::artifact_stream;
use crate::client_defaults;
use crate::fofline_egress::fofline_native_http_client;
use crate::resource_policy::CORE_PACK_ARCHIVE_MAX_BYTES;
use crate::spa_assets::{self, MAX_GROUP_BYTES};
use crate::spa_pack::{
    self, SpaPackRuntime, SpaPackStatusView, STATE_DOWNLOADING, STATE_ERROR, STATE_READY,
};
use futures_util::StreamExt;
use memmap2::Mmap;
use std::fs::File;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct SpaPackGate(pub Mutex<SpaPackRuntime>);

fn app_data(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

fn empty_group_fields() -> (u32, u32, bool, Option<String>) {
    (0, 0, false, None)
}

fn view_ready(
    message: String,
    app_build_id: String,
    remote: Option<String>,
    install_path: String,
) -> SpaPackStatusView {
    SpaPackStatusView {
        ok: true,
        state: STATE_READY.into(),
        code: "ready".into(),
        message,
        app_build_id: Some(app_build_id),
        remote_app_build_id: remote,
        update_available: false,
        progress_bytes: None,
        progress_total: None,
        install_path: Some(install_path),
        groups_ready: 0,
        groups_total: 0,
        groups_syncing: false,
        active_group_id: None,
    }
}

#[tauri::command]
pub fn fofline_spa_pack_status(
    app: AppHandle,
    gate: State<'_, SpaPackGate>,
    allow_fofline: bool,
) -> Result<SpaPackStatusView, String> {
    if !allow_fofline {
        return Ok(SpaPackStatusView::denied());
    }
    let data = app_data(&app)?;
    refresh_group_counts_from_disk(&data, &gate)?;
    let runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
    Ok(spa_pack::status_from_disk(&data, &runtime))
}

/// L4: fetch spa-latest only; compare to local ready pack. No download.
#[tauri::command]
pub async fn fofline_spa_pack_check_update(
    app: AppHandle,
    gate: State<'_, SpaPackGate>,
    allow_fofline: bool,
) -> Result<SpaPackStatusView, String> {
    if !allow_fofline {
        return Ok(SpaPackStatusView::denied());
    }
    let data = app_data(&app)?;
    {
        let runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
        if runtime.downloading {
            return Ok(spa_pack::status_from_disk(&data, &runtime));
        }
    }
    let local = {
        let runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
        spa_pack::status_from_disk(&data, &runtime)
    };
    if local.state != STATE_READY {
        return Ok(local);
    }
    let local_id = match local.app_build_id.clone() {
        Some(id) if !id.is_empty() => id,
        _ => return Ok(local),
    };

    match fetch_spa_latest_manifest(&app).await {
        Ok(manifest) => {
            let remote = manifest.app_build_id;
            let update = remote != local_id;
            eprintln!(
                "[STEP] fofline_spa_pack check_update local={local_id} remote={remote} update={update}"
            );
            let view = local.with_remote_compare(Some(remote), update);
            if let Ok(mut runtime) = gate.0.lock() {
                runtime.last_view = Some(view.clone());
            }
            Ok(view)
        }
        Err(err) => {
            eprintln!("[STEP] fofline_spa_pack check_update_skip {err}");
            let mut view = local;
            view.code = if err.starts_with("offline_skip") {
                "update_check_offline".into()
            } else {
                "update_check_failed".into()
            };
            view.message = format!(
                "FoFline workspace ready ({local_id}); update check unavailable"
            );
            view.update_available = false;
            view.remote_app_build_id = None;
            Ok(view)
        }
    }
}

#[tauri::command]
pub async fn fofline_spa_pack_sync(
    app: AppHandle,
    gate: State<'_, SpaPackGate>,
    allow_fofline: bool,
) -> Result<SpaPackStatusView, String> {
    if !allow_fofline {
        return Ok(SpaPackStatusView::denied());
    }
    let data = app_data(&app)?;

    {
        let mut runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
        if runtime.downloading {
            return Ok(spa_pack::status_from_disk(&data, &runtime));
        }
        runtime.downloading = true;
        runtime.progress_bytes = 0;
        runtime.progress_total = None;
        let (gr, gt, gs, ag) = empty_group_fields();
        runtime.last_view = Some(SpaPackStatusView {
            ok: true,
            state: STATE_DOWNLOADING.into(),
            code: "downloading".into(),
            message: "Downloading FoFline workspace pack".into(),
            app_build_id: spa_pack::load_local_state(&data).app_build_id,
            remote_app_build_id: None,
            update_available: false,
            progress_bytes: Some(0),
            progress_total: None,
            install_path: None,
            groups_ready: gr,
            groups_total: gt,
            groups_syncing: gs,
            active_group_id: ag,
        });
    }

    let result = sync_inner(&app, &gate, &data).await;

    {
        let mut runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
        runtime.downloading = false;
        runtime.progress_bytes = 0;
        runtime.progress_total = None;
        match &result {
            Ok(view) => runtime.last_view = Some(view.clone()),
            Err(msg) => {
                let keep_id = spa_pack::load_local_state(&data).app_build_id;
                let _ = spa_pack::write_error_state(&data, "sync_failed", msg, keep_id.clone());
                let view = SpaPackStatusView {
                    ok: false,
                    state: STATE_ERROR.into(),
                    code: "sync_failed".into(),
                    message: msg.clone(),
                    app_build_id: keep_id,
                    remote_app_build_id: None,
                    update_available: false,
                    progress_bytes: None,
                    progress_total: None,
                    install_path: if spa_pack::is_ready_install(&data, None) {
                        Some(spa_pack::current_dir(&data).display().to_string())
                    } else {
                        None
                    },
                    groups_ready: runtime.groups_ready,
                    groups_total: runtime.groups_total,
                    groups_syncing: runtime.groups_syncing,
                    active_group_id: runtime.active_group_id.clone(),
                };
                runtime.last_view = Some(view.clone());
                return Ok(view);
            }
        }
    }

    if let Ok(ref view) = result {
        if view.state == STATE_READY {
            schedule_assets_sync(app.clone());
        }
    }

    result
}

/// Start (or no-op) background optional asset-group sync after core is ready.
#[tauri::command]
pub async fn fofline_spa_assets_sync(
    app: AppHandle,
    gate: State<'_, SpaPackGate>,
    allow_fofline: bool,
) -> Result<SpaPackStatusView, String> {
    if !allow_fofline {
        return Ok(SpaPackStatusView::denied());
    }
    let data = app_data(&app)?;
    {
        let runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
        let view = spa_pack::status_from_disk(&data, &runtime);
        if view.state != STATE_READY {
            return Ok(view);
        }
        if runtime.groups_syncing {
            return Ok(view);
        }
    }
    schedule_assets_sync(app.clone());
    let runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
    Ok(spa_pack::status_from_disk(&data, &runtime))
}

#[tauri::command]
pub fn fofline_spa_assets_cancel(
    gate: State<'_, SpaPackGate>,
    allow_fofline: bool,
) -> Result<bool, String> {
    if !allow_fofline {
        return Ok(false);
    }
    let mut runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
    if runtime.groups_syncing {
        runtime.cancel_groups = true;
        eprintln!("[STEP] fofline_spa_assets cancel_requested");
        return Ok(true);
    }
    Ok(false)
}

fn schedule_assets_sync(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_assets_sync(app).await {
            eprintln!("[STEP] fofline_spa_assets sync_skip {e}");
        }
    });
}

fn refresh_group_counts_from_disk(
    data: &std::path::Path,
    gate: &State<'_, SpaPackGate>,
) -> Result<(), String> {
    let state = spa_assets::load_assets_state(data);
    let ids: Vec<String> = state.groups.keys().cloned().collect();
    let (ready, total) = if ids.is_empty() {
        (0, gate.0.lock().map(|r| r.groups_total).unwrap_or(0))
    } else {
        let (r, _) = spa_assets::count_ready_groups(&state, &ids);
        let total = gate
            .0
            .lock()
            .map(|rt| {
                if rt.groups_total > 0 {
                    rt.groups_total
                } else {
                    ids.len() as u32
                }
            })
            .unwrap_or(ids.len() as u32);
        (r, total)
    };
    if let Ok(mut runtime) = gate.0.lock() {
        if !runtime.groups_syncing {
            runtime.groups_ready = ready;
            if runtime.groups_total == 0 {
                runtime.groups_total = total;
            }
        }
    }
    Ok(())
}

async fn run_assets_sync(app: AppHandle) -> Result<(), String> {
    let gate = app.state::<SpaPackGate>();
    let data = app_data(&app)?;
    {
        let mut runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
        if runtime.groups_syncing || runtime.downloading {
            return Ok(());
        }
        if !spa_pack::is_ready_install(&data, None) {
            return Ok(());
        }
        runtime.groups_syncing = true;
        runtime.cancel_groups = false;
        runtime.active_group_id = None;
    }

    let outcome = assets_sync_inner(&app, &gate, &data).await;

    {
        let mut runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
        runtime.groups_syncing = false;
        runtime.active_group_id = None;
        runtime.cancel_groups = false;
        if let Ok((ready, total)) = &outcome {
            runtime.groups_ready = *ready;
            runtime.groups_total = *total;
        }
    }

    match outcome {
        Ok((ready, total)) => {
            eprintln!("[STEP] fofline_spa_assets sync_done ready={ready}/{total}");
            let _ = app.emit(
                "fofline-spa-assets-progress",
                serde_json::json!({
                    "phase": "done",
                    "groups_ready": ready,
                    "groups_total": total,
                }),
            );
            Ok(())
        }
        Err(e) => {
            let _ = app.emit(
                "fofline-spa-assets-progress",
                serde_json::json!({ "phase": "error", "message": e }),
            );
            Err(e)
        }
    }
}

async fn assets_sync_inner(
    app: &AppHandle,
    gate: &State<'_, SpaPackGate>,
    data: &std::path::Path,
) -> Result<(u32, u32), String> {
    let local_core = spa_pack::load_local_state(data)
        .app_build_id
        .filter(|id| spa_pack::is_ready_install(data, Some(id)))
        .ok_or_else(|| "core_not_ready".to_string())?;

    let pubkey = client_defaults::resolve_updater_pubkey(app)
        .ok_or_else(|| "updater pubkey missing — cannot verify asset groups".to_string())?;

    let assets = fetch_spa_assets_latest(app).await?;
    if assets.app_build_id != local_core {
        eprintln!(
            "[STEP] fofline_spa_assets skip_build_mismatch core={local_core} assets={}",
            assets.app_build_id
        );
        return Err(format!(
            "assets_build_mismatch:core={local_core}:assets={}",
            assets.app_build_id
        ));
    }

    let catalog_ids: Vec<String> = assets.groups.iter().map(|g| g.id.clone()).collect();
    let total = catalog_ids.len() as u32;
    {
        let mut runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
        runtime.groups_total = total;
        let state = spa_assets::load_assets_state(data);
        let (ready, _) = spa_assets::count_ready_groups(&state, &catalog_ids);
        runtime.groups_ready = ready;
    }

    let client = fofline_native_http_client(600).map_err(|e| {
        if e.starts_with("w_transport_proxy_required") {
            e
        } else {
            classify_net(&e)
        }
    })?;

    let mut assets_state = spa_assets::load_assets_state(data);
    assets_state.schema_version = 1;
    assets_state.app_build_id = Some(local_core.clone());

    for group in &assets.groups {
        if gate
            .0
            .lock()
            .map(|r| r.cancel_groups)
            .unwrap_or(false)
        {
            eprintln!("[STEP] fofline_spa_assets cancelled");
            break;
        }

        {
            let mut runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
            runtime.active_group_id = Some(group.id.clone());
        }
        let _ = app.emit(
            "fofline-spa-assets-progress",
            serde_json::json!({
                "phase": "group",
                "group_id": group.id,
                "groups_ready": gate.0.lock().map(|r| r.groups_ready).unwrap_or(0),
                "groups_total": total,
            }),
        );

        if spa_assets::group_skip_download(data, &group.id, &group.sha256, &assets_state) {
            eprintln!(
                "[STEP] fofline_spa_assets hash_skip group={}",
                group.id
            );
            assets_state.groups.insert(
                group.id.clone(),
                spa_assets::GroupLocalRecord {
                    archive_sha256: group.sha256.clone(),
                    ready: true,
                },
            );
            let (ready, _) = spa_assets::count_ready_groups(&assets_state, &catalog_ids);
            if let Ok(mut runtime) = gate.0.lock() {
                runtime.groups_ready = ready;
            }
            continue;
        }

        eprintln!(
            "[STEP] fofline_spa_assets download group={} url={}",
            group.id, group.url
        );
        if let Err(e) = download_and_install_group(
            app,
            gate,
            data,
            &client,
            group,
            &pubkey,
            &mut assets_state,
            &catalog_ids,
        )
        .await
        {
            eprintln!(
                "[STEP] fofline_spa_assets group_fail group={} err={e}",
                group.id
            );
            // Continue other groups; Start remains ready.
            continue;
        }
    }

    let _ = spa_assets::save_assets_state(data, &assets_state);
    let (ready, _) = spa_assets::count_ready_groups(&assets_state, &catalog_ids);
    Ok((ready, total))
}

async fn download_and_install_group(
    app: &AppHandle,
    gate: &State<'_, SpaPackGate>,
    data: &std::path::Path,
    client: &reqwest::Client,
    group: &spa_assets::SpaAssetsGroupEntry,
    pubkey: &str,
    assets_state: &mut spa_assets::AssetsLocalState,
    catalog_ids: &[String],
) -> Result<(), String> {
    let mut spool =
        crate::update_spool::GroupSpool::open(data, &group.id, &group.sha256, &group.signature)?;
    if let Err(e) = download_to_spool(app, gate, client, &group.url, &mut spool.file).await {
        // Network failures retain this content-bound partial for HTTP Range resume.
        if e == "cancelled" || e == "pack_too_large" {
            let _ = spool.discard();
        }
        return Err(e);
    }
    if let Err(e) =
        spa_assets::verify_group_archive(&spool.path, &group.sha256, &group.signature, pubkey)
    {
        let _ = spool.discard();
        return Err(e);
    }
    let staging = spa_assets::group_staging_dir(data, &group.id)?;
    let extracted = spa_assets::extract_group_tar_zst_file(&spool.path, &staging);
    spool.discard()?;
    extracted?;
    spa_assets::merge_group_into_current(&staging, &spa_pack::current_dir(data))?;

    let files_raw = std::fs::read_to_string(staging.join("files.json"))
        .map_err(|e| format!("read group files.json: {e}"))?;
    let files = spa_assets::parse_files_manifest(&files_raw)?;
    if !spa_assets::local_files_complete(&spa_pack::current_dir(data), &files) {
        return Err("group_files_incomplete_after_merge".into());
    }

    spa_assets::persist_group_meta(data, &group.id, &staging, &group.sha256)?;
    assets_state.groups.insert(
        group.id.clone(),
        spa_assets::GroupLocalRecord {
            archive_sha256: group.sha256.clone(),
            ready: true,
        },
    );
    let (ready, _) = spa_assets::count_ready_groups(assets_state, catalog_ids);
    if let Ok(mut runtime) = gate.0.lock() {
        runtime.groups_ready = ready;
    }

    let _ = std::fs::remove_dir_all(&staging);
    eprintln!("[STEP] fofline_spa_assets group_ready id={}", group.id);
    Ok(())
}

async fn download_to_spool(
    app: &AppHandle,
    gate: &State<'_, SpaPackGate>,
    client: &reqwest::Client,
    url: &str,
    file: &mut File,
) -> Result<(), String> {
    use std::io::{Seek, SeekFrom, Write};
    let start = file.metadata().map_err(|e| e.to_string())?.len();
    if start > MAX_GROUP_BYTES {
        return Err("pack_too_large".into());
    }
    file.seek(SeekFrom::End(0)).map_err(|e| e.to_string())?;
    let mut req = client.get(url);
    if start > 0 {
        req = req.header(reqwest::header::RANGE, format!("bytes={start}-"));
    }
    let resp = req.send().await.map_err(|e| classify_net(&e.to_string()))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("group HTTP {status}"));
    }
    let mut written = start;
    if start > 0 && status.as_u16() == 200 {
        file.set_len(0).map_err(|e| e.to_string())?;
        file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
        written = 0;
    }
    let total_hint = resp.content_length().map(|n| written.saturating_add(n));
    if let Some(t) = total_hint {
        if t > MAX_GROUP_BYTES {
            return Err("pack_too_large".into());
        }
    }
    {
        let mut runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
        runtime.progress_bytes = written;
        runtime.progress_total = total_hint;
    }
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if gate.0.lock().map(|r| r.cancel_groups).unwrap_or(false) {
            return Err("cancelled".into());
        }
        let chunk = chunk.map_err(|e| classify_net(&e.to_string()))?;
        written = written.saturating_add(chunk.len() as u64);
        if written > MAX_GROUP_BYTES {
            return Err("pack_too_large".into());
        }
        file.write_all(&chunk)
            .map_err(|e| format!("spool write: {e}"))?;
        {
            let mut runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
            runtime.progress_bytes = written;
            runtime.progress_total = total_hint;
        }
        let _ = app.emit(
            "fofline-spa-assets-progress",
            serde_json::json!({
                "phase": "download",
                "bytes": written,
                "total": total_hint,
            }),
        );
    }
    Ok(())
}

async fn fetch_spa_latest_manifest(
    app: &AppHandle,
) -> Result<spa_pack::SpaLatestManifest, String> {
    let latest_url = client_defaults::resolve_spa_latest_json_url(app);
    let client = fofline_native_http_client(30).map_err(|e| {
        if e.starts_with("w_transport_proxy_required") {
            e
        } else {
            classify_net(&e)
        }
    })?;
    eprintln!("[STEP] fofline_spa_pack fetch_manifest_check url={latest_url}");
    let manifest_resp = client
        .get(&latest_url)
        .send()
        .await
        .map_err(|e| classify_net(&e.to_string()))?;
    if !manifest_resp.status().is_success() {
        return Err(format!(
            "spa-latest.json HTTP {} — workspace channel unavailable",
            manifest_resp.status()
        ));
    }
    let manifest_raw = manifest_resp
        .text()
        .await
        .map_err(|e| format!("spa-latest body: {e}"))?;
    spa_pack::parse_spa_latest(&manifest_raw).map_err(|e| {
        if e.contains("signature") {
            "signature_required".to_string()
        } else {
            e
        }
    })
}

async fn fetch_spa_assets_latest(
    app: &AppHandle,
) -> Result<spa_assets::SpaAssetsLatestManifest, String> {
    let url = client_defaults::resolve_spa_assets_latest_json_url(app);
    let client = fofline_native_http_client(30).map_err(|e| {
        if e.starts_with("w_transport_proxy_required") {
            e
        } else {
            classify_net(&e)
        }
    })?;
    eprintln!("[STEP] fofline_spa_assets fetch_channel url={url}");
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| classify_net(&e.to_string()))?;
    if !resp.status().is_success() {
        return Err(format!(
            "spa-assets-latest.json HTTP {} — asset channel unavailable",
            resp.status()
        ));
    }
    let raw = resp
        .text()
        .await
        .map_err(|e| format!("spa-assets body: {e}"))?;
    spa_assets::parse_spa_assets_latest(&raw).map_err(|e| {
        if e.contains("signature") {
            "signature_required".to_string()
        } else {
            e
        }
    })
}

async fn sync_inner(
    app: &AppHandle,
    gate: &State<'_, SpaPackGate>,
    data: &std::path::Path,
) -> Result<SpaPackStatusView, String> {
    let previous_ready_id = spa_pack::load_local_state(data)
        .app_build_id
        .filter(|id| spa_pack::is_ready_install(data, Some(id)));

    let pubkey = client_defaults::resolve_updater_pubkey(app)
        .ok_or_else(|| "updater pubkey missing — cannot verify SPA pack".to_string())?;

    let manifest = fetch_spa_latest_manifest(app).await?;

    if let Some(ref prev) = previous_ready_id {
        if prev == &manifest.app_build_id {
            eprintln!(
                "[STEP] fofline_spa_pack idempotent ready app_build_id={}",
                manifest.app_build_id
            );
            let _ = spa_pack::write_ready_state(data, &manifest.app_build_id);
            return Ok(view_ready(
                format!("FoFline workspace already current ({})", manifest.app_build_id),
                manifest.app_build_id.clone(),
                Some(manifest.app_build_id.clone()),
                spa_pack::current_dir(data).display().to_string(),
            ));
        }
    }

    let download_url = manifest.url.clone();
    eprintln!(
        "[STEP] fofline_spa_pack download app_build_id={} url={download_url}",
        manifest.app_build_id
    );

    let client = fofline_native_http_client(600).map_err(|e| {
        if e.starts_with("w_transport_proxy_required") {
            e
        } else {
            classify_net(&e)
        }
    })?;

    let resp = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| classify_net(&e.to_string()))?;
    if !resp.status().is_success() {
        return Err(format!("pack HTTP {}", resp.status()));
    }
    let total = resp.content_length();
    {
        let mut runtime = gate.0.lock().map_err(|e| format!("spa_pack lock: {e}"))?;
        runtime.progress_total = total;
        runtime.progress_bytes = 0;
    }
    let _ = app.emit(
        "fofline-spa-pack-progress",
        serde_json::json!({ "bytes": 0u64, "total": total }),
    );

    let spool = crate::update_spool::core_attempt(data, &manifest.app_build_id)?;
    let spool_path = spool.path().join("archive.part");

    let streamed = artifact_stream::stream_response_to_file(
        resp,
        &spool_path,
        CORE_PACK_ARCHIVE_MAX_BYTES,
        |bytes, total| {
            if let Ok(mut runtime) = gate.0.lock() {
                runtime.progress_bytes = bytes;
                runtime.progress_total = total;
            }
            let _ = app.emit(
                "fofline-spa-pack-progress",
                serde_json::json!({ "bytes": bytes, "total": total }),
            );
        },
    )
    .await
    .map_err(|e| {
        if e.starts_with("artifact_too_large") {
            "pack_too_large".into()
        } else if e.starts_with("disk_full") {
            e
        } else {
            classify_net(&e)
        }
    })?;

    if !streamed
        .sha256_hex
        .eq_ignore_ascii_case(manifest.sha256.trim())
    {
        let _ = spa_pack::write_error_state(
            data,
            "sha256_mismatch",
            "Downloaded pack checksum does not match manifest",
            previous_ready_id.clone(),
        );
        return Err("sha256_mismatch".into());
    }

    {
        let file = File::open(&spool_path).map_err(|e| format!("open spool: {e}"))?;
        let map = unsafe { Mmap::map(&file) }.map_err(|e| format!("mmap spool: {e}"))?;
        if let Err(e) = spa_pack::verify_tauri_minisign(&map, &manifest.signature, &pubkey) {
            eprintln!("[STEP] fofline_spa_pack verify_fail {e}");
            let _ = spa_pack::write_error_state(
                data,
                "signature_invalid",
                "Pack signature verification failed — workspace not updated",
                previous_ready_id.clone(),
            );
            return Err("signature_invalid".into());
        }
    }
    eprintln!(
        "[STEP] fofline_spa_pack verify_ok app_build_id={} bytes={}",
        manifest.app_build_id, streamed.bytes_written
    );

    let staging = spa_pack::staging_dir(data);
    spa_pack::extract_tar_zst_file(&spool_path, &staging)?;
    spa_pack::promote_staging(data)?;
    spa_pack::write_ready_state(data, &manifest.app_build_id)?;

    Ok(view_ready(
        format!(
            "FoFline workspace installed ({})",
            manifest.app_build_id
        ),
        manifest.app_build_id.clone(),
        Some(manifest.app_build_id),
        spa_pack::current_dir(data).display().to_string(),
    ))
}

fn classify_net(msg: &str) -> String {
    let lower = msg.to_lowercase();
    if lower.contains("dns")
        || lower.contains("connection")
        || lower.contains("timed out")
        || lower.contains("timeout")
        || lower.contains("network")
        || lower.contains("unreachable")
        || lower.contains("offline")
    {
        format!("offline_skip:{msg}")
    } else {
        msg.to_string()
    }
}
