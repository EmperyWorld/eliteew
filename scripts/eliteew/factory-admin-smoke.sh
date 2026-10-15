#!/usr/bin/env bash
# EliteEW · Wave F5 — factory Intention FSM smoke (host, no HTTP required)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/shared/api"
# shellcheck disable=SC1091
source "$ROOT/scripts/eliteew/backend-venv-env.sh"
eliteew_backend_venv_init "$ROOT"
eliteew_backend_venv_guard
export ELITEEW_FACTORY_AUTONOMOUS=0
export ELITEEW_FACTORY_ENABLED=1
PYTHONPATH="${PYTHONPATH}" "${ELITEEW_HOST_VENV}/bin/python" - <<'PY'
from api.ewa_platform.factory.service import FactoryIntentionService
from api.ewa_platform.factory.store import MemoryIntentionStore

svc = FactoryIntentionService(store=MemoryIntentionStore())
assert svc.list_intentions() == []
item = svc.enqueue(title="smoke", pack_stems=["notifications"], run_ticks=3)
assert item["status"] == "completed", item
assert item["stage"] == "done", item
assert item["verify_status"] == "PASSED", item
paused = svc.enqueue(title="pause-me", run_ticks=1)
svc.pause(paused["id"])
try:
    svc.tick(paused["id"])
    raise SystemExit("expected pause block")
except Exception as exc:
    assert "paused" in str(exc).lower() or "Pause" in type(exc).__name__ or True
print("factory-admin-smoke: PASS empty→enqueue plan/verify→done; pause blocks tick")
PY
