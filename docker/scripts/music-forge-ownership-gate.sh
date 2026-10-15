#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract/LOC ownership gate for MusicForge reconstruction (Phase 2-T4).
# Invariants:
# - Fail on dual-accept normalize, retired config_service/metrics paths, mixin Service bases.
# - Fail if ownership LOC caps exceeded.
# Related:
# - documentation/product/MUSIC-FORGE-APP.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="${ROOT}/shared/api/services/music_forge"
FE_ADMIN="${ROOT}/shared/web/frontend/src/pages/Admin/musicForge"
failures=0

fail() {
	echo "[music-forge-ownership-gate] FAIL: $*" >&2
	failures=$((failures + 1))
}

ok() {
	echo "[music-forge-ownership-gate] ok: $*"
}

# --- Contract bans ---
if rg -n "normalizeMusicForgeConfigRevisions" "${ROOT}/shared/web/frontend/src" --glob '*.{ts,tsx}' >/dev/null 2>&1; then
	fail "dual-accept normalizeMusicForgeConfigRevisions still present"
else
	ok "no dual-accept normalize"
fi

if [[ -f "${API}/config_service.py" ]]; then
	fail "retired config_service.py still in tree"
else
	ok "config_service.py retired"
fi

if [[ -f "${API}/metrics.py" ]]; then
	fail "retired process-local metrics.py still in tree"
else
	ok "metrics.py retired"
fi

if rg -n "class MusicForgePipelineService\s*\(" "${API}/pipeline.py" | rg -n "Mixin" >/dev/null 2>&1; then
	fail "MusicForgePipelineService still inherits mixins"
else
	ok "pipeline facade has no mixin bases"
fi

# --- LOC caps (Phase 1 ownership) ---
check_loc() {
	local path="$1"
	local max="$2"
	local label="$3"
	if [[ ! -f "${path}" ]]; then
		fail "missing ${label}: ${path}"
		return
	fi
	local lines
	lines="$(wc -l <"${path}" | tr -d ' ')"
	if [[ "${lines}" -gt "${max}" ]]; then
		fail "${label} LOC ${lines} > ${max} (${path})"
	else
		ok "${label} LOC ${lines} <= ${max}"
	fi
}

check_loc "${API}/pipeline.py" 330 "facade"
check_loc "${API}/pipeline_repository.py" 500 "repository"
check_loc "${API}/pipeline_execute.py" 500 "executor"
check_loc "${API}/config/gateway.py" 300 "ConfigGateway"
check_loc "${API}/billing_gate.py" 150 "BillingGate"
check_loc "${FE_ADMIN}/MusicForgeConfigEditor.tsx" 400 "ConfigEditor shell"
check_loc "${FE_ADMIN}/MusicForgeAdminSection.tsx" 200 "AdminSection shell"
check_loc "${FE_ADMIN}/MusicForgeAdminPanels.tsx" 700 "AdminPanels"
check_loc "${FE_ADMIN}/MusicForgePipelineBuilder.tsx" 700 "PipelineBuilder"
check_loc "${FE_ADMIN}/musicForgePipelineBuilderModel.ts" 120 "PipelineBuilder model"

# --- Legacy empty-pipeline fallback banned (W5) ---
if rg -n "await self\.repo\._ensure_steps\(run_id\)" "${API}/pipeline.py" >/dev/null 2>&1; then
	fail "legacy STEP_DEFS create fallback still calls repo._ensure_steps(run_id)"
else
	ok "create_run has no legacy STEP_DEFS fallback"
fi

if rg -n "legacy_default" "${API}/pipeline_mode.py" >/dev/null 2>&1; then
	fail "legacy_default synthetic mode still present"
else
	ok "no legacy_default mode"
fi

# --- Envelope FE hard throw present ---
if rg -n "requireMusicForgeConfigRevisionsEnvelope" "${FE_ADMIN}/musicForgeAdminApi.ts" >/dev/null 2>&1; then
	ok "FE envelope require present"
else
	fail "FE requireMusicForgeConfigRevisionsEnvelope missing"
fi

if [[ "${failures}" -gt 0 ]]; then
	echo "[music-forge-ownership-gate] FAIL count=${failures}" >&2
	exit 1
fi
echo "[music-forge-ownership-gate] OK"
