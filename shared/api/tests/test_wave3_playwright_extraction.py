# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock: Wave 3 Task 2.P — Playwright absent from stack0-api; browser render via sidecar.
# Invariants:
# - api.lock excludes playwright; queue-worker.lock includes playwright.
# - stack0-api venv import playwright raises ModuleNotFoundError.
# Related:
# - api/services/rendering/browser_render_client.py
# - docker/builders/stack0-api/requirements/locks/api.lock
# ---
from __future__ import annotations

import importlib
import importlib.util
from pathlib import Path

import pytest

_API_LOCK_CANDIDATES = (
    Path(__file__).resolve().parents[3] / "docker/builders/stack0-api/requirements/locks/api.lock",
    Path("/app/docker/builders/stack0-api/requirements/locks/api.lock"),
)
_QUEUE_LOCK_CANDIDATES = (
    Path(__file__).resolve().parents[3] / "docker/builders/stack0-api/requirements/locks/queue-worker.lock",
    Path("/app/docker/builders/stack0-api/requirements/locks/queue-worker.lock"),
)


def _first_existing(candidates: tuple[Path, ...]) -> Path | None:
    for path in candidates:
        if path.is_file():
            return path
    return None


def test_api_lock_excludes_playwright() -> None:
    api_lock = _first_existing(_API_LOCK_CANDIDATES)
    if api_lock is None:
        pytest.skip("api.lock not available in this runtime")
    lock_text = api_lock.read_text(encoding="utf-8")
    assert "playwright==" not in lock_text, "playwright must be absent from api.lock"


def test_queue_worker_lock_includes_playwright() -> None:
    queue_lock = _first_existing(_QUEUE_LOCK_CANDIDATES)
    if queue_lock is None:
        pytest.skip("queue-worker.lock not available in this runtime")
    lock_text = queue_lock.read_text(encoding="utf-8")
    assert "playwright==" in lock_text, "playwright must remain on queue-worker.lock"


def test_playwright_not_installed_in_api_venv() -> None:
    spec = importlib.util.find_spec("playwright")
    assert spec is None, "playwright must be absent from stack0-api venv"


def test_import_playwright_raises_module_not_found() -> None:
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("playwright")


@pytest.mark.asyncio
async def test_browser_render_client_posts_to_sidecar(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from api.services.rendering import browser_render_client as client_mod

    html_path = tmp_path / "index.html"
    html_path.write_text("<html></html>", encoding="utf-8")
    shot_dir = tmp_path / "screenshots"
    shot_dir.mkdir()
    png = shot_dir / "page_01.png"
    png.write_bytes(b"\x89PNG\r\n")

    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "screenshot_count": 1,
                "screenshot_paths": [str(png)],
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self) -> FakeAsyncClient:
            return self

        async def __aexit__(self, *args) -> None:
            return None

        async def post(self, url: str, json: dict) -> FakeResponse:
            captured["url"] = url
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr(client_mod, "browser_render_service_url", lambda: "http://render-sidecar:8095")
    monkeypatch.setattr(client_mod.httpx, "AsyncClient", FakeAsyncClient)

    paths = await client_mod.request_html_slide_screenshots(
        html_path=html_path,
        screenshot_dir=shot_dir,
    )
    assert paths == [png]
    assert captured["url"] == "http://render-sidecar:8095/v1/render/html-slides"
    payload = captured["json"]
    assert isinstance(payload, dict)
    assert payload["html_path"] == str(html_path)
    assert payload["screenshot_dir"] == str(shot_dir)


def test_validate_generated_files_path_rejects_escape(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.rendering import playwright_renderer as renderer_mod

    root = tmp_path / "generated_files"
    root.mkdir()
    monkeypatch.setattr(renderer_mod, "GENERATED_FILES_ROOT", root)
    allowed = root / "ewrp" / "job" / "index.html"
    allowed.parent.mkdir(parents=True)
    allowed.write_text("<html></html>", encoding="utf-8")
    assert renderer_mod.validate_generated_files_path(allowed) == allowed.resolve()

    with pytest.raises(ValueError, match="must stay under"):
        renderer_mod.validate_generated_files_path("/etc/passwd")


def test_playwright_renderer_uses_load_not_networkidle() -> None:
    """Offline EWRP HTML must not wait for CDN networkidle."""
    src = Path(__file__).resolve().parents[1] / "services/rendering/playwright_renderer.py"
    text = src.read_text(encoding="utf-8")
    assert 'wait_until="load"' in text
    assert 'wait_until="networkidle"' not in text
    assert "document.fonts.ready" in text
