# Purpose: Fail-closed SPDX allowlist gate for Trusted Substrate trust perimeter.
# Related: licenses/ALLOWLIST · ELITEEW-TRUSTED-SUBSTRATE.md §6.2 · plan W3

"""Load ALLOWLIST and reject unknown SPDX identifiers."""

from __future__ import annotations

from pathlib import Path


class SpdxAllowlistError(ValueError):
    """Unknown or empty SPDX id."""


def load_allowlist(path: Path) -> frozenset[str]:
    ids: set[str] = set()
    text = path.read_text(encoding="utf-8")
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        ids.add(line)
    if not ids:
        raise SpdxAllowlistError("allowlist_empty")
    return frozenset(ids)


def assert_spdx_allowed(spdx_id: str, allowlist: frozenset[str]) -> None:
    cleaned = (spdx_id or "").strip()
    if not cleaned:
        raise SpdxAllowlistError("spdx_empty")
    # Allow AND expressions used in SPDX expressions (simple split)
    parts = [p.strip() for p in cleaned.replace(" OR ", " AND ").split(" AND ")]
    for part in parts:
        part = part.strip("()")
        if not part:
            continue
        if part not in allowlist:
            raise SpdxAllowlistError(f"spdx_not_allowed: {part}")


def gate_manifest_rows(
    rows: list[tuple[str, str]],
    allowlist: frozenset[str],
) -> None:
    """rows: (package_name, spdx_id). Fail closed on first violation."""
    if not rows:
        raise SpdxAllowlistError("manifest_empty")
    for name, spdx in rows:
        try:
            assert_spdx_allowed(spdx, allowlist)
        except SpdxAllowlistError as exc:
            raise SpdxAllowlistError(f"{name}: {exc}") from exc
