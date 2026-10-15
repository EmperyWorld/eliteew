#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# U3 hygiene: fail if decision_engine.py imports state_machine / fsm_port
# (Decision Engine must stay isolated from FSM; Act goes through loop_bridge).
# Related:
# - shared/api/ewa_platform/agentic/kernel/decision_engine.py
# - shared/api/tests/test_agentic_kernel_k1_bridge.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="${ROOT}/shared/api/ewa_platform/agentic/kernel/decision_engine.py"

if [[ ! -f "${TARGET}" ]]; then
	echo "u3-agentic-decision-engine-import-guard: missing ${TARGET}" >&2
	exit 2
fi

# Import lines only (comments mentioning state_machine are allowed).
if rg -n --pcre2 '^\s*(from|import)\s+.*\b(state_machine|fsm_port)\b' "${TARGET}"; then
	echo "U3 FAIL: decision_engine must not import state_machine / fsm_port" >&2
	exit 1
fi

echo "U3 OK: decision_engine isolated from state_machine / fsm_port"
