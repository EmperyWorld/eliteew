# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for Professional Worlds vertical pack validation helpers (no database).
# Invariants:
# - Tests avoid live Postgres; only pure logic from pack_service.
# Related:
# - api/services/professional_worlds/pack_service.py
# - api/tests/fixtures/packs/consultant-core-pack-v1.json
# ---

from __future__ import annotations

import uuid
from uuid import uuid4

from api.services.professional_worlds.pack_service import (
    ProfessionalWorldsPackService,
    runtime_config_hash_blob,
)


class _FakeResult:
    def __init__(self, row: dict[str, object] | None = None) -> None:
        self._row = row

    def mappings(self) -> _FakeResult:
        return self

    def one(self) -> dict[str, object]:
        assert self._row is not None
        return self._row

    def one_or_none(self) -> dict[str, object] | None:
        return self._row

    def all(self) -> list[dict[str, object]]:
        return [] if self._row is None else [self._row]


class _FakeDb:
    def __init__(
        self,
        *,
        import_job: dict[str, object] | None = None,
        release_row: dict[str, object] | None = None,
        fail_on: str | None = None,
    ) -> None:
        self.import_job = import_job
        self.release_row = release_row
        self.fail_on = fail_on
        self.statements: list[str] = []
        self.commits = 0
        self.rollbacks = 0

    async def execute(self, statement: object, params: dict[str, object] | None = None) -> _FakeResult:
        sql = str(statement)
        self.statements.append(sql)
        if self.fail_on and self.fail_on in sql:
            raise RuntimeError("simulated import failure")
        if "FROM professional_pack_import_jobs" in sql:
            return _FakeResult(self.import_job)
        if "UPDATE professional_vertical_pack_releases" in sql:
            return _FakeResult(self.release_row)
        if "INSERT INTO professional_pack_import_jobs" in sql:
            return _FakeResult(
                {
                    "id": uuid4(),
                    "status": str((params or {}).get("status") or "ready"),
                    "dry_run": bool((params or {}).get("dry_run", True)),
                    "created_at": "2026-05-05T00:00:00Z",
                }
            )
        if "professional_vertical_runtime_epoch" in sql:
            return _FakeResult({"epoch": 2})
        if "RETURNING" in sql:
            return _FakeResult({"id": uuid4(), **(params or {})})
        return _FakeResult()

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1


class _FakeAdmin:
    def __init__(self, db: _FakeDb) -> None:
        self.db = db
        self.audit_events: list[dict[str, object]] = []

    async def export_vertical_pack(self, vertical_slug: str) -> dict[str, object]:
        return {
            "vertical": {"slug": vertical_slug},
            "module_catalog": [],
            "modules": [],
            "schemas": [],
            "ai_actions": [],
            "photo_presets": [],
            "integrations": [],
        }

    async def _audit(self, **kwargs: object) -> None:
        self.audit_events.append(kwargs)


def test_pack_manifest_requires_vertical_slug() -> None:
    """Pack without vertical.slug must fail validation."""
    svc = ProfessionalWorldsPackService(db=None)  # type: ignore[arg-type]
    errs = svc.validate_manifest({"vertical": {}}, vertical_slug="realtor")
    assert any("slug" in e.lower() for e in errs)


def test_semantic_validation_warns_on_blank_ugs_type_key() -> None:
    """Empty ugs_type_key on an AI action should yield a semantic warning."""
    svc = ProfessionalWorldsPackService(db=None)  # type: ignore[arg-type]
    pack = {
        "vertical": {"slug": "realtor"},
        "ai_actions": [{"action_key": "x", "ugs_type_key": "   "}],
    }
    msgs = svc.semantic_validation(pack)
    assert any("ugs_type_key" in m.lower() for m in msgs)


def test_pack_manifest_rejects_duplicate_action_keys() -> None:
    """Duplicate AI action keys are flagged."""
    svc = ProfessionalWorldsPackService(db=None)  # type: ignore[arg-type]
    pack = {
        "vertical": {"slug": "realtor"},
        "ai_actions": [
            {"action_key": "sales_copy", "module_key": "objects"},
            {"action_key": "sales_copy", "module_key": "objects"},
        ],
    }
    errs = svc.validate_manifest(pack, vertical_slug="realtor")
    assert any("duplicate" in e.lower() for e in errs)


def test_pack_manifest_accepts_supported_schema_versions() -> None:
    """Known schema_version strings pass validation."""
    svc = ProfessionalWorldsPackService(db=None)  # type: ignore[arg-type]
    for ver in ("1", "1.0"):
        pack = {"vertical": {"slug": "realtor"}, "schema_version": ver}
        errs = svc.validate_manifest(pack, vertical_slug="realtor")
        assert not any("schema_version" in e.lower() and "unsupported" in e.lower() for e in errs)


def test_pack_manifest_rejects_unsupported_schema_version() -> None:
    """Unknown schema_version is rejected before import."""
    svc = ProfessionalWorldsPackService(db=None)  # type: ignore[arg-type]
    pack = {"vertical": {"slug": "realtor"}, "schema_version": "99"}
    errs = svc.validate_manifest(pack, vertical_slug="realtor")
    assert any("unsupported schema_version" in e.lower() for e in errs)


def test_pack_manifest_rejects_non_string_schema_version() -> None:
    """schema_version must be a string when present."""
    svc = ProfessionalWorldsPackService(db=None)  # type: ignore[arg-type]
    pack = {"vertical": {"slug": "realtor"}, "schema_version": 1}
    errs = svc.validate_manifest(pack, vertical_slug="realtor")
    assert any("schema_version must be a string" in e.lower() for e in errs)


def test_runtime_config_hash_stable() -> None:
    """Hash helper is deterministic for identical payloads."""
    payload = {"vertical_slug": "realtor", "runtime_epoch": 1, "modules": []}
    assert runtime_config_hash_blob(payload) == runtime_config_hash_blob(payload)


def test_pack_import_dry_run_only_persists_import_job() -> None:
    """Dry-run import stores validation/diff data without mutating config tables."""
    import asyncio

    async def _run() -> _FakeDb:
        db = _FakeDb()
        admin = _FakeAdmin(db)
        svc = ProfessionalWorldsPackService(db=db)  # type: ignore[arg-type]
        await svc.create_import_job(
            admin_user_id=None,
            vertical_slug="realtor",
            manifest={"vertical": {"slug": "realtor"}, "module_catalog": [{"module_key": "leads"}]},
            dry_run=True,
            admin=admin,  # type: ignore[arg-type]
        )
        return db

    db = asyncio.run(_run())
    joined = "\n".join(db.statements)
    assert "INSERT INTO professional_pack_import_jobs" in joined
    assert "INSERT INTO professional_modules" not in joined
    assert "INSERT INTO profession_verticals" not in joined
    assert db.commits == 1


def test_confirmed_pack_import_commits_once_after_all_writes() -> None:
    """Confirmed import applies manifest writes and status/epoch in one commit."""
    import asyncio

    job_id = uuid4()
    import_job = {
        "id": job_id,
        "vertical_slug": "realtor",
        "status": "ready",
        "validation_messages": [],
        "manifest": {
            "vertical": {"slug": "realtor", "name": "Realtor"},
            "module_catalog": [{"module_key": "leads", "name": "Leads"}],
            "modules": [{"module_key": "leads", "sort_order": 10}],
        },
    }

    async def _run() -> tuple[dict[str, object], _FakeDb, _FakeAdmin]:
        db = _FakeDb(import_job=import_job)
        admin = _FakeAdmin(db)
        svc = ProfessionalWorldsPackService(db=db)  # type: ignore[arg-type]
        result = await svc.confirm_import_job(job_id, None, admin)  # type: ignore[arg-type]
        return result, db, admin

    result, db, admin = asyncio.run(_run())
    joined = "\n".join(db.statements)
    assert result == {"ok": True, "epoch": 2}
    assert "INSERT INTO professional_modules" in joined
    assert "UPDATE professional_pack_import_jobs" in joined
    assert db.commits == 1
    assert db.rollbacks == 0
    assert any(event["action"] == "pack_import_apply" for event in admin.audit_events)


def test_confirmed_pack_import_rolls_back_manifest_writes_on_failure() -> None:
    """A failed manifest write is rolled back before marking the import job as errored."""
    import asyncio

    job_id = uuid4()
    import_job = {
        "id": job_id,
        "vertical_slug": "realtor",
        "status": "ready",
        "validation_messages": [],
        "manifest": {
            "vertical": {"slug": "realtor", "name": "Realtor"},
            "module_catalog": [{"module_key": "leads", "name": "Leads"}],
        },
    }

    async def _run() -> tuple[dict[str, object], _FakeDb]:
        db = _FakeDb(import_job=import_job, fail_on="INSERT INTO professional_modules")
        admin = _FakeAdmin(db)
        svc = ProfessionalWorldsPackService(db=db)  # type: ignore[arg-type]
        result = await svc.confirm_import_job(job_id, None, admin)  # type: ignore[arg-type]
        return result, db

    result, db = asyncio.run(_run())
    joined = "\n".join(db.statements)
    assert result["ok"] is False
    assert "simulated import failure" in str(result["error"])
    assert db.rollbacks == 1
    assert db.commits == 1
    assert "SET status = 'error'" in joined


def test_release_rollback_bumps_epoch_and_audits_in_one_commit() -> None:
    """Rollback removes a published release from runtime selection and invalidates cached config."""
    import asyncio

    release_id = uuid4()

    async def _run() -> tuple[dict[str, object] | None, _FakeDb, _FakeAdmin]:
        db = _FakeDb(release_row={"id": release_id, "vertical_slug": "realtor"})
        admin = _FakeAdmin(db)
        svc = ProfessionalWorldsPackService(db=db)  # type: ignore[arg-type]
        result = await svc.rollback_release(None, admin, release_id)  # type: ignore[arg-type]
        return result, db, admin

    result, db, admin = asyncio.run(_run())
    joined = "\n".join(db.statements)
    assert result == {"id": release_id, "vertical_slug": "realtor", "epoch": 2}
    assert "SET status = 'rolled_back'" in joined
    assert "professional_vertical_runtime_epoch" in joined
    assert db.commits == 1
    assert db.rollbacks == 0
    assert any(event["action"] == "release_rollback" for event in admin.audit_events)


def test_rollout_percentage_is_deterministic_per_user() -> None:
    """Percentage rollout decision is stable for a user + vertical pair."""
    import asyncio

    async def _pick() -> tuple[uuid.UUID | None, uuid.UUID | None]:
        fixed_release = uuid.UUID("11111111-1111-1111-1111-111111111111")
        fixed_rollout = uuid.UUID("22222222-2222-2222-2222-222222222222")

        class _RolloutFakeResult:
            def mappings(self) -> _RolloutFakeResult:
                return self

            def all(self) -> list[dict[str, object]]:
                return [
                    {
                        "rollout_id": fixed_rollout,
                        "mode": "percentage",
                        "percentage": 50,
                        "release_id": fixed_release,
                    }
                ]

            def first(self) -> None:
                return None

        class _RolloutFakeDb:
            async def execute(self, *_a, **_kw) -> _RolloutFakeResult:
                return _RolloutFakeResult()

        svc = ProfessionalWorldsPackService(db=_RolloutFakeDb())  # type: ignore[arg-type]
        uid = uuid4()
        first = await svc.resolve_active_release_id(uid, "realtor")
        second = await svc.resolve_active_release_id(uid, "realtor")
        return first, second

    pair = asyncio.run(_pick())
    assert pair[0] == pair[1]


def test_consultant_core_pack_manifest_validates() -> None:
    """Consultant pilot pack manifest passes validation without DB."""
    import json
    from pathlib import Path

    pack_path = Path(__file__).resolve().parent / "fixtures/packs/consultant-core-pack-v1.json"
    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    svc = ProfessionalWorldsPackService(db=None)  # type: ignore[arg-type]
    errs = svc.validate_manifest(pack, vertical_slug="consultant")
    assert not errs
