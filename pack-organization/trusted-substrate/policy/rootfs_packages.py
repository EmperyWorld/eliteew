# Purpose: Fail-closed allowlist for Buildroot packages enabled in Trusted Substrate W4.
# Related: config/buildroot/package-allowlist · plan W4

"""Gate BR2_PACKAGE_*=y symbols against the living package allowlist."""

from __future__ import annotations

from pathlib import Path


class RootfsPackageError(ValueError):
    """Unknown or empty package enablement."""


def load_package_allowlist(path: Path) -> frozenset[str]:
    names: set[str] = set()
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        # allow "NAME" or "NAME SPDX"
        name = line.split()[0]
        names.add(name)
    if not names:
        raise RootfsPackageError("package_allowlist_empty")
    return frozenset(names)


def enabled_br2_packages(config_text: str) -> list[str]:
    """Return package short names for lines BR2_PACKAGE_FOO=y (not =m / is not set)."""
    found: list[str] = []
    for raw in config_text.splitlines():
        line = raw.strip()
        if not line.startswith("BR2_PACKAGE_") or not line.endswith("=y"):
            continue
        if line.startswith("#"):
            continue
        key = line[len("BR2_PACKAGE_") : -len("=y")]
        if not key or key.endswith("_"):
            continue
        # Skip menu/meta knobs that are not packages if needed — keep all FOO=y
        found.append(key)
    return found


def assert_packages_allowed(
    enabled: list[str],
    allowlist: frozenset[str],
) -> None:
    if not enabled:
        raise RootfsPackageError("no_packages_enabled")
    bad = sorted({name for name in enabled if name not in allowlist})
    if bad:
        raise RootfsPackageError(f"packages_not_allowed: {','.join(bad)}")


def gate_config_text(config_text: str, allowlist_path: Path) -> list[str]:
    allow = load_package_allowlist(allowlist_path)
    enabled = enabled_br2_packages(config_text)
    assert_packages_allowed(enabled, allow)
    return enabled
