// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// FoFline L3 local WebView origin: custom URI scheme serving verified SPA pack
// from `{app_data}/fofline-spa/current/` + pure URL builder helpers.
// Invariants:
// - Path traversal outside `current/` is rejected (fail-closed).
// - SPA index.html fallback only for extensionless client routes.
// - Missing files that already have an extension (e.g. `/o-proekte/index.html`)
//   return 404 — never substitute the desktop SPA (avoids iframe matryoshka).
// - Canonical start URL scheme is `fofline-spa://localhost` (Win WebView2 may
//   rewrite Origin to `http://fofline-spa.localhost` — Keycloak/CORS must list both).
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3 / L3 / §17
// ---

use std::fs;
use std::path::{Component, Path, PathBuf};

use tauri::http::{header, Request, Response, StatusCode};

use crate::spa_pack;

/// Custom scheme registered with Tauri (`register_uri_scheme_protocol`).
pub const SCHEME: &str = "fofline-spa";

/// Documented navigation URL host (Linux/macOS Origin: `fofline-spa://localhost`).
pub const LOCAL_HOST: &str = "localhost";

/// Windows / Android WebView2 Origin host form for the same scheme.
pub const WINDOWS_ORIGIN_HOST: &str = "fofline-spa.localhost";

/// Content-Security-Policy for verified pack responses (L3 product WebView).
/// Connect/frame hosts match FoFline OIDC + stack0 API + Meet; not a sterile OS claim.
/// Wave 6 / F-09: exact origins only — no `img-src https:` wildcard.
pub const FOFLINE_SPA_PACK_CSP: &str = concat!(
    "default-src 'self'; ",
    "base-uri 'self'; ",
    "object-src 'none'; ",
    "script-src 'self'; ",
    "style-src 'self' 'unsafe-inline'; ",
    "img-src 'self' data: blob: https://app.eliteew.ru https://auth.eliteew.ru https://meet.eliteew.ru; ",
    "font-src 'self' data:; ",
    "media-src 'self' blob: https://meet.eliteew.ru; ",
    "worker-src 'self' blob:; ",
    "connect-src 'self' https://app.eliteew.ru https://auth.eliteew.ru ",
    "wss://app.eliteew.ru https://meet.eliteew.ru wss://meet.eliteew.ru; ",
    "frame-src 'self' https://meet.eliteew.ru https://auth.eliteew.ru https://app.eliteew.ru; ",
    "frame-ancestors 'none'; ",
    "form-action 'self' https://auth.eliteew.ru https://app.eliteew.ru"
);

fn with_pack_security_headers(
    builder: tauri::http::response::Builder,
) -> tauri::http::response::Builder {
    builder.header(header::CONTENT_SECURITY_POLICY, FOFLINE_SPA_PACK_CSP)
}

/// Pure builder for FoFline local Start (Layer C lock target).
/// Wave 2: profile marker only — bind ids stay in Rust ticket/preflight, not the URL.
pub fn build_local_start_url() -> String {
    format!("{SCHEME}://{LOCAL_HOST}/index.html?eliteewFoflineClient=1")
}

pub fn is_fofline_local_url(url: &url::Url) -> bool {
    if url.scheme() == SCHEME {
        return true;
    }
    matches!(url.host_str(), Some(h) if h.eq_ignore_ascii_case(WINDOWS_ORIGIN_HOST))
}

/// Map request path → file under `current/`; None if traversal / escape.
pub fn map_request_to_file(current: &Path, request_path: &str) -> Option<PathBuf> {
    let trimmed = request_path.trim_start_matches('/');
    let rel = if trimmed.is_empty() {
        "index.html"
    } else {
        trimmed
    };
    let mut safe = PathBuf::new();
    for comp in Path::new(rel).components() {
        match comp {
            Component::Normal(seg) => safe.push(seg),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return None;
            }
        }
    }
    if safe.as_os_str().is_empty() {
        safe.push("index.html");
    }
    Some(current.join(safe))
}

fn guess_mime(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "ico" => "image/x-icon",
        "wasm" => "application/wasm",
        "map" => "application/json",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn wants_html(req: &Request<Vec<u8>>) -> bool {
    req.headers()
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .map(|a| a.contains("text/html"))
        .unwrap_or(false)
}

fn has_extension(path: &Path) -> bool {
    path.extension().is_some()
}

fn request_method_allowed(req: &Request<Vec<u8>>) -> bool {
    matches!(
        req.method().as_str(),
        "GET" | "HEAD" | "get" | "head"
    )
}

fn request_host_allowed(req: &Request<Vec<u8>>) -> bool {
    let Some(auth) = req.uri().authority() else {
        // Relative URI path-only requests still serve pack under registered scheme.
        return true;
    };
    let host = auth.host();
    host.eq_ignore_ascii_case(LOCAL_HOST)
        || host.eq_ignore_ascii_case(WINDOWS_ORIGIN_HOST)
}

fn request_path_has_dangerous_encoding(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    path.contains('\0')
        || lower.contains("%00")
        || lower.contains("%2e%2e")
        || lower.contains("%2f")
        || lower.contains("%5c")
        || path.contains('\\')
}

/// Serve one request from verified pack `current/` (or 404 / 403 / 405).
pub fn respond_pack_request(app_data: &Path, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    if !request_method_allowed(&request) {
        return Response::builder()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .header(header::ALLOW, "GET, HEAD")
            .body(b"method not allowed".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    }
    if !request_host_allowed(&request) {
        return Response::builder()
            .status(StatusCode::FORBIDDEN)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(b"forbidden host".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    }

    let current = spa_pack::current_dir(app_data);
    if !spa_pack::is_ready_install(app_data, None) {
        return Response::builder()
            .status(StatusCode::SERVICE_UNAVAILABLE)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(b"FoFline SPA pack not ready".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    }

    let path = request.uri().path();
    if request_path_has_dangerous_encoding(path) {
        return Response::builder()
            .status(StatusCode::FORBIDDEN)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(b"forbidden".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    }
    let Some(mut file) = map_request_to_file(&current, path) else {
        return Response::builder()
            .status(StatusCode::FORBIDDEN)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(b"forbidden".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    };

    if !file.is_file() {
        // Client-side router only for extensionless paths (`/desktop/...`).
        // Never SPA-fallback a missing real asset (`.html`/`.js`/…) — iframe hosts
        // like ProjectAbout would otherwise nest the full desktop (matryoshka).
        if !has_extension(&file) && wants_html(&request) {
            file = current.join("index.html");
        } else if has_extension(&file) {
            return Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
                .body(b"not found".to_vec())
                .unwrap_or_else(|_| Response::new(Vec::new()));
        }
    }

    // Reject symlink escape outside verified `current/` (signed pack still required).
    let Ok(cur_canon) = current.canonicalize() else {
        return Response::builder()
            .status(StatusCode::SERVICE_UNAVAILABLE)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(b"pack path unavailable".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    };
    let Ok(file_canon) = file.canonicalize() else {
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(b"not found".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    };
    if !file_canon.starts_with(&cur_canon) {
        return Response::builder()
            .status(StatusCode::FORBIDDEN)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(b"forbidden".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    }

    match fs::read(&file_canon) {
        Ok(bytes) => {
            let body = if request.method() == tauri::http::Method::HEAD {
                Vec::new()
            } else {
                bytes
            };
            with_pack_security_headers(Response::builder())
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, guess_mime(&file_canon))
                .header(header::CACHE_CONTROL, "no-cache")
                .body(body)
                .unwrap_or_else(|_| Response::new(Vec::new()))
        }
        Err(_) => Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(b"not found".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn build_local_start_url_sets_fofline_query() {
        let u = build_local_start_url();
        assert!(u.starts_with("fofline-spa://localhost/index.html?"));
        assert!(u.contains("eliteewFoflineClient=1"));
        assert!(!u.contains("eliteewLicenseId"));
        assert!(!u.contains("eliteewDeviceId"));
        assert!(!u.contains("eliteewDesktopClient"));
    }

    #[test]
    fn map_request_rejects_parent_dir() {
        let cur = PathBuf::from("/tmp/fofline-spa/current");
        assert!(map_request_to_file(&cur, "../etc/passwd").is_none());
        assert!(map_request_to_file(&cur, "/assets/../../../etc/passwd").is_none());
    }

    #[test]
    fn map_request_empty_is_index() {
        let cur = PathBuf::from("/tmp/fofline-spa/current");
        assert_eq!(
            map_request_to_file(&cur, "/").unwrap(),
            cur.join("index.html")
        );
    }

    #[test]
    fn is_fofline_local_url_scheme_and_windows_host() {
        let a: url::Url = "fofline-spa://localhost/index.html"
            .parse()
            .unwrap();
        assert!(is_fofline_local_url(&a));
        let b: url::Url = "http://fofline-spa.localhost/index.html"
            .parse()
            .unwrap();
        assert!(is_fofline_local_url(&b));
        let c: url::Url = "https://app.eliteew.ru/?eliteewFoflineClient=1"
            .parse()
            .unwrap();
        assert!(!is_fofline_local_url(&c));
    }

    #[test]
    fn respond_serves_index_when_ready() {
        let dir = std::env::temp_dir().join(format!(
            "eliteew-fofline-origin-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let current = spa_pack::current_dir(&dir);
        fs::create_dir_all(&current).unwrap();
        fs::write(current.join("index.html"), b"<html>ok</html>").unwrap();
        fs::write(
            current.join("pack-manifest.json"),
            br#"{"app_build_id":"t1"}"#,
        )
        .unwrap();
        let req = Request::builder()
            .uri("fofline-spa://localhost/")
            .body(Vec::new())
            .unwrap();
        let res = respond_pack_request(&dir, req);
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(res.body(), b"<html>ok</html>");
        let csp = res
            .headers()
            .get(header::CONTENT_SECURITY_POLICY)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert!(
            csp.contains("script-src 'self'") && csp.contains("object-src 'none'"),
            "pack response must send FOFLINE_SPA_PACK_CSP, got {csp:?}"
        );
        assert!(
            csp.contains("frame-ancestors 'none'") && csp.contains("media-src"),
            "Wave 6 CSP must set frame-ancestors + media-src, got {csp:?}"
        );
        // Exact CSP token `https:` as a source (not `https://host`).
        assert!(
            !csp.split(';').any(|d| {
                let d = d.trim();
                d.starts_with("img-src") && d.split_whitespace().any(|t| t == "https:")
            }),
            "Wave 6 forbids img-src https: scheme-source, got {csp:?}"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn respond_rejects_non_get_methods() {
        let dir = std::env::temp_dir().join(format!(
            "eliteew-fofline-origin-method-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let current = spa_pack::current_dir(&dir);
        fs::create_dir_all(&current).unwrap();
        fs::write(current.join("index.html"), b"<html>ok</html>").unwrap();
        fs::write(
            current.join("pack-manifest.json"),
            br#"{"app_build_id":"t1"}"#,
        )
        .unwrap();
        let req = Request::builder()
            .method("POST")
            .uri("fofline-spa://localhost/")
            .body(Vec::new())
            .unwrap();
        let res = respond_pack_request(&dir, req);
        assert_eq!(res.status(), StatusCode::METHOD_NOT_ALLOWED);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn respond_rejects_encoded_traversal() {
        assert!(request_path_has_dangerous_encoding("/%2e%2e/etc/passwd"));
        assert!(request_path_has_dangerous_encoding("/assets/%2f../x"));
        assert!(!request_path_has_dangerous_encoding("/assets/app.js"));
    }

    #[test]
    fn missing_asset_html_is_404_not_spa_fallback() {
        let dir = std::env::temp_dir().join(format!(
            "eliteew-fofline-origin-matryoshka-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let current = spa_pack::current_dir(&dir);
        fs::create_dir_all(&current).unwrap();
        fs::write(current.join("index.html"), b"<html>desktop-spa</html>").unwrap();
        fs::write(
            current.join("pack-manifest.json"),
            br#"{"app_build_id":"t1"}"#,
        )
        .unwrap();
        let req = Request::builder()
            .uri("fofline-spa://localhost/o-proekte/index.html")
            .header(header::ACCEPT, "text/html,application/xhtml+xml")
            .body(Vec::new())
            .unwrap();
        let res = respond_pack_request(&dir, req);
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
        assert_ne!(res.body(), b"<html>desktop-spa</html>");
        let _ = fs::remove_dir_all(&dir);
    }
}
