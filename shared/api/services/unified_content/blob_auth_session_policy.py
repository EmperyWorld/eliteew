# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 0 canon locks for Content blob auth / SQLAlchemy hold / pii_key policy.
# Invariants:
# - Constants encode I1/I3/I2 design A (Waves 1–2 implemented for short auth + fail-closed pii).
# Related:
# - documentation/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md
# - documentation/database/DB_PITFALLS_AND_QUIRKS.md §3
# ---

"""Target policy constants for auth session vs content blob concurrency."""

from __future__ import annotations

# I1 — Bearer blob routes must release SQLAlchemy before storage retrieve/stream.
TARGET_RELEASE_SQLALCHEMY_BEFORE_BLOB_RETRIEVE = True

# I3 — QueuePool / SET pii_key failure must fail-closed (no soft-skip yield).
TARGET_PII_KEY_POOL_TIMEOUT_FAIL_CLOSED = True

# W0.8 — design option A (short-lived / blob-specific auth; ticket path is reference).
BLOB_AUTH_DESIGN_OPTION = "A"

# Log / metric name fragments (STACK1-POSTGRES-TUNING observability §).
METRIC_SQLALCHEMY_POOL_TIMEOUTS = "sqlalchemy_pool_timeouts_total"
METRIC_PII_KEY_SET_FAIL = "encryption_pii_key_set_fail_total"
# Historical soft-skip log string — must not appear in get_postgres_session after Wave 2.
LOG_PII_KEY_SOFT_SKIP_DEBT = "Failed to set encryption.pii_key for session"
