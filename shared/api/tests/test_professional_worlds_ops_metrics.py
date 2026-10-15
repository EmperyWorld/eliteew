# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Professional Worlds ops metrics service (read-only aggregates).
# Related:
# - api/services/professional_worlds/ops_metrics_service.py
# ---

from __future__ import annotations

import pytest

from api.services.professional_worlds.ops_metrics_service import (
    build_ops_metrics,
    build_ops_probes,
    load_runtime_overview,
)


class _FakeMappings:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def one(self) -> dict[str, object]:
        assert len(self._rows) == 1
        return self._rows[0]

    def all(self) -> list[dict[str, object]]:
        return self._rows


class _FakeResult:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._rows)


class _FakeDb:
    def __init__(self, *, fail_select: bool = False) -> None:
        self.fail_select = fail_select
        self.statements: list[str] = []

    async def execute(self, statement: object, params: dict[str, object] | None = None) -> _FakeResult:
        sql = str(statement)
        self.statements.append(sql)
        if self.fail_select and "SELECT 1" in sql:
            raise RuntimeError("db down")
        if "playbook_runs_24h" in sql:
            return _FakeResult(
                [
                    {
                        "playbook_runs_24h": 3,
                        "playbook_runs_failed_24h": 1,
                        "artifacts_24h": 5,
                        "credits_used_24h": 2.5,
                        "media_job_errors_24h": 2,
                        "api_error_rate_24h": 12.5,
                    }
                ]
            )
        if "generation_types" in sql and "type_count" in sql:
            return _FakeResult([{"type_count": 4}])
        if "provider_health_log" in sql:
            return _FakeResult([{"provider_count": 2, "unhealthy_count": 0}])
        if "GROUP BY vertical_slug" in sql:
            return _FakeResult(
                [
                    {"vertical_slug": "consultant", "runs_24h": 2, "failed_24h": 0},
                    {"vertical_slug": "realtor", "runs_24h": 1, "failed_24h": 1},
                ]
            )
        return _FakeResult([{}])


@pytest.mark.asyncio
async def test_load_runtime_overview_parses_credits_float() -> None:
    db = _FakeDb()
    row = await load_runtime_overview(db)  # type: ignore[arg-type]
    assert row["playbook_runs_24h"] == 3
    assert row["credits_used_24h"] == 2.5
    assert row["failed_playbook_runs_24h"] == 1
    assert row["media_job_errors_24h"] == 2
    assert row["api_error_rate_24h"] == 12.5


@pytest.mark.asyncio
async def test_build_ops_probes_includes_ugs_probe() -> None:
    db = _FakeDb()
    probes = await build_ops_probes(db)  # type: ignore[arg-type]
    assert len(probes) == 2
    assert probes[1]["id"] == "ugs"
    assert probes[1]["ok"] is True


@pytest.mark.asyncio
async def test_build_ops_probes_marks_postgres_failure() -> None:
    db = _FakeDb(fail_select=True)
    probes = await build_ops_probes(db)  # type: ignore[arg-type]
    assert probes[0]["id"] == "postgres"
    assert probes[0]["ok"] is False


@pytest.mark.asyncio
async def test_build_ops_probes_marks_ugs_degraded_when_enabled_providers_unhealthy() -> None:
    class _UgsUnhealthyDb(_FakeDb):
        async def execute(self, statement: object, params: dict[str, object] | None = None) -> _FakeResult:
            sql = str(statement)
            if "provider_health_log" in sql:
                return _FakeResult([{"provider_count": 2, "unhealthy_count": 1}])
            return await super().execute(statement, params)

    probes = await build_ops_probes(_UgsUnhealthyDb())  # type: ignore[arg-type]
    ugs = probes[1]
    assert ugs["id"] == "ugs"
    assert ugs["ok"] is False
    assert "degraded" in str(ugs["message"])


@pytest.mark.asyncio
async def test_build_ops_probes_ugs_ok_without_enabled_health_rows() -> None:
    class _UgsNoLogDb(_FakeDb):
        async def execute(self, statement: object, params: dict[str, object] | None = None) -> _FakeResult:
            sql = str(statement)
            if "provider_health_log" in sql:
                return _FakeResult([{"provider_count": 0, "unhealthy_count": 0}])
            return await super().execute(statement, params)

    probes = await build_ops_probes(_UgsNoLogDb())  # type: ignore[arg-type]
    assert probes[1]["ok"] is True
    assert "no recent enabled-provider health rows" in str(probes[1]["message"])


@pytest.mark.asyncio
async def test_build_ops_metrics_composes_payload() -> None:
    db = _FakeDb()
    payload = await build_ops_metrics(db)  # type: ignore[arg-type]
    assert payload["runtime"]["artifacts_24h"] == 5
    assert len(payload["by_vertical"]) == 2
    assert payload["probes"][0]["ok"] is True
