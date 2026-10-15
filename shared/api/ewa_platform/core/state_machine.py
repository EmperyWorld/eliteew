# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Names and guards for orchestration session state transitions (pure functions, no I/O). Also exposes a
# **dry-run simulator** for companion desktop actions (project «Mela's Ascension», Module C3) so the
# orchestrator can validate a proposed action list against simple invariants — open-app fan-out limit,
# theme/wallpaper rate-limit — before dispatch.
# Invariants:
# - Pure functions; no I/O. The simulator does **not** persist anything.
# - Backward compatible: when ``SimulationState`` carries no history, the simulator is permissive — only
#   per-turn limits are enforced.
# - Violations are **descriptive**; callers decide whether to drop the offending action or to surface the
#   reason in chat.
# Related:
# - api/ewa_platform/contracts/orchestration.py
# - api/ewa_platform/core/transitions.py
# - api/services/ewa_companion/actions.py (allowed types)
# - api/ewa_platform/companion/actions/ambient.py
# ---
"""Phase transition guards for lifecycle phases + companion action dry-run simulator."""

from __future__ import annotations

import os
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from api.ewa_platform.contracts.orchestration import OrchestrationPhase

VALID_TRANSITIONS: frozenset[tuple[OrchestrationPhase, OrchestrationPhase]] = frozenset(
    {
        (OrchestrationPhase.IDLE, OrchestrationPhase.PLANNING),
        (OrchestrationPhase.PLANNING, OrchestrationPhase.EXECUTING),
        (OrchestrationPhase.PLANNING, OrchestrationPhase.AWAITING_USER),
        (OrchestrationPhase.EXECUTING, OrchestrationPhase.COMPLETED),
        (OrchestrationPhase.EXECUTING, OrchestrationPhase.FAILED),
        (OrchestrationPhase.AWAITING_USER, OrchestrationPhase.EXECUTING),
        (OrchestrationPhase.AWAITING_USER, OrchestrationPhase.FAILED),
    }
)


def can_transition(current: OrchestrationPhase, target: OrchestrationPhase) -> bool:
    """Return True if ``(current, target)`` is explicitly allowed."""

    return (current, target) in VALID_TRANSITIONS


# ---------------------------------------------------------------------------
# Companion action dry-run simulator (Module C3, «Mela's Ascension»)
# ---------------------------------------------------------------------------

MAX_OPEN_APPS_DEFAULT: int = 8
THEME_CHANGE_MIN_INTERVAL_SEC_DEFAULT: int = 60
WALLPAPER_CHANGE_MIN_INTERVAL_SEC_DEFAULT: int = 30


@dataclass(frozen=True)
class SimulationState:
    """Snapshot of relevant desktop state for dry-run validation."""

    open_app_components: tuple[str, ...] = ()
    last_theme_change_iso: str | None = None
    last_wallpaper_change_iso: str | None = None
    now_iso: str | None = None  # If None, ``datetime.now(UTC)`` is used.


@dataclass(frozen=True)
class SimulationViolation:
    """Reason an action was dropped."""

    action_index: int
    action_type: str
    code: str
    message: str


@dataclass(frozen=True)
class SimulationResult:
    """Outcome of a dry-run pass."""

    accepted_actions: list[dict[str, Any]] = field(default_factory=list)
    violations: list[SimulationViolation] = field(default_factory=list)


def action_validation_enabled() -> bool:
    return os.getenv("EWA_COMPANION_ACTION_VALIDATION_ENABLED", "false").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _parse_iso(iso: str | None) -> datetime | None:
    if not iso or not isinstance(iso, str):
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None


def _resolve_now(state: SimulationState) -> datetime:
    parsed = _parse_iso(state.now_iso)
    return parsed or datetime.now(UTC)


def simulate(
    actions: Iterable[Mapping[str, Any]],
    current_state: SimulationState | None = None,
    *,
    max_open_apps: int = MAX_OPEN_APPS_DEFAULT,
    theme_change_min_interval_sec: int = THEME_CHANGE_MIN_INTERVAL_SEC_DEFAULT,
    wallpaper_change_min_interval_sec: int = WALLPAPER_CHANGE_MIN_INTERVAL_SEC_DEFAULT,
) -> SimulationResult:
    """Dry-run validate ``actions`` against ``current_state`` invariants. Never raises.

    Invariants enforced:
    - ``open_app`` actions cannot push the simultaneous open count above ``max_open_apps``.
    - ``patch_desktop_config`` with ``theme`` honours ``theme_change_min_interval_sec`` versus
      ``current_state.last_theme_change_iso``.
    - ``patch_desktop_config`` with ``wallpaper`` honours ``wallpaper_change_min_interval_sec``.
    - Only one ``patch_desktop_config`` row per turn (later duplicates are dropped).

    The list of accepted actions is returned in the original order. Order matters for invariants:
    the simulator updates the running «open set» as it accepts ``open_app`` / ``close_app`` rows.
    """

    state = current_state or SimulationState()
    now = _resolve_now(state)

    open_components: set[str] = {str(c) for c in state.open_app_components if c}
    accepted: list[dict[str, Any]] = []
    violations: list[SimulationViolation] = []

    seen_patch_desktop_config = False
    last_theme_dt = _parse_iso(state.last_theme_change_iso)
    last_wallpaper_dt = _parse_iso(state.last_wallpaper_change_iso)

    for idx, raw in enumerate(actions):
        if not isinstance(raw, Mapping):
            continue
        action_type = str(raw.get("type") or "").strip().lower()
        if action_type == "open_app":
            component = str(raw.get("app_component") or "").strip()
            if not component:
                violations.append(
                    SimulationViolation(idx, action_type, "missing_app_component", "open_app without app_component")
                )
                continue
            projected = open_components | {component}
            if len(projected) > max_open_apps:
                violations.append(
                    SimulationViolation(
                        idx,
                        action_type,
                        "open_apps_fanout_exceeded",
                        f"max_open_apps={max_open_apps} would be exceeded by {component}",
                    )
                )
                continue
            open_components = projected
            accepted.append(dict(raw))
            continue
        if action_type == "close_app":
            component = str(raw.get("app_component") or "").strip()
            if component:
                open_components.discard(component)
            accepted.append(dict(raw))
            continue
        if action_type == "patch_desktop_config":
            if seen_patch_desktop_config:
                violations.append(
                    SimulationViolation(idx, action_type, "duplicate_patch_desktop_config", "only one patch per turn")
                )
                continue
            patch = raw.get("patch") if isinstance(raw, Mapping) else None
            if isinstance(patch, Mapping):
                if "theme" in patch and last_theme_dt is not None:
                    delta = (now - last_theme_dt).total_seconds()
                    if delta < float(theme_change_min_interval_sec):
                        violations.append(
                            SimulationViolation(
                                idx,
                                action_type,
                                "theme_rate_limit",
                                f"theme changed {int(delta)}s ago < {theme_change_min_interval_sec}s",
                            )
                        )
                        continue
                if "wallpaper" in patch and last_wallpaper_dt is not None:
                    delta_w = (now - last_wallpaper_dt).total_seconds()
                    if delta_w < float(wallpaper_change_min_interval_sec):
                        violations.append(
                            SimulationViolation(
                                idx,
                                action_type,
                                "wallpaper_rate_limit",
                                f"wallpaper changed {int(delta_w)}s ago < {wallpaper_change_min_interval_sec}s",
                            )
                        )
                        continue
            seen_patch_desktop_config = True
            accepted.append(dict(raw))
            continue
        accepted.append(dict(raw))

    return SimulationResult(accepted_actions=accepted, violations=violations)


def simulation_state_from_shell(
    shell_norm: Mapping[str, Any] | None,
    *,
    last_theme_change_iso: str | None = None,
    last_wallpaper_change_iso: str | None = None,
) -> SimulationState:
    """Build a ``SimulationState`` from a normalized shell snapshot.

    The accepted shape mirrors ``EwaCompanionShellContextV1.open_windows`` — a list of mappings each
    carrying ``app_component``. Unknown shapes are ignored silently.
    """

    components: list[str] = []
    if isinstance(shell_norm, Mapping):
        open_windows = shell_norm.get("open_windows")
        if isinstance(open_windows, list):
            for win in open_windows:
                if isinstance(win, Mapping):
                    comp = str(win.get("app_component") or "").strip()
                    if comp:
                        components.append(comp)
    return SimulationState(
        open_app_components=tuple(components),
        last_theme_change_iso=last_theme_change_iso,
        last_wallpaper_change_iso=last_wallpaper_change_iso,
    )
