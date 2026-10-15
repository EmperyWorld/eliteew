# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 3 Task 0.Final — post-purge integrity lock: zero ghost imports on API runtime surface.
# Invariants:
# - Banned libs absent from api runtime modules (worker sidecar engines allowlisted).
# - Sidecar clients raise structured errors; PyJWT/pdf_engine contracts hold.
# Related:
# - documentation/worklog/session-summaries/*wave3*integrity*
# ---
from __future__ import annotations

import ast
import importlib.util
from pathlib import Path

import httpx
import pytest
from fastapi import HTTPException

_API_ROOT = Path(__file__).resolve().parents[1]

# Modules executed only on queue-worker sidecars (may import playwright/scipy/sklearn).
_WORKER_ONLY_REL_PATHS = frozenset(
    {
        "services/rendering/playwright_renderer.py",
        "services/rendering/render_sidecar_app.py",
        "services/science_stack/science_engine.py",
        "services/science_stack/science_sidecar_app.py",
    }
)

_BANNED_ROOT_MODULES = frozenset(
    {
        "chromadb",
        "playwright",
        "pandas",
        "sklearn",
        "scipy",
        "cv2",
        "opencv",
        "pysqlite3",
        "jose",
        "PyPDF2",
        "pdfplumber",
        "pypdf",
        "pdf2image",
        "pypdfium2",
        "passlib",
        "telethon",
        "requests",
        "keycloak",
    }
)

_BANNED_LOCK_PREFIXES = (
    "chromadb==",
    "playwright==",
    "pandas==",
    "scipy==",
    "opencv-python==",
    "scikit-learn==",
    "matplotlib==",
    "seaborn==",
    "python-jose==",
    "PyPDF2==",
    "pypdf==",
    "pdfplumber==",
    "pypdfium2==",
    "pdf2image==",
    "passlib==",
    "telethon==",
    "requests==",
    "python-keycloak==",
)

_API_LOCK_CANDIDATES = (
    Path(__file__).resolve().parents[3] / "docker/builders/stack0-api/requirements/locks/api.lock",
    Path("/app/docker/builders/stack0-api/requirements/locks/api.lock"),
)


def _api_runtime_py_files() -> list[Path]:
    skip_dirs = {".venv", "__pycache__", ".pytest_cache", "node_modules"}
    files: list[Path] = []
    for path in _API_ROOT.rglob("*.py"):
        if any(part in skip_dirs for part in path.parts):
            continue
        rel = path.relative_to(_API_ROOT).as_posix()
        if rel.startswith("tests/"):
            continue
        if rel in _WORKER_ONLY_REL_PATHS:
            continue
        files.append(path)
    return sorted(files)


def _collect_import_roots(tree: ast.AST) -> set[str]:
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                roots.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            roots.add(node.module.split(".")[0])
    return roots


def test_api_runtime_surface_has_zero_banned_imports() -> None:
    violations: list[str] = []
    for path in _api_runtime_py_files():
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            violations.append(f"{path.relative_to(_API_ROOT)}: syntax error {exc}")
            continue
        imported = _collect_import_roots(tree)
        banned = imported & _BANNED_ROOT_MODULES
        if banned:
            rel = path.relative_to(_API_ROOT)
            violations.append(f"{rel}: {sorted(banned)}")
    assert not violations, "Banned imports on API runtime surface:\n" + "\n".join(violations)


def test_api_lock_excludes_purged_direct_pins() -> None:
    lock_path = next((p for p in _API_LOCK_CANDIDATES if p.is_file()), None)
    if lock_path is None:
        pytest.skip("api.lock not available in this runtime")
    lock_text = lock_path.read_text(encoding="utf-8")
    for banned in _BANNED_LOCK_PREFIXES:
        assert banned not in lock_text, f"{banned} must be absent from api.lock"


@pytest.mark.parametrize(
    "module_name",
    (
        "chromadb",
        "playwright",
        "pandas",
        "scipy",
        "sklearn",
        "cv2",
        "jose",
        "PyPDF2",
        "pdfplumber",
    ),
)
def test_purged_modules_not_importable_in_api_venv(module_name: str) -> None:
    spec = importlib.util.find_spec(module_name)
    assert spec is None, f"{module_name} must be absent from stack0-api venv"


def test_keycloak_service_uses_pyjwt_not_jose() -> None:
    source = (_API_ROOT / "services/keycloak_service.py").read_text(encoding="utf-8")
    assert "import jwt" in source or "from jwt" in source
    assert "from jose" not in source
    assert "import jose" not in source
    assert "jwt.decode(" in source


def test_doc_converter_uses_pdf_engine_not_legacy() -> None:
    source = (_API_ROOT / "services/doc_converter_service.py").read_text(encoding="utf-8")
    assert "api.core.pdf_engine" in source
    for banned in ("PyPDF2", "pdfplumber", "pypdf", "pdf2image"):
        assert banned not in source


def test_document_processor_uses_pdf_engine_not_legacy() -> None:
    path = _API_ROOT / "services/document_processor.py"
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    imported = _collect_import_roots(tree)
    source = path.read_text(encoding="utf-8")
    assert "api.core.pdf_engine" in source
    assert "sklearn" not in imported
    assert "numpy" not in imported


def test_embedding_service_cosine_without_numpy_import() -> None:
    source = (_API_ROOT / "services/ai_sdk/embedding_service.py").read_text(encoding="utf-8")
    assert "import numpy" not in source
    assert "from numpy" not in source
    assert "math.sqrt" in source


@pytest.mark.asyncio
async def test_browser_render_client_raises_structured_error_on_http_fail(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    from api.services.rendering.browser_render_client import (
        BrowserRenderUnavailableError,
        request_html_slide_screenshots,
    )

    class FailClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url: str, json: dict):
            raise httpx.ConnectError("connection refused", request=httpx.Request("POST", url))

    monkeypatch.setattr(
        "api.services.rendering.browser_render_client.browser_render_service_url",
        lambda: "http://sidecar:8095",
    )
    monkeypatch.setattr(httpx, "AsyncClient", FailClient)
    html_path = tmp_path / "index.html"
    html_path.write_text("<html></html>", encoding="utf-8")
    shot_dir = tmp_path / "shots"
    shot_dir.mkdir()
    with pytest.raises(BrowserRenderUnavailableError, match="Browser render sidecar"):
        await request_html_slide_screenshots(
            html_path=html_path,
            screenshot_dir=shot_dir,
        )


@pytest.mark.asyncio
async def test_browser_render_unavailable_maps_to_http_503(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from api.core.sidecar_errors import sidecar_http_exception
    from api.services.rendering.browser_render_client import BrowserRenderUnavailableError

    exc = BrowserRenderUnavailableError(
        "Browser render sidecar request failed",
    )
    http_exc = sidecar_http_exception(exc, service="browser-render")
    assert isinstance(http_exc, HTTPException)
    assert http_exc.status_code == 503


def test_database_manager_chromadb_client_removed() -> None:
    from api.core.database_manager import DatabaseConnectionError, DatabaseManager

    manager = DatabaseManager()
    with pytest.raises(DatabaseConnectionError, match="removed from stack0-api"):
        manager.get_chromadb_client()
