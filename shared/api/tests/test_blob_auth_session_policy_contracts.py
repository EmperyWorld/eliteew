# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Source contracts for blob auth session policy (plan W0.9 / W1 / W2).
# Invariants:
# - Ticket byte GET has no require_oauth2_user (reference for design A).
# - Bearer download/thumbnail use require_oauth2_user_short_session (Wave 1).
# - SQLAlchemy pii_key soft-skip removed; connect registration present (Wave 2).
# Related:
# - documentation/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md
# - api/services/unified_content/blob_auth_session_policy.py
# ---

from __future__ import annotations

from pathlib import Path

from api.services.unified_content import blob_auth_session_policy as policy

_API_ROOT = Path(__file__).resolve().parents[1]
_DOWNLOAD = _API_ROOT / "routers" / "unified_content_download.py"
_DB_MANAGER = _API_ROOT / "core" / "database_manager.py"
_DEPS = _API_ROOT / "routers" / "unified_content_deps.py"


def test_target_policy_constants_locked() -> None:
    assert policy.TARGET_RELEASE_SQLALCHEMY_BEFORE_BLOB_RETRIEVE is True
    assert policy.TARGET_PII_KEY_POOL_TIMEOUT_FAIL_CLOSED is True
    assert policy.BLOB_AUTH_DESIGN_OPTION == "A"
    assert policy.METRIC_SQLALCHEMY_POOL_TIMEOUTS
    assert policy.METRIC_PII_KEY_SET_FAIL


def test_ticket_download_has_no_oauth2_sqlalchemy_depends() -> None:
    """Reference path for design A: byte GET without require_oauth2_user."""
    src = _DOWNLOAD.read_text(encoding="utf-8")
    marker = "async def download_content_by_ticket("
    assert marker in src
    start = src.index(marker)
    # Through next async def at same indent level (router handlers).
    rest = src[start + len(marker) :]
    next_handler = rest.find("\nasync def ")
    chunk = rest[: next_handler if next_handler >= 0 else len(rest)]
    assert "require_oauth2_user" not in chunk
    assert "get_content_service" in chunk


def test_bearer_download_and_thumbnail_use_short_session_auth() -> None:
    """Wave 1 design A: blob streams use require_oauth2_user_short_session."""
    download_src = _DOWNLOAD.read_text(encoding="utf-8")
    versions_src = (_API_ROOT / "routers" / "unified_content_versions.py").read_text(encoding="utf-8")
    cases = [
        (download_src, "async def download_content("),
        (download_src, "async def get_content_thumbnail("),
        (download_src, "async def download_content_legacy("),
        (download_src, "async def get_content_thumbnail_legacy("),
        (download_src, "async def batch_download_content("),
        (download_src, "async def download_owned_archive("),
        (versions_src, "async def download_version("),
    ]
    for src, marker in cases:
        assert marker in src
        start = src.index(marker)
        rest = src[start + len(marker) :]
        next_handler = rest.find("\nasync def ")
        chunk = rest[: next_handler if next_handler >= 0 else len(rest)]
        assert "require_oauth2_user_short_session" in chunk, marker
        assert "get_content_user_id_short_session" in chunk, marker
        assert "Depends(require_oauth2_user)" not in chunk, marker


def test_oauth2_short_session_helper_exists() -> None:
    oauth = (_API_ROOT / "core" / "oauth2_auth.py").read_text(encoding="utf-8")
    assert "async def require_oauth2_user_short_session(" in oauth
    assert "async with manager.get_postgres_session()" in oauth
    user_ctx = (_API_ROOT / "dependencies" / "user_context.py").read_text(encoding="utf-8")
    assert "async def get_current_user_db_id_short_session(" in user_ctx


def test_pii_key_fail_closed_no_soft_skip_in_get_postgres_session() -> None:
    """Wave 2: connect registration + no soft-skip yield after pii_key ERR."""
    src = _DB_MANAGER.read_text(encoding="utf-8")
    assert "register_sqlalchemy_encryption_pii_key" in src
    assert policy.LOG_PII_KEY_SOFT_SKIP_DEBT not in src
    session_fn = "async def get_postgres_session(self)"
    assert session_fn in src
    body = src[src.index(session_fn) :]
    body = body[: body.find("\n    async def ")] if "\n    async def " in body[1:] else body
    assert "Failed to set encryption.pii_key for session" not in body
    assert "yield session" in body
    chat = (_API_ROOT / "services" / "chat_database_manager.py").read_text(encoding="utf-8")
    assert "Failed to set encryption.pii_key for chat session" not in chat


def test_folder_view_service_uses_shared_get_postgres_session_callable() -> None:
    """I4: same Depends callable (FastAPI caches once per request) — not a second factory."""
    src = _DEPS.read_text(encoding="utf-8")
    assert "async def get_folder_view_service(" in src
    assert "db: AsyncSession = Depends(get_postgres_session)" in src


def test_folder_view_route_shares_oauth2_and_folder_view_session_callable() -> None:
    """W3.1: folder-view lists oauth2 + FolderViewService; both resolve via get_postgres_session once."""
    query = (_API_ROOT / "routers" / "unified_content_query.py").read_text(encoding="utf-8")
    marker = "async def get_content_folder_view("
    assert marker in query
    start = query.index(marker)
    rest = query[start + len(marker) :]
    next_handler = rest.find("\nasync def ")
    chunk = rest[: next_handler if next_handler >= 0 else len(rest)]
    assert "Depends(require_oauth2_user)" in chunk
    assert "Depends(get_folder_view_service)" in chunk
    oauth = (_API_ROOT / "core" / "oauth2_auth.py").read_text(encoding="utf-8")
    # Long-lived require_oauth2_user (folder-view) still Depends shared get_postgres_session.
    assert "db: AsyncSession = Depends(get_postgres_session)" in oauth
    # No alternate session factory in folder-view DI.
    deps = _DEPS.read_text(encoding="utf-8")
    fv = deps[deps.index("async def get_folder_view_service(") :]
    fv = fv[: fv.find("\nasync def ")]
    assert "postgres_session_factory" not in fv
    assert "get_database_manager" not in fv
