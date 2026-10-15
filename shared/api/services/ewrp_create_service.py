# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Re-export EWRP create/pipeline entrypoints from the HTTP router module for companion workers.
# Invariants:
# - Implementation lives in ``api.routers.ewrp`` so router contract tests patch one module.
# - Billing constants live in ``api.services.ewrp_billing``.
# Related:
# - api/routers/ewrp.py
# - api/ewa_platform/companion/orchestration/companion_presentation_generation.py
# ---

from __future__ import annotations

from api.routers.ewrp import _run_ewrp_pipeline as run_ewrp_pipeline_task
from api.routers.ewrp import create_ewrp_job_for_user
from api.services.ewrp_billing import (
    EWRP_BILLING_TYPE_KEY,
    EWRP_CREDITS_PER_SLIDE,
)

__all__ = [
    "EWRP_BILLING_TYPE_KEY",
    "EWRP_CREDITS_PER_SLIDE",
    "create_ewrp_job_for_user",
    "run_ewrp_pipeline_task",
]
