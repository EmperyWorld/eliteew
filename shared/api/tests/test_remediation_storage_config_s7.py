#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression checks for storage/config hardening remediation.
# Invariants:
# - SeaweedFS incomplete reads fail closed instead of returning partial bytes.
# - Concrete production secrets and UGS admin emails are not hard-coded in source defaults.
# Related:
# - api/services/unified_content/storage_backends/minio_storage.py
# - api/core/unified_config.py
# - api/services/ugs/admin_access.py
# ---
"""Storage and config hardening regression checks."""

from __future__ import annotations

from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parents[1]


def _read(rel_path: str) -> str:
    return (API_ROOT / rel_path).read_text(encoding="utf-8")


@pytest.mark.unit
def test_seaweedfs_incomplete_read_refuses_partial_data() -> None:
    source = _read("services/unified_content/storage_backends/minio_storage.py")
    assert "partial data refused" in source
    assert "using partial data" not in source


@pytest.mark.unit
def test_config_has_no_concrete_secret_defaults() -> None:
    source = _read("core/unified_config.py")
    assert 'database_password: str = Field(\n        default=""' in source
    assert 'minio_secret_key: str = Field(\n        default=""' in source
    assert "B6TqbYWX8dVXOJ0VuolusVhjlcriDwwt" not in source


@pytest.mark.unit
def test_ugs_admin_email_policy_is_env_backed() -> None:
    source = _read("services/ugs/admin_access.py")
    body = source.split("from __future__ import annotations", 1)[-1]
    assert 'os.getenv("UGS_ADMIN_EMAILS", "")' in source
    assert "keysray70@gmail.com" not in body
    assert "4004tz@gmail.com" not in body
