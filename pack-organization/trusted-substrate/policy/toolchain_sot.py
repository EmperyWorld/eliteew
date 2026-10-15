# Purpose: Enforce EliteEW W3 toolchain as SoT for W4 Buildroot factory builds.
# Related: docs/TOOLCHAIN-FROM-SOURCE.md · plan W4

"""Refuse host distro compiler as source of truth for from-source rootfs builds."""

from __future__ import annotations

from pathlib import Path


class ToolchainSotError(ValueError):
    """W3 toolchain prefix unusable or missing for release factory path."""


def assert_eliteew_toolchain_sot(prefix: Path) -> Path:
    """Require PREFIX/bin/gcc and PREFIX/etc/eliteew-ts-toolchain.identity."""
    gcc = prefix / "bin" / "gcc"
    identity = prefix / "etc" / "eliteew-ts-toolchain.identity"
    envf = prefix / "etc" / "eliteew-ts-toolchain.env"
    if not gcc.is_file():
        raise ToolchainSotError(f"missing_gcc: {gcc}")
    if not identity.is_file():
        raise ToolchainSotError(f"missing_identity: {identity}")
    if not envf.is_file():
        raise ToolchainSotError(f"missing_env: {envf}")
    text = envf.read_text(encoding="utf-8")
    if "toolchain_bootstrap=" not in text:
        raise ToolchainSotError("env_missing_bootstrap_label")
    return gcc
