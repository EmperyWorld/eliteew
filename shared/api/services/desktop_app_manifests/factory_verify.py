# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# App factory DoD gates (Wave F2): D1 mount quality, D2 registry/resolve,
# D3 manifest parity — machine verify, not agent narrative.
# Invariants:
# - PASSED only when D1∧D2∧D3 pass for a manifest-backed Desktop app.
# - Scaffold stub phrases fail D1.
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md
# - scripts/eliteew/verify-app-factory.sh
# - shell/appMounts.registry.ts
# ---

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from api.services.desktop_app_manifests.loader import (
    apps_root,
    build_known_desktop_app_components,
    load_manifests,
)

_STUB_PHRASES = (
    "Scaffold stub",
    "Scaffolded desktop mount",
    "Coming soon",
    "TODO implement",
    "Replace with product UI",
    "REPLACE_TITLE",
    "ReplacePascalApp",
)

_FAKE_PHRASES = (
    "FakeAI",
    "FakeNervas",
    "DEMO_PASSED",
)


@dataclass
class GateResult:
    gate: str
    ok: bool
    detail: str


@dataclass
class AppFactoryVerifyReport:
    app_id: str
    app_component: str
    status: str  # PASSED | FAILED
    gates: list[GateResult] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.status == "PASSED"


def monorepo_root_from_apps(root: Path | None = None) -> Path:
    base = root or apps_root()
    # shared/apps → shared → monorepo
    return base.parent.parent


def _frontend_desktop(root: Path) -> Path:
    return root / "shared" / "web" / "frontend" / "src" / "pages" / "Desktop"


def _read_mount_sets(desktop: Path) -> tuple[set[str], set[str]]:
    registry = desktop / "shell" / "appMounts.registry.ts"
    if not registry.is_file():
        raise ValueError(f"missing mount registry: {registry}")
    text = registry.read_text(encoding="utf-8")
    mounted_ids: set[str] = set()
    unmounted_ids: set[str] = set()
    in_mounted = False
    in_unmounted = False
    for line in text.splitlines():
        if "APP_UNMOUNTED_COMPONENTS" in line and "=" in line:
            in_unmounted = True
            in_mounted = False
            continue
        if "APP_MOUNTED_COMPONENTS" in line and "=" in line:
            in_mounted = True
            in_unmounted = False
            continue
        if in_mounted or in_unmounted:
            if "]" in line and "as const" in line:
                in_mounted = False
                in_unmounted = False
                continue
            for m in re.finditer(r"'([^']+)'", line):
                if in_mounted:
                    mounted_ids.add(m.group(1))
                elif in_unmounted:
                    unmounted_ids.add(m.group(1))
    if not mounted_ids:
        raise ValueError(f"could not parse APP_MOUNTED_COMPONENTS from {registry}")
    return mounted_ids, unmounted_ids


def _candidate_ui_paths(desktop: Path, app_component: str) -> list[Path]:
    """Likely FE sources for a Desktop app component."""
    candidates = [
        desktop / "apps" / f"{app_component}.tsx",
        desktop / "apps" / app_component / f"{app_component}.tsx",
        desktop / "components" / f"{app_component}.tsx",
    ]
    # NotificationsApp → NotificationsDesktopApp.tsx
    if app_component.endswith("App"):
        stem = app_component[: -len("App")]
        candidates.append(desktop / "components" / f"{stem}DesktopApp.tsx")
        candidates.append(desktop / "components" / f"{app_component}.tsx")
    return candidates


def _d1_find_ui_source(desktop: Path, app_component: str) -> Path | None:
    for path in _candidate_ui_paths(desktop, app_component):
        if path.is_file():
            return path
    return None


def _d1_stub_or_fake(text: str) -> str | None:
    for phrase in _STUB_PHRASES:
        if phrase in text:
            return f"stub phrase {phrase!r}"
    for phrase in _FAKE_PHRASES:
        if phrase in text:
            return f"forbidden phrase {phrase!r}"
    return None


def verify_app_factory(
    app_id: str,
    *,
    apps: Path | None = None,
    monorepo: Path | None = None,
) -> AppFactoryVerifyReport:
    """Verify one manifest id (shared/apps/<id>)."""
    base = apps or apps_root()
    root = monorepo or monorepo_root_from_apps(base)
    manifests = {m.id: m for m in load_manifests(base)}
    if app_id not in manifests:
        return AppFactoryVerifyReport(
            app_id=app_id,
            app_component="",
            status="FAILED",
            gates=[GateResult("D3", False, f"manifest missing: shared/apps/{app_id}/app.manifest.yaml")],
        )

    m = manifests[app_id]
    component = m.surfaces.desktop.app_component
    known = build_known_desktop_app_components(base)
    desktop = _frontend_desktop(root)
    mounted, unmounted = _read_mount_sets(desktop)
    resolve_path = desktop / "shell" / "appMounts.resolve.tsx"
    resolve_text = resolve_path.read_text(encoding="utf-8") if resolve_path.is_file() else ""
    catalog_text = (desktop / "shell" / "appRegistry.catalog.ts").read_text(encoding="utf-8")

    gates: list[GateResult] = []

    # D3 — manifest SoT + KNOWN membership
    if component not in known:
        gates.append(GateResult("D3", False, f"app_component {component!r} not in API KNOWN"))
    else:
        gates.append(
            GateResult(
                "D3",
                True,
                f"manifest id={app_id} app_component={component}",
            )
        )

    # D2 — mount registry + resolve case
    d2_ok = True
    d2_bits: list[str] = []
    if component in unmounted:
        d2_ok = False
        d2_bits.append("listed in APP_UNMOUNTED_COMPONENTS")
    if component not in mounted:
        d2_ok = False
        d2_bits.append("missing from APP_MOUNTED_COMPONENTS")
    case_pat = re.compile(rf"case\s+'{re.escape(component)}'\s*:")
    if not case_pat.search(resolve_text):
        d2_ok = False
        d2_bits.append("missing case in appMounts.resolve.tsx")
    if component not in catalog_text:
        d2_ok = False
        d2_bits.append("missing from appRegistry.catalog.ts (U1)")
    gates.append(
        GateResult(
            "D2",
            d2_ok,
            "ok registry+resolve+U1" if d2_ok else "; ".join(d2_bits),
        )
    )

    # D1 — UI source quality (or resolve-only mount adapters without apps/ file)
    ui_path = _d1_find_ui_source(desktop, component)
    if ui_path is None:
        # Mount adapters in mounts.tsx / resolve still count if D2 passed and resolve has real case
        if d2_ok and case_pat.search(resolve_text):
            gates.append(
                GateResult(
                    "D1",
                    True,
                    "no dedicated apps/*.tsx — covered by resolve/mount adapter",
                )
            )
        else:
            gates.append(
                GateResult(
                    "D1",
                    False,
                    f"no UI source under apps/ or components/ for {component}",
                )
            )
    else:
        ui_text = ui_path.read_text(encoding="utf-8")
        bad = _d1_stub_or_fake(ui_text)
        if bad:
            gates.append(GateResult("D1", False, f"{ui_path.relative_to(root)}: {bad}"))
        else:
            gates.append(GateResult("D1", True, f"ui={ui_path.relative_to(root)}"))

    status = "PASSED" if all(g.ok for g in gates) else "FAILED"
    return AppFactoryVerifyReport(
        app_id=app_id,
        app_component=component,
        status=status,
        gates=gates,
    )


def verify_apps(app_ids: list[str], *, apps: Path | None = None) -> list[AppFactoryVerifyReport]:
    return [verify_app_factory(app_id, apps=apps) for app_id in app_ids]


def format_report(report: AppFactoryVerifyReport) -> str:
    lines = [f"app_id={report.app_id} app_component={report.app_component} verify_status={report.status}"]
    for g in report.gates:
        mark = "PASS" if g.ok else "FAIL"
        lines.append(f"  [{mark}] {g.gate}: {g.detail}")
    return "\n".join(lines)
