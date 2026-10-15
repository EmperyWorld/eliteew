// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Stage 2 native FS bridge — path allowlist + list/read/atomic-write for
// local folder import (product lean A). Not a Content Manager replacement.
// Invariants:
// - Default-deny outside allowlisted roots; no broad $HOME.
// - Absolute path IPC denied — relative under Import/staging only (Wave 7 / F-11).
// - symlink_metadata / reparse: never follow links out of root.
// - Sensitive path segments always denied even under a root.
// - Writes are tmp + rename on the same filesystem; no partial overwrite.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.2
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §Wave 7
// ---

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::resource_policy::FS_BRIDGE_FILE_MAX_BYTES;

/// Soft cap for a single `read_file` / `write_atomic` payload (pilot import).
pub const MAX_FILE_BYTES: u64 = FS_BRIDGE_FILE_MAX_BYTES;

/// Soft cap for entries returned by one `list_dir` call.
pub const MAX_LIST_ENTRIES: usize = 2_000;

/// Max recursion depth for `list_dir` (0 = only the directory itself as root listing).
pub const MAX_LIST_DEPTH: u32 = 4;

const IMPORT_REL: &str = "EliteEW/Import";
const STAGING_REL: &str = "fs_bridge/staging";

/// Hard-deny path components / prefixes even if somehow under an allowlisted root.
const DENIED_COMPONENTS: &[&str] = &[
    ".ssh",
    ".gnupg",
    ".aws",
    ".config",
    "private-keys-v1.d",
];

#[derive(Debug, Clone, Serialize)]
pub struct FsRootInfo {
    pub id: String,
    pub label: String,
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FsBridgeError {
    Deny(String),
    NotFound(String),
    Io(String),
    TooLarge { size: u64, max: u64 },
    Invalid(String),
}

impl FsBridgeError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Deny(_) => "fs_deny",
            Self::NotFound(_) => "fs_not_found",
            Self::Io(_) => "fs_io",
            Self::TooLarge { .. } => "fs_too_large",
            Self::Invalid(_) => "fs_invalid",
        }
    }

    pub fn message(&self) -> String {
        match self {
            Self::Deny(m) => m.clone(),
            Self::NotFound(m) => m.clone(),
            Self::Io(m) => m.clone(),
            Self::TooLarge { size, max } => {
                format!("Файл слишком большой ({size} байт; лимит {max})")
            }
            Self::Invalid(m) => m.clone(),
        }
    }
}

pub fn import_root() -> Result<PathBuf, FsBridgeError> {
    let home = dirs_home().ok_or_else(|| {
        FsBridgeError::Invalid("HOME не определён — нельзя построить корень Import".into())
    })?;
    Ok(home.join(IMPORT_REL))
}

pub fn staging_root(app_data: &Path) -> PathBuf {
    app_data.join(STAGING_REL)
}

pub fn ensure_roots(app_data: &Path) -> Result<Vec<FsRootInfo>, FsBridgeError> {
    let import = import_root()?;
    let staging = staging_root(app_data);
    for root in [&import, &staging] {
        fs::create_dir_all(root).map_err(|e| {
            FsBridgeError::Io(format!("не удалось создать корень {}: {e}", root.display()))
        })?;
    }
    Ok(vec![
        FsRootInfo {
            id: "import".into(),
            label: "Локальный импорт".into(),
            path: import.display().to_string(),
            exists: import.is_dir(),
        },
        FsRootInfo {
            id: "staging".into(),
            label: "Служебный staging".into(),
            path: staging.display().to_string(),
            exists: staging.is_dir(),
        },
    ])
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
}

fn is_denied_component(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    DENIED_COMPONENTS.iter().any(|d| *d == lower)
}

fn path_has_denied_segment(path: &Path) -> bool {
    path.components().any(|c| match c {
        Component::Normal(os) => os
            .to_str()
            .map(is_denied_component)
            .unwrap_or(false),
        _ => false,
    })
}

fn normalize_candidate(raw: &str) -> Result<PathBuf, FsBridgeError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(FsBridgeError::Invalid("пустой путь".into()));
    }
    let path = PathBuf::from(trimmed);
    if path
        .components()
        .any(|c| matches!(c, Component::ParentDir))
    {
        return Err(FsBridgeError::Deny(
            "путь с «..» запрещён (default-deny)".into(),
        ));
    }
    if path_has_denied_segment(&path) {
        return Err(FsBridgeError::Deny(
            "путь пересекает запрещённый сегмент (ключи/секреты)".into(),
        ));
    }
    Ok(path)
}

fn is_symlink_or_reparse(path: &Path) -> bool {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return false;
    };
    if meta.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        if meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return true;
        }
    }
    let _ = meta;
    false
}

/// Resolve a relative path strictly under Import or staging without following symlinks.
pub fn resolve_relative_under_root(
    app_data: &Path,
    root_id: &str,
    relative: &str,
) -> Result<PathBuf, FsBridgeError> {
    let candidate = normalize_candidate(relative)?;
    if candidate.is_absolute() {
        return Err(FsBridgeError::Deny(
            "absolute path IPC denied — use relative under Import/staging".into(),
        ));
    }
    let _ = ensure_roots(app_data);
    let root = match root_id {
        "import" => import_root()?,
        "staging" => staging_root(app_data),
        other => {
            return Err(FsBridgeError::Invalid(format!("unknown root id: {other}")));
        }
    };
    // Prefer real root path when present; otherwise lexical.
    let root_base = root.canonicalize().unwrap_or(root.clone());
    if is_symlink_or_reparse(&root_base) {
        return Err(FsBridgeError::Deny("root is a symlink/reparse — denied".into()));
    }

    let mut cur = root_base.clone();
    for comp in candidate.components() {
        match comp {
            Component::Normal(name) => {
                cur.push(name);
                if is_symlink_or_reparse(&cur) {
                    eprintln!(
                        "[STEP] tauri_fs_deny path={} reason=symlink_or_reparse",
                        cur.display()
                    );
                    return Err(FsBridgeError::Deny(
                        "symlink/reparse в пути запрещён".into(),
                    ));
                }
            }
            Component::CurDir => {}
            _ => {
                return Err(FsBridgeError::Deny(
                    "недопустимый компонент пути".into(),
                ));
            }
        }
    }

    if path_has_denied_segment(&cur) {
        return Err(FsBridgeError::Deny(
            "путь пересекает запрещённый сегмент".into(),
        ));
    }
    if !(cur.starts_with(&root_base) || cur == root_base) {
        return Err(FsBridgeError::Deny(
            "путь вне выбранного корня".into(),
        ));
    }
    Ok(cur)
}

/// Resolve `raw` under allowlisted roots; absolute IPC paths are denied (Wave 7).
pub fn resolve_allowed(app_data: &Path, raw: &str) -> Result<PathBuf, FsBridgeError> {
    let candidate = normalize_candidate(raw)?;
    if candidate.is_absolute() {
        eprintln!("[STEP] tauri_fs_deny reason=absolute_ipc");
        return Err(FsBridgeError::Deny(
            "absolute path IPC denied — use relative under Import/staging".into(),
        ));
    }

    // Prefer import for relative paths; fall back to staging when missing under import.
    let import_try = resolve_relative_under_root(app_data, "import", raw);
    match &import_try {
        Ok(p) if p.exists() || p.parent().map(|par| par.is_dir()).unwrap_or(false) => {
            return import_try;
        }
        _ => {}
    }
    let staging_try = resolve_relative_under_root(app_data, "staging", raw);
    if staging_try.is_ok() {
        return staging_try;
    }
    import_try
}

pub fn list_dir(
    app_data: &Path,
    raw: &str,
    max_depth: u32,
) -> Result<Vec<FsEntry>, FsBridgeError> {
    let root = resolve_allowed(app_data, raw)?;
    if !root.is_dir() {
        return Err(FsBridgeError::Invalid(format!(
            "не каталог: {}",
            root.display()
        )));
    }
    let depth = max_depth.min(MAX_LIST_DEPTH);
    let mut out = Vec::new();
    list_dir_walk(&root, &root, 0, depth, &mut out)?;
    Ok(out)
}

fn list_dir_walk(
    list_root: &Path,
    dir: &Path,
    depth: u32,
    max_depth: u32,
    out: &mut Vec<FsEntry>,
) -> Result<(), FsBridgeError> {
    if out.len() >= MAX_LIST_ENTRIES {
        return Ok(());
    }
    let read = fs::read_dir(dir).map_err(|e| {
        FsBridgeError::Io(format!("list_dir {}: {e}", dir.display()))
    })?;
    for entry in read {
        if out.len() >= MAX_LIST_ENTRIES {
            break;
        }
        let entry = entry.map_err(|e| FsBridgeError::Io(format!("readdir: {e}")))?;
        let path = entry.path();
        if path_has_denied_segment(&path) {
            eprintln!(
                "[STEP] tauri_fs_deny path={} reason=denied_segment_skip",
                path.display()
            );
            continue;
        }
        if is_symlink_or_reparse(&path) {
            eprintln!(
                "[STEP] tauri_fs_deny path={} reason=symlink_skip_list",
                path.display()
            );
            continue;
        }
        let meta = entry
            .metadata()
            .map_err(|e| FsBridgeError::Io(format!("metadata: {e}")))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let is_dir = meta.is_dir();
        let rel = path
            .strip_prefix(list_root)
            .map(|r| r.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| path.display().to_string());
        out.push(FsEntry {
            name,
            path: rel,
            is_dir,
            size: if is_dir { None } else { Some(meta.len()) },
        });
        if is_dir && depth < max_depth {
            list_dir_walk(list_root, &path, depth + 1, max_depth, out)?;
        }
    }
    Ok(())
}

pub fn read_file(app_data: &Path, raw: &str) -> Result<(PathBuf, Vec<u8>), FsBridgeError> {
    let path = resolve_allowed(app_data, raw)?;
    if !path.is_file() {
        return Err(FsBridgeError::NotFound(format!(
            "файл не найден: {}",
            path.display()
        )));
    }
    let meta = fs::metadata(&path).map_err(|e| FsBridgeError::Io(e.to_string()))?;
    if meta.len() > MAX_FILE_BYTES {
        return Err(FsBridgeError::TooLarge {
            size: meta.len(),
            max: MAX_FILE_BYTES,
        });
    }
    let mut f = File::open(&path).map_err(|e| FsBridgeError::Io(e.to_string()))?;
    let mut buf = Vec::with_capacity(meta.len() as usize);
    f.read_to_end(&mut buf)
        .map_err(|e| FsBridgeError::Io(e.to_string()))?;
    Ok((path, buf))
}

pub fn write_atomic(
    app_data: &Path,
    raw: &str,
    bytes: &[u8],
) -> Result<PathBuf, FsBridgeError> {
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(FsBridgeError::TooLarge {
            size: bytes.len() as u64,
            max: MAX_FILE_BYTES,
        });
    }
    let path = resolve_allowed(app_data, raw)?;
    if path.is_dir() {
        return Err(FsBridgeError::Invalid(
            "цель write_atomic — файл, не каталог".into(),
        ));
    }
    if let Some(parent) = path.parent() {
        // Parent must also be under allowlist (resolve_allowed already ensures leaf path).
        fs::create_dir_all(parent).map_err(|e| {
            FsBridgeError::Io(format!("mkdir {}: {e}", parent.display()))
        })?;
    }

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp_name = format!(
        ".{}.eliteew-tmp-{}",
        path.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("file"),
        stamp
    );
    let tmp_path = path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(tmp_name);

    {
        let mut f = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp_path)
            .map_err(|e| FsBridgeError::Io(format!("create tmp: {e}")))?;
        f.write_all(bytes)
            .map_err(|e| FsBridgeError::Io(format!("write tmp: {e}")))?;
        f.sync_all()
            .map_err(|e| FsBridgeError::Io(format!("fsync tmp: {e}")))?;
    }

    fs::rename(&tmp_path, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        FsBridgeError::Io(format!("atomic rename: {e}"))
    })?;

    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_app_data() -> PathBuf {
        let mut p = env::temp_dir();
        p.push(format!(
            "eliteew-fs-bridge-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).expect("temp app_data");
        p
    }

    #[test]
    fn deny_parent_dir_traversal() {
        let app = temp_app_data();
        let err = resolve_allowed(&app, "../etc/passwd").unwrap_err();
        assert_eq!(err.code(), "fs_deny");
        let _ = fs::remove_dir_all(&app);
    }

    #[test]
    fn deny_ssh_segment() {
        let app = temp_app_data();
        let import = import_root().expect("home");
        let _ = fs::create_dir_all(&import);
        let ssh = import.join(".ssh").join("id_rsa");
        let _ = fs::create_dir_all(ssh.parent().unwrap());
        let _ = fs::write(&ssh, b"secret");
        let err = resolve_allowed(&app, ".ssh/id_rsa").unwrap_err();
        assert_eq!(err.code(), "fs_deny");
        let _ = fs::remove_file(&ssh);
        let _ = fs::remove_dir_all(&app);
    }

    #[test]
    fn allow_staging_write_atomic_roundtrip() {
        let app = temp_app_data();
        let roots = ensure_roots(&app).expect("roots");
        assert_eq!(roots.len(), 2);
        let written = write_atomic(&app, "hello.txt", b"abc").expect("write");
        assert!(written.ends_with("hello.txt"));
        let (path, bytes) = read_file(&app, "hello.txt").expect("read");
        assert_eq!(bytes, b"abc");
        assert!(path.ends_with("hello.txt"));
        let entries = list_dir(&app, ".", 0).expect("list");
        assert!(entries.iter().any(|e| e.name == "hello.txt"));
        let _ = fs::remove_dir_all(&app);
    }

    #[test]
    fn deny_outside_home_import() {
        let app = temp_app_data();
        let _ = ensure_roots(&app);
        let err = resolve_allowed(&app, "/etc/hosts").unwrap_err();
        assert_eq!(err.code(), "fs_deny");
        let _ = fs::remove_dir_all(&app);
    }

    #[test]
    fn absolute_path_denied() {
        let app = temp_app_data();
        let err = resolve_allowed(&app, "/etc/passwd").unwrap_err();
        assert_eq!(err.code(), "fs_deny");
        let _ = fs::remove_dir_all(&app);
    }
}
