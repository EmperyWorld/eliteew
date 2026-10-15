# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for **server-first v2** companion branch: learned-pref / catalog rollout env, intent regex, catalogue
# outcomes (0 / 1 / 2 rows), auto-create placeholder (**dedup-safe** body, name match / retry), **UndefinedTableError** /
# missing ``unified_content`` hint, optional ``open_app`` after rewrite, **MIME + body format** from filename (``.md`` /
# ``.txt`` / HTML) — **no** Postgres (monkeypatched catalogue + storage + LLM).
# Invariants:
# - Keeps imports local to ``companion_server_first_v2`` / ``storage.catalog_pipeline`` for patch targets.
# Related:
# - api/ewa_platform/companion/server_first/v2.py
# - api/ewa_platform/companion/storage/catalog_pipeline.py
# ---
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import asyncpg
import pytest

import api.ewa_platform.companion.server_first.v2 as sf_v2
import api.ewa_platform.companion.storage.catalog_pipeline as catpipe


def test_learned_pref_defaults_false() -> None:
    assert sf_v2.server_first_v2_enabled_from_learned_preferences(None) is False
    assert sf_v2.server_first_v2_enabled_from_learned_preferences({}) is False
    assert sf_v2.server_first_v2_enabled_from_learned_preferences({"ewa_companion_server_first_v2": False}) is False


def test_learned_pref_true_variants() -> None:
    assert sf_v2.server_first_v2_enabled_from_learned_preferences({"ewa_companion_server_first_v2": True}) is True
    assert sf_v2.server_first_v2_enabled_from_learned_preferences({"ewa_companion_server_first_v2": "true"}) is True
    assert (
        sf_v2.server_first_v2_enabled_from_learned_preferences(
            {"ewa_companion_server_first_v2": {"enabled": True}},
        )
        is True
    )


def test_branch_enabled_by_default_when_catalog_user_present(monkeypatch: pytest.MonkeyPatch) -> None:
    """Server-first v2 is the **default** mode (2026-05). The branch fires regardless of learned-pref."""

    monkeypatch.delenv("EWA_COMPANION_SERVER_FIRST_V2", raising=False)
    monkeypatch.delenv("EWA_COMPANION_SERVER_FIRST_V2_WITH_CATALOG", raising=False)
    assert sf_v2.server_first_v2_branch_enabled_for_turn(None, content_catalog_user_id="u1") is True
    assert sf_v2.server_first_v2_branch_enabled_for_turn({}, content_catalog_user_id="u1") is True
    assert (
        sf_v2.server_first_v2_branch_enabled_for_turn(
            {"ewa_companion_server_first_v2": False},
            content_catalog_user_id="u1",
        )
        is True
    ), "Learned-pref off must NOT disable the branch any more"


def test_branch_disabled_without_catalog_user(monkeypatch: pytest.MonkeyPatch) -> None:
    """Without a catalog owner the v2 branch has nothing to act on."""

    monkeypatch.delenv("EWA_COMPANION_SERVER_FIRST_V2", raising=False)
    assert sf_v2.server_first_v2_branch_enabled_for_turn({}, content_catalog_user_id=None) is False
    assert sf_v2.server_first_v2_branch_enabled_for_turn({}, content_catalog_user_id="") is False


def test_branch_disabled_when_master_env_kill_switch_off(monkeypatch: pytest.MonkeyPatch) -> None:
    """Operator-level kill-switch (``EWA_COMPANION_SERVER_FIRST_V2=0``) disables the branch entirely."""

    monkeypatch.setenv("EWA_COMPANION_SERVER_FIRST_V2", "0")
    assert sf_v2.server_first_v2_branch_enabled_for_turn({}, content_catalog_user_id="u1") is False
    monkeypatch.setenv("EWA_COMPANION_SERVER_FIRST_V2", "off")
    assert sf_v2.server_first_v2_branch_enabled_for_turn({}, content_catalog_user_id="u1") is False


def test_intent_positive_doc_edit_named_file_ru() -> None:
    line = "Пользователь хочет отредактировать файл 888.md и написать в нём стих о Деде Морозе."
    assert sf_v2.companion_user_intent_server_first_v2_full_replace(line) is True


def test_intent_positive_compose_in_named_md() -> None:
    assert sf_v2.companion_user_intent_server_first_v2_full_replace("Напиши в draft.md короткое стихотворение.") is True
    assert sf_v2.companion_user_intent_server_first_v2_full_replace("Compose a poem in notes.md about winter.") is True


def test_intent_negative_write_without_filename() -> None:
    assert sf_v2.companion_user_intent_server_first_v2_full_replace("Напиши стих о Деде Морозе") is False
    assert sf_v2.companion_user_intent_server_first_v2_full_replace("Write a poem about winter") is False


def test_intent_negative_doc_edit_without_filename() -> None:
    assert sf_v2.companion_user_intent_server_first_v2_full_replace("Отредактируй файл и сделай короче") is False


def test_intent_positive_quoted() -> None:
    line = "Полностью перепиши содержимое «notes.md» как короткую сказку"
    assert sf_v2.companion_user_intent_server_first_v2_full_replace(line) is True


def test_intent_positive_ext() -> None:
    line = "Replace entire content of report.md with a one-paragraph summary of the quarterly data"
    assert sf_v2.companion_user_intent_server_first_v2_full_replace(line) is True


def test_intent_negative_no_file() -> None:
    line = "Полностью перепиши всё как сказку"
    assert sf_v2.companion_user_intent_server_first_v2_full_replace(line) is False


def test_open_after_edit_positive() -> None:
    assert (
        sf_v2.user_line_requests_open_after_server_first_v2(
            "... и открой в редакторе документов",
        )
        is True
    )
    assert (
        sf_v2.user_line_requests_open_after_server_first_v2(
            "rewrite entire file notes.md and open in the document editor",
        )
        is True
    )


def test_autocreate_filename_skips_ru_prose_before_numeric_md() -> None:
    assert sf_v2._first_autocreate_filename_in_line("Полностью перепиши 888.md как тест") == "888.md"


def test_body_format_from_filename_extension() -> None:
    assert catpipe.server_first_body_format("draft.txt") == "plaintext"
    assert catpipe.server_first_body_format("Notes.MD") == "markdown"
    assert catpipe.server_first_body_format("page.htm") == "html"
    assert catpipe.server_first_body_format("unknown.bin") == "html"


def test_target_filename_priority_created_over_picked() -> None:
    class Row:
        name = "picked.md"

    assert (
        catpipe.server_first_target_filename(
            created_fresh_name="fresh.md",
            picked=Row(),
            search_phrase="q.md",
        )
        == "fresh.md"
    )
    assert (
        catpipe.server_first_target_filename(
            created_fresh_name="",
            picked=Row(),
            search_phrase="q.md",
        )
        == "picked.md"
    )
    assert (
        catpipe.server_first_target_filename(
            created_fresh_name=None,
            picked=SimpleNamespace(name=""),
            search_phrase="only.md",
        )
        == "only.md"
    )


def test_autocreate_retries_when_dedup_returns_wrong_name(monkeypatch: pytest.MonkeyPatch) -> None:
    """Hash-dedup can return another row; placeholder must be unique and we re-create until names match."""
    import api.ewa_platform.companion.storage.catalog_pipeline as catpipe

    u_wrong = UUID("11111111-1111-1111-1111-111111111111")
    u_ok = UUID("22222222-2222-2222-2222-222222222222")
    bodies: list[str] = []

    async def fake_create(_storage: object, *, content_user_id: str, name: str, body: str) -> SimpleNamespace:
        bodies.append(body)
        if len(bodies) == 1:
            return SimpleNamespace(id=u_wrong, name="other.md")
        return SimpleNamespace(id=u_ok, name=name)

    monkeypatch.setattr(catpipe, "create_unified_companion_document", fake_create)
    monkeypatch.setattr(sf_v2, "make_content_storage_service", lambda _pool: object())

    out = asyncio.run(
        sf_v2._try_create_missing_named_file_for_server_first(
            pool=MagicMock(),
            content_catalog_user_id="u1",
            user_line="Полностью перепиши 777.md как тест",
            search_phrase="777.md",
            ru=True,
        ),
    )
    uc, name_s, err = out
    assert err is None
    assert uc == u_ok
    assert name_s == "777.md"
    assert len(bodies) == 2
    assert "777.md" in bodies[0] and "777.md" in bodies[1]
    assert bodies[0] != bodies[1]


def test_v2_read_undefined_table_gives_migration_hint(monkeypatch: pytest.MonkeyPatch) -> None:
    uid = UUID("12345678-1234-5678-1234-567812345678")

    class Row:
        id = uid
        name = "notes.md"

    picked = Row()

    async def fake_pick(
        **kwargs: object,
    ) -> tuple[object | None, str | None, list[object]]:
        return picked, "notes.md", [picked]

    class FakeStorage:
        async def read_file_bytes_for_owner(self, *a: object, **k: object) -> tuple[bytes, dict[str, object]]:
            raise asyncpg.exceptions.UndefinedTableError('relation "unified_content" does not exist')

        async def get_content(self, *a: object, **k: object) -> SimpleNamespace:
            return SimpleNamespace(version=1)

    monkeypatch.setattr(sf_v2, "catalog_pick_owner_row", fake_pick)
    monkeypatch.setattr(sf_v2, "make_content_storage_service", lambda _pool: FakeStorage())

    out = asyncio.run(
        sf_v2.maybe_handle_server_first_v2_turn(
            MagicMock(),
            principal_id="p",
            user_line="Полностью перепиши notes.md как тест",
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        ),
    )
    assert out is not None
    reply = (out.get("reply") or "").lower()
    assert "unified_content" in reply
    assert "миграц" in reply


def test_v2_zero_hits_reply(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_pick(
        **kwargs: object,
    ) -> tuple[object | None, str | None, list[object]]:
        return None, "ghost", []

    monkeypatch.setattr(sf_v2, "catalog_pick_owner_row", fake_pick)
    out = asyncio.run(
        sf_v2.maybe_handle_server_first_v2_turn(
            MagicMock(),
            principal_id="p",
            user_line="Полностью перепиши содержимое «ghost» как тест",
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        ),
    )
    assert out is not None
    assert out["actions"] == []
    assert "каталог" in (out.get("reply") or "").lower() or "catalogue" in (out.get("reply") or "").lower()


def test_v2_autocreate_reuses_exact_name_without_create(monkeypatch: pytest.MonkeyPatch) -> None:
    uid = UUID("12345678-1234-5678-1234-567812345678")

    async def fake_pick(
        **kwargs: object,
    ) -> tuple[object | None, str | None, list[object]]:
        return None, "reuse.md", []

    existing = SimpleNamespace(id=uid, name="reuse.md")

    async def fake_find_exact(**kwargs: object) -> object:
        return existing

    create_called = {"n": 0}

    async def fake_create(*a: object, **k: object) -> SimpleNamespace:
        create_called["n"] += 1
        return SimpleNamespace(id=uid, name="reuse.md")

    class FakeStorage:
        def __init__(self) -> None:
            self.replace_called = False

        async def read_file_bytes_for_owner(self, *a: object, **k: object) -> tuple[bytes, dict[str, object]]:
            return b"# old body", {}

        async def get_content(self, *a: object, **k: object) -> SimpleNamespace:
            return SimpleNamespace(version=1)

        async def replace_file_content(self, *a: object, **k: object) -> SimpleNamespace:
            self.replace_called = True
            return SimpleNamespace()

    storages: list[FakeStorage] = []

    def fake_make(pool: object) -> FakeStorage:
        fs = FakeStorage()
        storages.append(fs)
        return fs

    monkeypatch.setattr(sf_v2, "catalog_pick_owner_row", fake_pick)
    monkeypatch.setattr(catpipe, "create_unified_companion_document", fake_create)
    monkeypatch.setattr(catpipe, "find_owner_ewa_file_by_exact_name", fake_find_exact)
    monkeypatch.setattr(sf_v2, "make_content_storage_service", fake_make)
    monkeypatch.setattr(
        sf_v2,
        "unified_settings",
        SimpleNamespace(llama_url="http://127.0.0.1:1", default_ai_model="mistral"),
    )

    async def fake_llm(*a: object, **k: object) -> dict[str, str]:
        return {"response": "# Reused\n\nBody."}

    monkeypatch.setattr(sf_v2, "httpx_compat_chat_completion_json", fake_llm)

    out = asyncio.run(
        sf_v2.maybe_handle_server_first_v2_turn(
            MagicMock(),
            principal_id="p",
            user_line="Полностью перепиши reuse.md как короткий тест",
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        ),
    )
    assert out is not None
    assert create_called["n"] == 0
    assert storages[-1].replace_called
    reply_low = (out.get("reply") or "").lower()
    assert "верси" in reply_low or "version" in reply_low


def test_v2_autocreates_missing_md_then_rewrites(monkeypatch: pytest.MonkeyPatch) -> None:
    uid = UUID("12345678-1234-5678-1234-567812345678")

    async def fake_pick(
        **kwargs: object,
    ) -> tuple[object | None, str | None, list[object]]:
        return None, "888.md", []

    async def fake_create(*a: object, **k: object) -> SimpleNamespace:
        # Real storage returns a row whose ``name`` matches the new file; server-first verifies this after dedup.
        return SimpleNamespace(id=uid, name="888.md")

    class FakeStorage:
        def __init__(self) -> None:
            self.replace_called = False
            self.last_mime: str | None = None
            self.last_bytes: bytes | None = None

        async def read_file_bytes_for_owner(self, *a: object, **k: object) -> tuple[bytes, dict[str, object]]:
            return b"ewa-companion-draft", {}

        async def get_content(self, *a: object, **k: object) -> SimpleNamespace:
            return SimpleNamespace(version=2)

        async def replace_file_content(
            self,
            _cid: object,
            _uid: object,
            file_data: bytes,
            *,
            mime_type: str | None = None,
            **_: object,
        ) -> SimpleNamespace:
            self.replace_called = True
            self.last_mime = mime_type
            self.last_bytes = file_data
            return SimpleNamespace()

    storages: list[FakeStorage] = []

    def fake_make(pool: object) -> FakeStorage:
        fs = FakeStorage()
        storages.append(fs)
        return fs

    async def fake_find_exact(**kwargs: object) -> None:
        return None

    monkeypatch.setattr(sf_v2, "catalog_pick_owner_row", fake_pick)
    monkeypatch.setattr(catpipe, "create_unified_companion_document", fake_create)
    monkeypatch.setattr(catpipe, "find_owner_ewa_file_by_exact_name", fake_find_exact)
    monkeypatch.setattr(sf_v2, "make_content_storage_service", fake_make)
    monkeypatch.setattr(
        sf_v2,
        "unified_settings",
        SimpleNamespace(llama_url="http://127.0.0.1:1", default_ai_model="mistral"),
    )

    async def fake_llm(*a: object, **k: object) -> dict[str, str]:
        return {"response": "# Autocreated\n\nShort body."}

    monkeypatch.setattr(sf_v2, "httpx_compat_chat_completion_json", fake_llm)

    out = asyncio.run(
        sf_v2.maybe_handle_server_first_v2_turn(
            MagicMock(),
            principal_id="p",
            user_line="Полностью перепиши 888.md как короткий тест",
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        ),
    )
    assert out is not None
    assert storages[-1].replace_called
    assert storages[-1].last_mime == "text/markdown"
    assert storages[-1].last_bytes is not None and b"Autocreated" in storages[-1].last_bytes
    reply_low = (out.get("reply") or "").lower()
    assert "верси" in reply_low or "version" in reply_low
    assert "создан" in reply_low or "catalogue" in reply_low


def test_v2_ambiguous_two_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    class R:
        def __init__(self, u: UUID) -> None:
            self.id = u
            self.name = "a"

    rows = [R(UUID(int=1)), R(UUID(int=2))]

    async def fake_pick(
        **kwargs: object,
    ) -> tuple[object | None, str | None, list[object]]:
        return None, "dup", list(rows)

    monkeypatch.setattr(sf_v2, "catalog_pick_owner_row", fake_pick)
    out = asyncio.run(
        sf_v2.maybe_handle_server_first_v2_turn(
            MagicMock(),
            principal_id="p",
            user_line='Полностью замени содержимое «dup» текстом "x"',
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        ),
    )
    assert out is not None
    assert out["actions"] == []
    assert "несколько" in (out.get("reply") or "").lower() or "several" in (out.get("reply") or "").lower()


def test_v2_single_hit_writes_and_optionally_opens(monkeypatch: pytest.MonkeyPatch) -> None:
    uid = UUID("12345678-1234-5678-1234-567812345678")

    class Row:
        id = uid
        name = "notes.md"

    picked = Row()

    async def fake_pick(
        **kwargs: object,
    ) -> tuple[object | None, str | None, list[object]]:
        return picked, "notes.md", [picked]

    class FakeStorage:
        def __init__(self) -> None:
            self.replace_called = False
            self.last_mime: str | None = None
            self.last_bytes: bytes | None = None
            self.last_expected_version: int | None = None

        async def get_content(self, *a: object, **k: object) -> SimpleNamespace:
            return SimpleNamespace(version=3)

        async def read_file_bytes_for_owner(self, *a: object, **k: object) -> tuple[bytes, dict[str, object]]:
            return b"<p>old</p>", {}

        async def replace_file_content(
            self,
            _cid: object,
            _uid: object,
            file_data: bytes,
            *,
            mime_type: str | None = None,
            expected_version: int | None = None,
            **_: object,
        ) -> SimpleNamespace:
            self.replace_called = True
            self.last_mime = mime_type
            self.last_bytes = file_data
            self.last_expected_version = expected_version
            return SimpleNamespace()

    storages: list[FakeStorage] = []

    def fake_make(pool: object) -> FakeStorage:
        fs = FakeStorage()
        storages.append(fs)
        return fs

    monkeypatch.setattr(sf_v2, "catalog_pick_owner_row", fake_pick)
    monkeypatch.setattr(sf_v2, "make_content_storage_service", fake_make)
    monkeypatch.setattr(
        sf_v2,
        "unified_settings",
        SimpleNamespace(llama_url="http://127.0.0.1:1", default_ai_model="mistral"),
    )

    async def fake_llm(*a: object, **k: object) -> dict[str, str]:
        return {"response": "## New\n\nTwo paragraphs.\n\nDone."}

    monkeypatch.setattr(sf_v2, "httpx_compat_chat_completion_json", fake_llm)

    base_line = "Полностью перепиши содержимое «notes.md» как заголовок и два абзаца"
    out = asyncio.run(
        sf_v2.maybe_handle_server_first_v2_turn(
            MagicMock(),
            principal_id="p",
            user_line=base_line,
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        ),
    )
    assert out is not None
    assert storages[0].replace_called
    assert storages[0].last_expected_version == 3
    assert storages[0].last_mime == "text/markdown"
    assert storages[0].last_bytes is not None and b"New" in storages[0].last_bytes
    assert not out["actions"]
    reply_low = (out.get("reply") or "").lower()
    assert "верси" in reply_low or "version" in reply_low

    out_open = asyncio.run(
        sf_v2.maybe_handle_server_first_v2_turn(
            MagicMock(),
            principal_id="p",
            user_line=base_line + " и открой в редакторе документов",
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        ),
    )
    assert out_open is not None
    assert storages[1].replace_called
    assert len(out_open["actions"]) >= 1
    assert out_open["actions"][0].get("type") == "open_app"
    assert out_open["actions"][0].get("app_component") == "DocEditor"


def test_v2_txt_sets_plain_mime(monkeypatch: pytest.MonkeyPatch) -> None:
    uid = UUID("12345678-1234-5678-1234-567812345678")

    class Row:
        id = uid
        name = "notes.txt"

    picked = Row()

    async def fake_pick(
        **kwargs: object,
    ) -> tuple[object | None, str | None, list[object]]:
        return picked, "notes.txt", [picked]

    class FakeStorage:
        def __init__(self) -> None:
            self.replace_called = False
            self.last_mime: str | None = None
            self.last_bytes: bytes | None = None

        async def get_content(self, *a: object, **k: object) -> SimpleNamespace:
            return SimpleNamespace(version=1)

        async def read_file_bytes_for_owner(self, *a: object, **k: object) -> tuple[bytes, dict[str, object]]:
            return b"old line", {}

        async def replace_file_content(
            self,
            _cid: object,
            _uid: object,
            file_data: bytes,
            *,
            mime_type: str | None = None,
            **_: object,
        ) -> SimpleNamespace:
            self.replace_called = True
            self.last_mime = mime_type
            self.last_bytes = file_data
            return SimpleNamespace()

    storages: list[FakeStorage] = []

    def fake_make(pool: object) -> FakeStorage:
        fs = FakeStorage()
        storages.append(fs)
        return fs

    monkeypatch.setattr(sf_v2, "catalog_pick_owner_row", fake_pick)
    monkeypatch.setattr(sf_v2, "make_content_storage_service", fake_make)
    monkeypatch.setattr(
        sf_v2,
        "unified_settings",
        SimpleNamespace(llama_url="http://127.0.0.1:1", default_ai_model="mistral"),
    )

    async def fake_llm(*a: object, **k: object) -> dict[str, str]:
        return {"response": "Hello world.\n\nSecond paragraph only."}

    monkeypatch.setattr(sf_v2, "httpx_compat_chat_completion_json", fake_llm)

    out = asyncio.run(
        sf_v2.maybe_handle_server_first_v2_turn(
            MagicMock(),
            principal_id="p",
            user_line="Полностью перепиши notes.txt как два абзаца",
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        ),
    )
    assert out is not None
    assert storages[0].replace_called
    assert storages[0].last_mime == "text/plain"
    assert storages[0].last_bytes is not None
    assert b"Hello world" in storages[0].last_bytes


def test_v2_html_sets_html_mime(monkeypatch: pytest.MonkeyPatch) -> None:
    uid = UUID("12345678-1234-5678-1234-567812345678")

    class Row:
        id = uid
        name = "page.html"

    picked = Row()

    async def fake_pick(
        **kwargs: object,
    ) -> tuple[object | None, str | None, list[object]]:
        return picked, "page.html", [picked]

    class FakeStorage:
        def __init__(self) -> None:
            self.replace_called = False
            self.last_mime: str | None = None
            self.last_bytes: bytes | None = None

        async def get_content(self, *a: object, **k: object) -> SimpleNamespace:
            return SimpleNamespace(version=1)

        async def read_file_bytes_for_owner(self, *a: object, **k: object) -> tuple[bytes, dict[str, object]]:
            return b"<p>old</p>", {}

        async def replace_file_content(
            self,
            _cid: object,
            _uid: object,
            file_data: bytes,
            *,
            mime_type: str | None = None,
            **_: object,
        ) -> SimpleNamespace:
            self.replace_called = True
            self.last_mime = mime_type
            self.last_bytes = file_data
            return SimpleNamespace()

    storages: list[FakeStorage] = []

    def fake_make(pool: object) -> FakeStorage:
        fs = FakeStorage()
        storages.append(fs)
        return fs

    monkeypatch.setattr(sf_v2, "catalog_pick_owner_row", fake_pick)
    monkeypatch.setattr(sf_v2, "make_content_storage_service", fake_make)
    monkeypatch.setattr(
        sf_v2,
        "unified_settings",
        SimpleNamespace(llama_url="http://127.0.0.1:1", default_ai_model="mistral"),
    )

    async def fake_llm(*a: object, **k: object) -> dict[str, str]:
        return {"response": "<p>Replaced</p>"}

    monkeypatch.setattr(sf_v2, "httpx_compat_chat_completion_json", fake_llm)

    out = asyncio.run(
        sf_v2.maybe_handle_server_first_v2_turn(
            MagicMock(),
            principal_id="p",
            user_line="Replace entire content of page.html with one paragraph",
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        ),
    )
    assert out is not None
    assert storages[0].replace_called
    assert storages[0].last_mime == "text/html"
    assert storages[0].last_bytes is not None
    assert b"<p>Replaced</p>" in storages[0].last_bytes


def test_v2_file_rewrite_logs_version_trace(caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch) -> None:
    import logging

    uid = UUID("12345678-1234-5678-1234-567812345678")

    class Row:
        id = uid
        name = "notes.md"

    picked = Row()

    async def fake_pick(
        **kwargs: object,
    ) -> tuple[object | None, str | None, list[object]]:
        return picked, "notes.md", [picked]

    class FakeStorage:
        async def get_content(self, *a: object, **k: object) -> SimpleNamespace:
            return SimpleNamespace(version=7)

        async def read_file_bytes_for_owner(self, *a: object, **k: object) -> tuple[bytes, dict[str, object]]:
            return b"# Old", {}

        async def replace_file_content(
            self,
            _cid: object,
            _uid: object,
            file_data: bytes,
            *,
            mime_type: str | None = None,
            expected_version: int | None = None,
            **_: object,
        ) -> SimpleNamespace:
            assert expected_version == 7
            return SimpleNamespace()

    monkeypatch.setattr(sf_v2, "catalog_pick_owner_row", fake_pick)
    monkeypatch.setattr(sf_v2, "make_content_storage_service", lambda _pool: FakeStorage())
    monkeypatch.setattr(
        sf_v2,
        "unified_settings",
        SimpleNamespace(llama_url="http://127.0.0.1:1", default_ai_model="mistral"),
    )

    async def fake_llm(*a: object, **k: object) -> dict[str, str]:
        return {"response": "# New"}

    monkeypatch.setattr(sf_v2, "httpx_compat_chat_completion_json", fake_llm)

    with caplog.at_level(logging.INFO, logger="api.ewa_platform.companion.server_first.v2"):
        out = asyncio.run(
            sf_v2.maybe_handle_server_first_v2_turn(
                MagicMock(),
                principal_id="p",
                user_line="Полностью перепиши notes.md кратко",
                content_catalog_user_id="u1",
                oauth2_sub_for_content_alternate=None,
            ),
        )
    assert out is not None
    messages = [r.getMessage() for r in caplog.records]
    assert any("file_rewrite_version_fetch" in m and "version=7" in m for m in messages)
    assert any(
        "file_rewrite_version_write" in m and "expected_version=7" in m and "result=success" in m for m in messages
    )
