// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Single-process offline native audio engine (rodio + cpal) for client MusicPlayer panel.
// Invariants:
// - One playback queue at a time; new play stops the previous track.
// - Codec failures return honest errors — no HTML5 <audio> fallback.
// - Staged bytes live only under app_data/native-audio/.
// Related:
// - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md §Client edition
// - commands/native_audio.rs
// ---

use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use rodio::{Decoder, DeviceSinkBuilder, MixerDeviceSink, Player, Source};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const PROGRESS_EVENT: &str = "native-audio-progress";
pub const ENDED_EVENT: &str = "native-audio-ended";

const STAGE_DIR: &str = "native-audio";
const MAX_BYTES: usize = 200 * 1024 * 1024;
const PROGRESS_INTERVAL_MS: u64 = 150;

#[derive(Debug, Clone, Serialize)]
pub struct NativeAudioProgress {
    pub position_secs: f64,
    pub duration_secs: Option<f64>,
    pub playing: bool,
    pub file_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeAudioView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_secs: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_secs: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub playing: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volume: Option<f32>,
}

impl NativeAudioView {
    fn fail(code: &str, message: impl Into<String>) -> Self {
        Self {
            ok: false,
            code: code.into(),
            message: message.into(),
            file_name: None,
            position_secs: None,
            duration_secs: None,
            playing: None,
            volume: None,
        }
    }

    fn ok_status(
        code: &str,
        message: impl Into<String>,
        file_name: Option<String>,
        position_secs: Option<f64>,
        duration_secs: Option<f64>,
        playing: bool,
        volume: f32,
    ) -> Self {
        Self {
            ok: true,
            code: code.into(),
            message: message.into(),
            file_name,
            position_secs,
            duration_secs,
            playing: Some(playing),
            volume: Some(volume),
        }
    }
}

struct EngineInner {
    device: Option<MixerDeviceSink>,
    player: Option<Player>,
    generation: u64,
    ticker_stop: Option<Arc<AtomicBool>>,
    file_name: Option<String>,
    staged_path: Option<PathBuf>,
    duration_secs: Option<f64>,
    volume: f32,
    /// Logical transport: true after successful play/resume until pause/stop/end.
    want_playing: bool,
}

pub struct NativeAudioEngine {
    inner: Mutex<EngineInner>,
}

impl Default for NativeAudioEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl NativeAudioEngine {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(EngineInner {
                device: None,
                player: None,
                generation: 0,
                ticker_stop: None,
                file_name: None,
                staged_path: None,
                duration_secs: None,
                volume: 1.0,
                want_playing: false,
            }),
        }
    }

    pub fn play_bytes(
        self: &Arc<Self>,
        app: &AppHandle,
        app_data: &Path,
        file_name: &str,
        bytes: &[u8],
    ) -> NativeAudioView {
        if bytes.is_empty() {
            return NativeAudioView::fail("empty", "Файл пуст — нечего воспроизводить");
        }
        if bytes.len() > MAX_BYTES {
            return NativeAudioView::fail(
                "too_large",
                format!(
                    "Файл слишком большой (лимит {} МБ)",
                    MAX_BYTES / (1024 * 1024)
                ),
            );
        }
        let safe_name = match sanitize_file_name(file_name) {
            Some(n) => n,
            None => {
                return NativeAudioView::fail(
                    "bad_name",
                    "Некорректное имя файла — выберите аудиофайл",
                );
            }
        };
        if !looks_like_audio_name(&safe_name) {
            return NativeAudioView::fail(
                "unsupported_type",
                "Выберите аудиофайл (mp3, ogg, wav, m4a, flac, …)",
            );
        }

        let mut guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return NativeAudioView::fail("engine_lock", "Движок воспроизведения занят"),
        };

        stop_inner(&mut guard);

        let staged = match stage_bytes(app_data, &safe_name, bytes) {
            Ok(p) => p,
            Err(e) => return NativeAudioView::fail("stage_failed", e),
        };

        if !staged.is_file() {
            return NativeAudioView::fail("missing_file", "Файл не найден после сохранения");
        }

        if let Err(e) = ensure_device(&mut guard) {
            return NativeAudioView::fail("device_failed", e);
        }

        let device = match guard.device.as_ref() {
            Some(d) => d,
            None => {
                return NativeAudioView::fail("device_failed", "Аудиоустройство недоступно");
            }
        };

        let file = match File::open(&staged) {
            Ok(f) => f,
            Err(e) => {
                return NativeAudioView::fail("missing_file", format!("Не удалось открыть файл: {e}"));
            }
        };

        let source = match Decoder::try_from(file) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[STEP] native_audio decode_fail name={safe_name} err={e}");
                return NativeAudioView::fail(
                    "unsupported_codec",
                    "Формат не поддерживается нативным плеером. Выберите другой файл (mp3, ogg, wav, flac).",
                );
            }
        };

        let duration_secs = source.total_duration().map(|d| d.as_secs_f64());
        let player = Player::connect_new(device.mixer());
        player.set_volume(guard.volume);
        player.append(source);
        player.play();

        guard.generation = guard.generation.wrapping_add(1);
        let gen = guard.generation;
        let stop_flag = Arc::new(AtomicBool::new(false));
        if let Some(prev) = guard.ticker_stop.take() {
            prev.store(true, Ordering::SeqCst);
        }
        guard.ticker_stop = Some(Arc::clone(&stop_flag));
        guard.player = Some(player);
        guard.file_name = Some(safe_name.clone());
        guard.staged_path = Some(staged);
        guard.duration_secs = duration_secs;
        guard.want_playing = true;

        spawn_progress_ticker(app.clone(), Arc::clone(self), gen, stop_flag);

        let _ = app.emit(
            PROGRESS_EVENT,
            NativeAudioProgress {
                position_secs: 0.0,
                duration_secs,
                playing: true,
                file_name: Some(safe_name.clone()),
            },
        );

        NativeAudioView::ok_status(
            "playing",
            format!("Воспроизведение: {safe_name}"),
            Some(safe_name),
            Some(0.0),
            duration_secs,
            true,
            guard.volume,
        )
    }

    /// Stream decode from an allowlisted granted file (Wave 7 — no byte IPC).
    pub fn play_path(
        self: &Arc<Self>,
        app: &AppHandle,
        app_data: &Path,
        path: &Path,
    ) -> NativeAudioView {
        let meta = match fs::metadata(path) {
            Ok(m) => m,
            Err(e) => return NativeAudioView::fail("missing_file", format!("Файл недоступен: {e}")),
        };
        if !meta.is_file() {
            return NativeAudioView::fail("missing_file", "Цель воспроизведения не файл");
        }
        if meta.len() as usize > MAX_BYTES || meta.len() == 0 {
            return NativeAudioView::fail(
                if meta.len() == 0 { "empty" } else { "too_large" },
                if meta.len() == 0 {
                    "Файл пуст — нечего воспроизводить".into()
                } else {
                    format!(
                        "Файл слишком большой (лимит {} МБ)",
                        MAX_BYTES / (1024 * 1024)
                    )
                },
            );
        }
        let file_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("track");
        let safe_name = match sanitize_file_name(file_name) {
            Some(n) => n,
            None => {
                return NativeAudioView::fail(
                    "bad_name",
                    "Некорректное имя файла — выберите аудиофайл",
                );
            }
        };
        if !looks_like_audio_name(&safe_name) {
            return NativeAudioView::fail(
                "unsupported_type",
                "Выберите аудиофайл (mp3, ogg, wav, m4a, flac, …)",
            );
        }

        let mut guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return NativeAudioView::fail("engine_lock", "Движок воспроизведения занят"),
        };
        stop_inner(&mut guard);

        let staged = match stage_copy(app_data, &safe_name, path) {
            Ok(p) => p,
            Err(e) => return NativeAudioView::fail("stage_failed", e),
        };

        if let Err(e) = ensure_device(&mut guard) {
            return NativeAudioView::fail("device_failed", e);
        }
        let device = match guard.device.as_ref() {
            Some(d) => d,
            None => {
                return NativeAudioView::fail("device_failed", "Аудиоустройство недоступно");
            }
        };
        let file = match File::open(&staged) {
            Ok(f) => f,
            Err(e) => {
                return NativeAudioView::fail("missing_file", format!("Не удалось открыть файл: {e}"));
            }
        };
        let source = match Decoder::try_from(file) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[STEP] native_audio decode_fail name={safe_name} err={e}");
                return NativeAudioView::fail(
                    "unsupported_codec",
                    "Формат не поддерживается нативным плеером. Выберите другой файл (mp3, ogg, wav, flac).",
                );
            }
        };
        let duration_secs = source.total_duration().map(|d| d.as_secs_f64());
        let player = Player::connect_new(device.mixer());
        player.set_volume(guard.volume);
        player.append(source);
        player.play();

        guard.generation = guard.generation.wrapping_add(1);
        let gen = guard.generation;
        let stop_flag = Arc::new(AtomicBool::new(false));
        if let Some(prev) = guard.ticker_stop.take() {
            prev.store(true, Ordering::SeqCst);
        }
        guard.ticker_stop = Some(Arc::clone(&stop_flag));
        guard.player = Some(player);
        guard.file_name = Some(safe_name.clone());
        guard.staged_path = Some(staged);
        guard.duration_secs = duration_secs;
        guard.want_playing = true;
        spawn_progress_ticker(app.clone(), Arc::clone(self), gen, stop_flag);
        let _ = app.emit(
            PROGRESS_EVENT,
            NativeAudioProgress {
                position_secs: 0.0,
                duration_secs,
                playing: true,
                file_name: Some(safe_name.clone()),
            },
        );
        NativeAudioView::ok_status(
            "playing",
            format!("Воспроизведение: {safe_name}"),
            Some(safe_name),
            Some(0.0),
            duration_secs,
            true,
            guard.volume,
        )
    }

    pub fn pause(&self) -> NativeAudioView {
        let mut guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return NativeAudioView::fail("engine_lock", "Движок воспроизведения занят"),
        };
        match guard.player.as_ref() {
            Some(p) if !p.empty() => {
                p.pause();
                guard.want_playing = false;
                snapshot_ok(&guard, "paused", "Пауза")
            }
            _ => NativeAudioView::ok_status(
                "idle",
                "Нечего ставить на паузу",
                None,
                None,
                None,
                false,
                guard.volume,
            ),
        }
    }

    pub fn resume(&self) -> NativeAudioView {
        let mut guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return NativeAudioView::fail("engine_lock", "Движок воспроизведения занят"),
        };
        match guard.player.as_ref() {
            Some(p) if !p.empty() => {
                p.play();
                guard.want_playing = true;
                snapshot_ok(&guard, "playing", "Продолжение")
            }
            _ => NativeAudioView::ok_status(
                "idle",
                "Нет активного трека",
                None,
                None,
                None,
                false,
                guard.volume,
            ),
        }
    }

    pub fn stop(&self) -> NativeAudioView {
        let mut guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return NativeAudioView::fail("engine_lock", "Движок воспроизведения занят"),
        };
        stop_inner(&mut guard);
        NativeAudioView::ok_status(
            "stopped",
            "Воспроизведение остановлено",
            None,
            Some(0.0),
            None,
            false,
            guard.volume,
        )
    }

    pub fn seek(&self, position_secs: f64) -> NativeAudioView {
        if !position_secs.is_finite() || position_secs < 0.0 {
            return NativeAudioView::fail("bad_seek", "Некорректная позиция");
        }
        let guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return NativeAudioView::fail("engine_lock", "Движок воспроизведения занят"),
        };
        match guard.player.as_ref() {
            Some(p) if !p.empty() => {
                match p.try_seek(Duration::from_secs_f64(position_secs)) {
                    Ok(()) => snapshot_ok(&guard, "seeked", "Позиция обновлена"),
                    Err(e) => {
                        eprintln!("[STEP] native_audio seek_fail err={e}");
                        NativeAudioView::fail(
                            "seek_unsupported",
                            "Перемотка недоступна для этого файла",
                        )
                    }
                }
            }
            // Defined no-op while stopped / idle.
            _ => NativeAudioView::ok_status(
                "idle",
                "Перемотка без активного трека не выполняется",
                None,
                None,
                None,
                false,
                guard.volume,
            ),
        }
    }

    pub fn set_volume(&self, volume: f32) -> NativeAudioView {
        if !volume.is_finite() || !(0.0..=1.0).contains(&volume) {
            return NativeAudioView::fail("bad_volume", "Громкость должна быть от 0 до 1");
        }
        let mut guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return NativeAudioView::fail("engine_lock", "Движок воспроизведения занят"),
        };
        guard.volume = volume;
        if let Some(p) = guard.player.as_ref() {
            p.set_volume(volume);
        }
        snapshot_ok(&guard, "volume", "Громкость обновлена")
    }

    pub fn status(&self) -> NativeAudioView {
        let guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return NativeAudioView::fail("engine_lock", "Движок воспроизведения занят"),
        };
        if guard.player.as_ref().is_some_and(|p| !p.empty()) {
            snapshot_ok(&guard, "ok", "Статус плеера")
        } else {
            NativeAudioView::ok_status(
                "idle",
                "Плеер свободен",
                None,
                Some(0.0),
                None,
                false,
                guard.volume,
            )
        }
    }
}

fn spawn_progress_ticker(
    app: AppHandle,
    engine: Arc<NativeAudioEngine>,
    generation: u64,
    stop: Arc<AtomicBool>,
) {
    thread::Builder::new()
        .name("eliteew-native-audio-progress".into())
        .spawn(move || {
            loop {
                if stop.load(Ordering::SeqCst) {
                    break;
                }
                thread::sleep(Duration::from_millis(PROGRESS_INTERVAL_MS));
                if stop.load(Ordering::SeqCst) {
                    break;
                }
                let Ok(mut guard) = engine.inner.lock() else {
                    break;
                };
                if guard.generation != generation {
                    break;
                }
                let Some(player) = guard.player.as_ref() else {
                    break;
                };
                if player.empty() {
                    guard.want_playing = false;
                    let file_name = guard.file_name.clone();
                    let duration_secs = guard.duration_secs;
                    drop(guard);
                    let _ = app.emit(
                        ENDED_EVENT,
                        NativeAudioProgress {
                            position_secs: duration_secs.unwrap_or(0.0),
                            duration_secs,
                            playing: false,
                            file_name,
                        },
                    );
                    break;
                }
                let position_secs = player.get_pos().as_secs_f64();
                let playing = guard.want_playing && !player.is_paused();
                let payload = NativeAudioProgress {
                    position_secs,
                    duration_secs: guard.duration_secs,
                    playing,
                    file_name: guard.file_name.clone(),
                };
                drop(guard);
                let _ = app.emit(PROGRESS_EVENT, payload);
            }
        })
        .ok();
}

fn stop_inner(guard: &mut EngineInner) {
    if let Some(flag) = guard.ticker_stop.take() {
        flag.store(true, Ordering::SeqCst);
    }
    if let Some(player) = guard.player.take() {
        player.stop();
    }
    guard.file_name = None;
    guard.duration_secs = None;
    guard.want_playing = false;
    guard.generation = guard.generation.wrapping_add(1);
    // Keep staged_path for overwrite on next play; device reused.
}

fn ensure_device(guard: &mut EngineInner) -> Result<(), String> {
    if guard.device.is_some() {
        return Ok(());
    }
    let mut sink = DeviceSinkBuilder::open_default_sink().map_err(|e| {
        format!("Не удалось открыть аудиоустройство: {e}")
    })?;
    sink.log_on_drop(false);
    guard.device = Some(sink);
    Ok(())
}

fn snapshot_ok(guard: &EngineInner, code: &str, message: &str) -> NativeAudioView {
    let (position_secs, playing) = match guard.player.as_ref() {
        Some(p) if !p.empty() => {
            let pos = p.get_pos().as_secs_f64();
            let playing = guard.want_playing && !p.is_paused();
            (Some(pos), playing)
        }
        _ => (Some(0.0), false),
    };
    NativeAudioView::ok_status(
        code,
        message,
        guard.file_name.clone(),
        position_secs,
        guard.duration_secs,
        playing,
        guard.volume,
    )
}

pub fn sanitize_file_name(raw: &str) -> Option<String> {
    let base = Path::new(raw)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .trim();
    if base.is_empty() || base == "." || base == ".." {
        return None;
    }
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let cleaned = cleaned.trim().to_string();
    if cleaned.is_empty() || cleaned.len() > 180 {
        return None;
    }
    Some(cleaned)
}

pub fn looks_like_audio_name(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "mp3" | "ogg" | "oga" | "wav" | "flac" | "m4a" | "aac" | "opus"
            )
        })
        .unwrap_or(false)
}

pub 
fn stage_copy(app_data: &Path, safe_name: &str, src: &Path) -> Result<PathBuf, String> {
    let dir = app_data.join(STAGE_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("native-audio mkdir: {e}"))?;
    let dest = dir.join(safe_name);
    if dest.exists() {
        let _ = fs::remove_file(&dest);
    }
    fs::copy(src, &dest).map_err(|e| format!("native-audio stage copy: {e}"))?;
    Ok(dest)
}

fn stage_bytes(app_data: &Path, safe_name: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    let dir = app_data.join(STAGE_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("native_audio_dir: {e}"))?;
    let ext = Path::new(safe_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let path = dir.join(format!("current.{ext}"));
    fs::write(&path, bytes).map_err(|e| format!("native_audio_write: {e}"))?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn sanitize_rejects_empty_and_traversal() {
        assert!(sanitize_file_name("").is_none());
        assert!(sanitize_file_name("../x.mp3").is_some());
        assert_eq!(
            sanitize_file_name("../x.mp3").as_deref(),
            Some("x.mp3")
        );
        assert!(sanitize_file_name("track name.mp3").is_some());
    }

    #[test]
    fn looks_like_audio_extensions() {
        assert!(looks_like_audio_name("a.mp3"));
        assert!(looks_like_audio_name("a.FLAC"));
        assert!(!looks_like_audio_name("a.txt"));
        assert!(!looks_like_audio_name("noext"));
    }

    #[test]
    fn stage_bytes_writes_under_app_data() {
        let dir = env::temp_dir().join(format!(
            "eliteew-native-audio-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = stage_bytes(&dir, "demo.wav", b"RIFF").unwrap();
        assert!(path.starts_with(dir.join(STAGE_DIR)));
        assert_eq!(fs::read(&path).unwrap(), b"RIFF");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn seek_while_stopped_is_idle_noop() {
        let engine = NativeAudioEngine::new();
        let view = engine.seek(12.0);
        assert!(view.ok);
        assert_eq!(view.code, "idle");
    }

    #[test]
    fn dual_play_stop_keeps_engine_usable() {
        let engine = NativeAudioEngine::new();
        let stop = engine.stop();
        assert!(stop.ok);
        let again = engine.stop();
        assert!(again.ok);
    }
}
