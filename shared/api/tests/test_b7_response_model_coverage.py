# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fail-closed lock for Core4+DesktopAI response_model coverage (Wave B7).
# Invariants:
# - Uses scripts/audit_response_model_coverage.py (AST); no router import.
# Related:
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ---
from __future__ import annotations

import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = API_ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from audit_response_model_coverage import scan_all  # noqa: E402


def test_core4_response_model_coverage_fail_closed() -> None:
    findings = scan_all()
    assert findings == [], "response_model coverage holes:\n" + "\n".join(
        f"[{f.kind}] {f.path}:{f.lineno} {f.function} — {f.detail}" for f in findings
    )
