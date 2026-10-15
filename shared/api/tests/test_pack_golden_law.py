# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Narrow locks for Wave F4 P18 pack golden law.
# Invariants:
# - Living registry product packs have PASSED reports; draft packs stay inactive.
# Related:
# - api.services.desktop_app_manifests.pack_golden_law
# ---

from __future__ import annotations

from pathlib import Path

from api.services.desktop_app_manifests import pack_golden_law as law


def _repo() -> Path:
    # tests run with cwd shared/api via pytest wrapper
    return law.monorepo_root(Path.cwd())


def test_inactive_product_packs_are_draft_only() -> None:
    # Living goldens active; catalog drafts without product_goldens stay inactive.
    assert law.inactive_product_packs(repo=_repo()) == ["image_studio", "site_studio"]


def test_notifications_active_via_golden() -> None:
    repo = _repo()
    assert law.pack_has_passed_golden("notifications", repo=repo)
    assert law.is_pack_assembly_active("notifications", repo=repo)


def test_draft_packs_not_assembly_active() -> None:
    repo = _repo()
    assert not law.is_pack_assembly_active("image_studio", repo=repo)
    assert not law.is_pack_assembly_active("site_studio", repo=repo)


def test_law_packs_always_active() -> None:
    repo = _repo()
    assert law.is_pack_assembly_active("service_factory", repo=repo)
    assert law.is_pack_assembly_active("verify_gates", repo=repo)
    assert law.is_pack_assembly_active("module_anatomy", repo=repo)
    assert law.is_pack_assembly_active("desktop_shell_kernel", repo=repo)


def test_draft_image_studio_not_in_product_goldens() -> None:
    data = law.load_pack_golden_registry(_repo())
    goldens = data.get("product_goldens") or {}
    assert "image_studio" not in goldens
    assert "site_studio" not in goldens


def test_filter_drops_inactive_product(tmp_path: Path) -> None:
    orch = tmp_path / ".cursor" / "orchestration"
    recipes = orch / "recipes"
    reports = orch / "reports"
    recipes.mkdir(parents=True)
    reports.mkdir(parents=True)
    (recipes / "pack_golden_registry.yaml").write_text(
        "always_active:\n  - service_factory\nproduct_goldens:\n  notifications:\n    - missing.md\n",
        encoding="utf-8",
    )
    (recipes / "atom_catalog.yaml").write_text(
        "packs:\n  - pack: notifications\n",
        encoding="utf-8",
    )
    (tmp_path / "EliteEW").mkdir()
    (tmp_path / ".cursor").mkdir(exist_ok=True)
    law.clear_registry_cache()
    assert not law.is_pack_assembly_active("notifications", repo=tmp_path)
    assert law.filter_active_pack_stems(
        ["service_factory", "notifications"],
        repo=tmp_path,
    ) == ["service_factory"]
    law.clear_registry_cache()
