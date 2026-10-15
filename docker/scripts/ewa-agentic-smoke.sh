#!/usr/bin/env bash
# ---
# EliteEW · Empery World · smoke: agentic substrate (config + pytest slice)
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/shared/api"

export PYTHONPATH="${ROOT}/EliteEW:${PYTHONPATH:-}"

echo "[ewa-agentic-smoke] config flags default off"
python3 - <<'PY'
from api.ewa_platform.agentic.config import agentic_substrate_enabled
assert agentic_substrate_enabled() is False
print("ok: EWA_AGENTIC_SUBSTRATE_ENABLED defaults off")
PY

echo "[ewa-agentic-smoke] pytest agentic slice (immutable container)"
AGENTIC_TESTS="tests/test_ewa_agentic_persistence.py tests/test_ewa_agentic_chaos.py tests/test_agentic_brain_intelligence.py tests/test_agentic_lease_reaper.py tests/test_agentic_session_budget.py tests/test_agentic_tree_scheduler.py tests/test_agentic_tool_args_enrich.py tests/test_agentic_task_run_events.py tests/test_ewa_companion_routing_policy.py::test_pre_tool_branches_tuple_is_canonical"
bash "$ROOT/docker/scripts/run-stack0-api-tests.sh" $AGENTIC_TESTS -q --tb=short

echo "[ewa-agentic-smoke] trace/tree route symbols"
python3 - <<'PY'
from api.ewa_platform.gateways.routers import agentic_sessions as mod
assert hasattr(mod, "get_agentic_session_trace")
assert hasattr(mod, "get_agentic_session_tree")
print("ok: trace + tree endpoints registered")
PY

echo "[ewa-agentic-smoke] task_run_events + tool_args_enrich symbols"
python3 - <<'PY'
from api.ewa_platform.agentic.adapters import task_run_events as tre
from api.ewa_platform.agentic.kernel import tool_args_enrich as tae
assert hasattr(tre, "publish_agentic_after_mirror_sync")
assert hasattr(tae, "enrich_tool_args")
print("ok: SSE bridge + user_line enrich registered")
PY

echo "[ewa-agentic-smoke] PASS"
