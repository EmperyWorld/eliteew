# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ops CLI for stack0 release maintenance windows: Redis upsert/phase/clear without admin OAuth.
# Invariants:
# - Never overwrite a non-deploy-owned effective window.
# - When CLI notice/duration/title/message omitted → load Postgres deploy defaults + render templates.
# - starts_at=now+notice; expected_ends_at=starts_at+downtime; retry_after=downtime.
# Related:
# - api/services/maintenance_service.py
# - api/services/maintenance_deploy_defaults.py
# - docker/scripts/eliteew-maintenance-window.sh
# - documentation/platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md
# ---
"""Deploy-owned maintenance window control (no admin HTTP).

Typical use on prod-core while API container is running:

  podman exec stack0-eliteew-api-prod-baked \\
    python /app/api/scripts/maintenance_deploy_ctl.py upsert-warning \\
      --window-id deploy-prod-baked-20260808-1504
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

_REPO_OR_APP = Path(__file__).resolve().parent.parent.parent
if str(_REPO_OR_APP) not in sys.path:
    sys.path.insert(0, str(_REPO_OR_APP))

from api.schemas.maintenance import (  # noqa: E402
    MaintenanceDeployDefaults,
    MaintenanceKind,
    MaintenancePhase,
    MaintenanceWindowUpsert,
)
from api.services.maintenance_deploy_defaults import (  # noqa: E402
    compute_window_schedule,
    load_deploy_defaults,
    render_deploy_copy,
)
from api.services.maintenance_service import (  # noqa: E402
    DEPLOY_OWNED_SOURCES,
    get_maintenance_service,
    is_deploy_owned_source,
    maintenance_status_payload,
)

logger = logging.getLogger("maintenance_deploy_ctl")

_DEFAULT_SOURCE = "stack0-baked-deploy"


async def _emit(payload: dict) -> None:
    try:
        from api.routers.socketio_handler import emit_system_maintenance

        await emit_system_maintenance(payload)
    except Exception as exc:  # noqa: BLE001 — emit is best-effort for ops CLI
        logger.warning("maintenance_deploy_ctl: Socket.IO emit skipped err=%s", exc)


async def _resolve_upsert_fields(
    args: argparse.Namespace,
) -> tuple[int, int, str, str, str, datetime, datetime]:
    defaults = await load_deploy_defaults()
    notice = max(0, int(args.notice_seconds)) if args.notice_seconds is not None else defaults.notice_before_seconds
    duration = (
        max(30, int(args.duration_seconds)) if args.duration_seconds is not None else defaults.expected_downtime_seconds
    )
    effective = MaintenanceDeployDefaults(
        notice_before_seconds=notice,
        expected_downtime_seconds=duration,
        title=args.title if args.title is not None else defaults.title,
        message_template=defaults.message_template,
        user_impact_template=defaults.user_impact_template,
    )
    starts, ends = compute_window_schedule(effective)
    message, impact = render_deploy_copy(effective, starts_at=starts, ends_at=ends)
    if args.message is not None:
        message = args.message[:600]
    title = effective.title[:160]
    return notice, duration, title, message, impact, starts, ends


async def cmd_print_defaults(_args: argparse.Namespace) -> int:
    defaults = await load_deploy_defaults()
    starts, ends = compute_window_schedule(defaults)
    message, impact = render_deploy_copy(defaults, starts_at=starts, ends_at=ends)
    payload = {
        "notice_before_seconds": defaults.notice_before_seconds,
        "expected_downtime_seconds": defaults.expected_downtime_seconds,
        "title": defaults.title,
        "message": message,
        "user_impact": impact,
        "starts_at": starts.isoformat().replace("+00:00", "Z"),
        "expected_ends_at": ends.isoformat().replace("+00:00", "Z"),
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0


async def cmd_upsert_warning(args: argparse.Namespace) -> int:
    service = get_maintenance_service()
    current = await service.get_current_window(include_inactive=True)
    if current is not None and current.is_effective and not is_deploy_owned_source(current.source):
        print(
            f"WARN: skip upsert — foreign maintenance window id={current.id} "
            f"source={current.source!r} (will not overwrite)",
            file=sys.stderr,
        )
        return 0

    notice, duration, title, message, impact, starts, ends = await _resolve_upsert_fields(args)
    body = MaintenanceWindowUpsert(
        id=args.window_id,
        kind=MaintenanceKind.STACK0_RESTART,
        phase=MaintenancePhase.WARNING,
        starts_at=starts,
        expected_ends_at=ends,
        notice_before_seconds=notice,
        retry_after_seconds=duration,
        title=title,
        message=message,
        affected_services=["Безраздельный мир", "Связь", "Уведомления"],
        user_impact=impact,
        suppress_error_toasts=True,
        block_new_long_jobs=True,
        allow_operator_bypass=False,
        metadata={"owner": "stack0-release", "ctl": "maintenance_deploy_ctl"},
    )
    window = await service.upsert_window(body, source=args.source)
    payload = maintenance_status_payload(window)
    await _emit(payload)
    print(
        f"OK upsert-warning id={window.id} phase={window.phase.value} "
        f"source={window.source} notice={notice}s downtime={duration}s "
        f"starts={starts.isoformat()} ends={ends.isoformat()}"
    )
    return 0


async def cmd_set_phase(args: argparse.Namespace) -> int:
    service = get_maintenance_service()
    current = await service.get_current_window(include_inactive=True)
    if current is None:
        print("WARN: skip set-phase — no window in Redis", file=sys.stderr)
        return 0
    if current.id != args.window_id:
        print(
            f"WARN: skip set-phase — id mismatch have={current.id} want={args.window_id}",
            file=sys.stderr,
        )
        return 0
    if not is_deploy_owned_source(current.source):
        print(
            f"WARN: skip set-phase — foreign source={current.source!r}",
            file=sys.stderr,
        )
        return 0

    phase = MaintenancePhase(args.phase)
    window = await service.set_phase(phase.value)
    if phase in (MaintenancePhase.COMPLETED, MaintenancePhase.CANCELLED):
        payload = maintenance_status_payload(window)
        await service.clear_window()
        await _emit(maintenance_status_payload(None))
        print(f"OK set-phase {phase.value} + cleared id={args.window_id}")
        return 0

    payload = maintenance_status_payload(window if window and window.is_effective else None)
    await _emit(payload)
    print(f"OK set-phase {phase.value} id={args.window_id}")
    return 0


async def cmd_clear_if_owned(args: argparse.Namespace) -> int:
    service = get_maintenance_service()
    result = await service.clear_window_if_owned(window_id=args.window_id or None)
    if result == "cleared":
        await _emit(maintenance_status_payload(None))
    print(f"OK clear-if-owned result={result}")
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Deploy-owned maintenance Redis control")
    parser.add_argument(
        "--source",
        default=_DEFAULT_SOURCE,
        choices=sorted(DEPLOY_OWNED_SOURCES),
        help="Deploy ownership source tag written to Redis",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    print_def = sub.add_parser(
        "print-defaults",
        help="Print JSON notice/downtime/title/rendered copy from Postgres (or code fallback)",
    )
    print_def.set_defaults(handler=cmd_print_defaults)

    upsert = sub.add_parser("upsert-warning", help="Schedule warning phase (~notice before restart)")
    upsert.add_argument("--window-id", required=True)
    upsert.add_argument(
        "--notice-seconds",
        type=int,
        default=None,
        help="Override DB notice_before_seconds",
    )
    upsert.add_argument(
        "--duration-seconds",
        type=int,
        default=None,
        help="Override DB expected_downtime_seconds (ends_at = starts_at + this)",
    )
    upsert.add_argument("--title", default=None, help="Override DB title")
    upsert.add_argument("--message", default=None, help="Override rendered message template")
    upsert.set_defaults(handler=cmd_upsert_warning)

    phase = sub.add_parser("set-phase", help="Update phase for matching deploy window id")
    phase.add_argument("--window-id", required=True)
    phase.add_argument(
        "--phase",
        required=True,
        choices=[p.value for p in MaintenancePhase],
    )
    phase.set_defaults(handler=cmd_set_phase)

    clear = sub.add_parser("clear-if-owned", help="Clear Redis only if deploy-owned")
    clear.add_argument("--window-id", default="")
    clear.set_defaults(handler=cmd_clear_if_owned)

    return parser


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = _build_parser()
    args = parser.parse_args()
    return asyncio.run(args.handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
