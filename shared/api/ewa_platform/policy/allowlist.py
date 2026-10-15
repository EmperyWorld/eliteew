# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Default empty allowlist constants; **`BasicDesktopPolicyEngine`** merges this with **`EWA_DESKTOP_ORCH_APP_ALLOWLIST`** (CSV env) at runtime in ``policy/engine.py``.
# Invariants:
# - Empty frozenset here means CSV/env allowlist dominates; merges with **`EWA_DESKTOP_ORCH_APP_ALLOWLIST`** inside ``policy/engine.BasicDesktopPolicyEngine``.
# Related:
# - api/ewa_platform/policy/rules.py
# ---
"""Static default allowlist; production policy uses CSV from env merged in ``policy/engine.BasicDesktopPolicyEngine``."""

from __future__ import annotations

DEFAULT_ALLOWED_APP_COMPONENTS: frozenset[str] = frozenset()
