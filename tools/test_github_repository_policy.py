# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock GitHub repository placement against the living canon and the README URL.
# Invariants:
# - Prod ciphertext, agent configuration, APK dumps, and retired archives do
#   not classify as shared public source.
# - Shell media classifies as present in both repositories.
# Related:
# - tools/github_repository_policy.py
# - documentation/platform/ELITEEW-GITHUB-REPOSITORY.md
# ---
"""Contract locks for EliteEW GitHub repository placement."""

from __future__ import annotations

from pathlib import Path

from github_repository_policy import (
    COMMAND_CENTER_HOST,
    COMMUNITY_EDITION,
    COMMUNITY_INSTALL_SCRIPT,
    COMMUNITY_PROFILE,
    DEVELOPMENT_REPOSITORY,
    PROD_RUNTIME_HOST,
    PUBLIC_REPOSITORY,
    PUBLIC_SOURCE_URL,
    Placement,
    classify_repo_path,
    is_product_media,
)

ROOT = Path(__file__).resolve().parents[1]


def test_repository_ids_match_canon() -> None:
    sot = (ROOT / "documentation/platform/ELITEEW-GITHUB-REPOSITORY.md").read_text(
        encoding="utf-8"
    )
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert PUBLIC_REPOSITORY == "EmperyWorld/eliteew"
    assert DEVELOPMENT_REPOSITORY == "EmperyWorld/eliteew-dev"
    assert PUBLIC_SOURCE_URL == "https://github.com/EmperyWorld/eliteew"
    assert PUBLIC_SOURCE_URL in sot
    assert DEVELOPMENT_REPOSITORY in sot
    assert PUBLIC_SOURCE_URL in readme


def test_development_only_paths_stay_out_of_the_public_export() -> None:
    samples = [
        "docker/env_file/bundles/prod-core.env.tar.sops",
        "docker/env_file/bundles/.sops.yaml",
        ".cursor/hooks/language-bridge-gate.py",
        ".cursor/rules/project-and-deploy.mdc",
    ]
    for path in samples:
        assert classify_repo_path(path) is Placement.DEVELOPMENT_ONLY
        assert is_product_media(path) is False


def test_excluded_paths_are_in_neither_repository() -> None:
    samples = [
        "pack-cloud/mobile/adb_exports/openvpn/base.apk",
        "tg_bot_ip_verif/assets/app-prod-release.zip",
    ]
    for path in samples:
        assert classify_repo_path(path) is Placement.NEITHER


def test_shell_media_and_source_are_in_both_repositories() -> None:
    media = [
        "shared/web/frontend/public/audio/desktop-welcome-guide/ru/intro.wav",
        "shared/web/frontend/public/ewa/arly_transform.mp4",
        "shared/web/landing/kuku2.mp4",
    ]
    for path in media:
        assert classify_repo_path(path) is Placement.BOTH
        assert is_product_media(path) is True
    source = [
        "shared/api/main.py",
        "docker/scripts/eliteew-deploy.sh",
        COMMUNITY_INSTALL_SCRIPT,
        "documentation/platform/ELITEEW-GITHUB-REPOSITORY.md",
    ]
    for path in source:
        assert classify_repo_path(path) is Placement.BOTH
        assert is_product_media(path) is False


def test_community_install_constants() -> None:
    assert COMMUNITY_EDITION == "onprem"
    assert COMMUNITY_PROFILE == "onprem-team-core"
    assert COMMUNITY_INSTALL_SCRIPT == "scripts/eliteew/install-community.sh"
    assert PROD_RUNTIME_HOST == "192.168.1.111"
    assert COMMAND_CENTER_HOST == "192.168.1.136"
    sot = (ROOT / "documentation/platform/ELITEEW-GITHUB-REPOSITORY.md").read_text(
        encoding="utf-8"
    )
    assert COMMUNITY_INSTALL_SCRIPT in sot
    assert f"ELITEEW_PRODUCT_EDITION={COMMUNITY_EDITION}" in sot
    assert f"ELITEEW_INSTALL_PROFILE={COMMUNITY_PROFILE}" in sot


def test_history_drop_paths_match_the_canon() -> None:
    from github_repository_policy import history_drop_paths

    assert history_drop_paths(Placement.NEITHER) == (
        "pack-cloud/mobile/adb_exports",
        "tg_bot_ip_verif",
    )
    assert history_drop_paths(Placement.NEITHER, Placement.DEVELOPMENT_ONLY) == (
        "pack-cloud/mobile/adb_exports",
        "tg_bot_ip_verif",
        "docker/env_file/bundles/prod-core.env.tar.sops",
        "docker/env_file/bundles/.sops.yaml",
        ".cursor",
    )
    try:
        history_drop_paths(Placement.BOTH)
    except ValueError as exc:
        assert "cannot be dropped" in str(exc)
    else:
        raise AssertionError("BOTH must not be a history drop")


def test_index_violations_flag_private_paths() -> None:
    from github_repository_policy import index_violations

    public_ok = frozenset({Placement.BOTH})
    violations = index_violations(
        [
            "shared/api/main.py",
            "docker/env_file/bundles/prod-core.env.tar.sops",
            ".cursor/hooks/README.md",
        ],
        allowed=public_ok,
    )
    assert violations == [
        "docker/env_file/bundles/prod-core.env.tar.sops",
        ".cursor/hooks/README.md",
    ]


def test_history_export_selftest_filters_a_real_repository() -> None:
    import subprocess

    script = ROOT / "scripts/eliteew/github-history-export.sh"
    completed = subprocess.run(
        ["bash", str(script), "--selftest"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr + completed.stdout
    assert "github_history_export_selftest_ok" in completed.stdout


def test_empty_path_is_rejected() -> None:
    try:
        classify_repo_path("   ")
    except ValueError as exc:
        assert "empty" in str(exc)
    else:
        raise AssertionError("empty path must raise ValueError")
