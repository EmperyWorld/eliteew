# Purpose: Parse toolchain/PINS and validate rows for Trusted Substrate W3.
# Related: toolchain/PINS · scripts/toolchain-fetch.sh

"""Pinned toolchain source rows (fail closed on malformed pins)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


class PinsError(ValueError):
    """Invalid PINS file."""


@dataclass(frozen=True)
class PinRow:
    name: str
    version: str
    archive: str
    url: str
    sha256: str
    spdx: str


def parse_pins(path: Path) -> list[PinRow]:
    rows: list[PinRow] = []
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) != 6:
            raise PinsError(f"pins_bad_columns:{lineno}")
        name, version, archive, url, sha256, spdx = parts
        if len(sha256) != 64 or any(c not in "0123456789abcdef" for c in sha256.lower()):
            raise PinsError(f"pins_bad_sha256:{name}")
        if not url.startswith("https://"):
            raise PinsError(f"pins_url_not_https:{name}")
        rows.append(
            PinRow(
                name=name,
                version=version,
                archive=archive,
                url=url,
                sha256=sha256.lower(),
                spdx=spdx,
            )
        )
    if not rows:
        raise PinsError("pins_empty")
    names = [r.name for r in rows]
    if len(names) != len(set(names)):
        raise PinsError("pins_duplicate_name")
    return rows


def required_names() -> frozenset[str]:
    return frozenset({"binutils", "gmp", "mpfr", "mpc", "gcc"})


def assert_required_pins(rows: list[PinRow]) -> None:
    have = {r.name for r in rows}
    missing = required_names() - have
    if missing:
        raise PinsError(f"pins_missing:{','.join(sorted(missing))}")
