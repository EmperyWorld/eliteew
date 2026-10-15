# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Feature flags and tunables for the EWA Agentic Substrate (OFF by default).
# Invariants:
# - Master switch EWA_AGENTIC_SUBSTRATE_ENABLED lives in ewa_platform_setting (DB); read via ewa_getenv*.
# - Service-discovery URLs (THINK/CONDENSE_BASE_URL) stay on real process env (os.getenv).
# - Substrate Celery requires master async jobs switch when enqueueing workers.
# Related:
# - documentation/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md
# - documentation/product/ewa/EWA-COMPANION-STABILITY-PERF-CONTRACT.md
# ---

from __future__ import annotations

import os

from api.ewa_platform.settings.access import ewa_getenv, ewa_getenv_bool, ewa_getenv_float, ewa_getenv_int


def agentic_substrate_enabled() -> bool:
    """Master switch for agentic session creation and chat routing.

    Source of truth after API bootstrap: ``ewa_platform_setting`` (admin «Настройки»).
    Operational toggles use ``ewa_getenv*`` (DB cache); compose/Config Plane env is not read for EWA_* keys.
    """

    return ewa_getenv_bool("EWA_AGENTIC_SUBSTRATE_ENABLED", default=False)


def agentic_async_jobs_enabled() -> bool:
    """When ON, agentic loop ticks run on Celery queue ``ewa_agentic``."""

    if not agentic_substrate_enabled():
        return False
    from api.ewa_platform.companion.jobs.config import companion_async_jobs_enabled

    return companion_async_jobs_enabled()


def agentic_step_scheduler_enabled() -> bool:
    """When ON, execution is advanced by one durable scheduler-owned step per Celery task."""

    if not agentic_async_jobs_enabled():
        return False
    return ewa_getenv_bool("EWA_AGENTIC_STEP_SCHEDULER_ENABLED", default=True)


def agentic_step_retry_delay_sec() -> int:
    """Base retry delay for scheduler-owned step failures."""

    return max(1, min(ewa_getenv_int("EWA_AGENTIC_STEP_RETRY_DELAY_SEC", default=20), 3600))


def agentic_step_soft_time_limit_sec() -> int:
    """Celery soft time limit for ``agentic_step_task`` (must cover one LLM-heavy slice)."""

    return max(60, min(ewa_getenv_int("EWA_AGENTIC_STEP_SOFT_TIME_LIMIT_SEC", default=180), 900))


def agentic_step_time_limit_sec() -> int:
    """Celery hard time limit for ``agentic_step_task`` (always > soft)."""

    soft = agentic_step_soft_time_limit_sec()
    hard = max(soft + 30, min(ewa_getenv_int("EWA_AGENTIC_STEP_TIME_LIMIT_SEC", default=240), 960))
    return hard


def agentic_step_claim_seconds() -> int:
    """Lease window for one claimed agentic task-tree step (never exceeds Celery soft limit)."""

    soft = agentic_step_soft_time_limit_sec()
    claim = max(30, min(ewa_getenv_int("EWA_AGENTIC_STEP_CLAIM_SECONDS", default=soft), 3600))
    return min(claim, soft)


def agentic_soft_timeout_max_per_node() -> int:
    """Max SoftTimeLimit recoveries per task-tree node before terminal fail."""

    return max(1, min(ewa_getenv_int("EWA_AGENTIC_SOFT_TIMEOUT_MAX_PER_NODE", default=5), 20))


def agentic_llm_admission_enabled() -> bool:
    """When ON, only one heavy LLM tool (file_create generative / call_expert_chat) runs at a time."""

    if not agentic_substrate_enabled():
        return False
    return ewa_getenv_bool("EWA_AGENTIC_LLM_ADMISSION_ENABLED", default=True)


def agentic_llm_admission_lease_sec() -> int:
    return max(30, min(ewa_getenv_int("EWA_AGENTIC_LLM_ADMISSION_LEASE_SEC", default=240), 900))


def agentic_llm_admission_poll_sec() -> int:
    return max(2, min(ewa_getenv_int("EWA_AGENTIC_LLM_ADMISSION_POLL_SEC", default=8), 120))


def agentic_checkpoint_window() -> int:
    return max(1, min(ewa_getenv_int("EWA_AGENTIC_CHECKPOINT_WINDOW", default=20), 100))


def agentic_max_iterations_per_tick() -> int:
    return max(1, min(ewa_getenv_int("EWA_AGENTIC_MAX_ITERATIONS_PER_TICK", default=3), 10))


def agentic_condense_every_n() -> int:
    return max(1, ewa_getenv_int("EWA_AGENTIC_CONDENSE_EVERY_N", default=5))


def agentic_condense_llm_enabled() -> bool:
    """When OFF, condense uses deterministic merge (tests / emergency)."""

    if not agentic_substrate_enabled():
        return False
    return ewa_getenv_bool("EWA_AGENTIC_CONDENSE_LLM_ENABLED", default=True)


def agentic_condense_http_runtime() -> tuple[str, str]:
    """Return (base_url, model) for agentic condense sidecar (cheap model preferred)."""

    base = os.getenv("EWA_AGENTIC_CONDENSE_BASE_URL", "").strip().rstrip("/")
    model = ewa_getenv("EWA_AGENTIC_CONDENSE_MODEL", "").strip()
    if not base:
        from api.core.unified_config import unified_settings as us

        base = (us.llama_url or "").strip().rstrip("/")
    if not model:
        model = (
            ewa_getenv("EWA_ORCH_LLM_MODEL", "").strip() or ewa_getenv("EWA_COMPANION_INTENT_MODEL", "").strip() or ""
        )
        if not model:
            from api.core.unified_config import unified_settings as us

            model = (us.default_ai_model or "mistral").strip()
    return base, model


def agentic_condense_timeout_sec() -> float:
    return max(5.0, min(ewa_getenv_float("EWA_AGENTIC_CONDENSE_TIMEOUT_SEC", default=45.0), 120.0))


def agentic_condense_num_predict() -> int:
    return max(128, min(ewa_getenv_int("EWA_AGENTIC_CONDENSE_NUM_PREDICT", default=512), 2048))


def agentic_condense_max_summary_chars() -> int:
    return max(500, min(ewa_getenv_int("EWA_AGENTIC_CONDENSE_MAX_SUMMARY_CHARS", default=4000), 12000))


def agentic_condense_checkpoint_input_limit() -> int:
    return max(5, min(ewa_getenv_int("EWA_AGENTIC_CONDENSE_CHECKPOINT_LIMIT", default=80), 200))


def agentic_hot_memory_ring_size() -> int:
    """Max act summaries retained in working_memory_json.active_slice (hot tier)."""

    return max(1, min(ewa_getenv_int("EWA_AGENTIC_HOT_MEMORY_RING_SIZE", default=3), 8))


def agentic_max_tree_nodes() -> int:
    return max(10, ewa_getenv_int("EWA_AGENTIC_MAX_TREE_NODES", default=200))


def agentic_max_checkpoint_payload_bytes() -> int:
    return max(1024, ewa_getenv_int("EWA_AGENTIC_MAX_CHECKPOINT_PAYLOAD_BYTES", default=65536))


def agentic_lease_seconds() -> int:
    return max(30, ewa_getenv_int("EWA_AGENTIC_LEASE_SECONDS", default=90))


def agentic_tool_allowlist() -> frozenset[str] | None:
    """Optional comma-separated allowlist; None means use session policy only."""

    raw = ewa_getenv("EWA_AGENTIC_TOOL_ALLOWLIST", "").strip()
    if not raw:
        return None
    parts = {p.strip() for p in raw.split(",") if p.strip()}
    return frozenset(parts) if parts else None


def agentic_intake_gate_enabled() -> bool:
    """When ON, companion turn entry runs weight-based intake before deterministic routing."""

    from api.ewa_platform.agentic.intake.gate import agentic_intake_gate_enabled as _gate_enabled

    return _gate_enabled()


def agentic_inbox_max_pending() -> int:
    return max(1, ewa_getenv_int("EWA_AGENTIC_INBOX_MAX_PENDING", default=5))


def agentic_think_llm_enabled() -> bool:
    """When OFF, Think falls back to heuristic (tests / emergency). Default ON if substrate enabled."""

    if not agentic_substrate_enabled():
        return False
    return ewa_getenv_bool("EWA_AGENTIC_THINK_LLM_ENABLED", default=True)


def agentic_think_http_runtime() -> tuple[str, str]:
    """Return (base_url, model) for agentic Think sidecar."""

    base = os.getenv("EWA_AGENTIC_THINK_BASE_URL", "").strip().rstrip("/")
    model = ewa_getenv("EWA_AGENTIC_THINK_MODEL", "").strip()
    if not base:
        from api.core.unified_config import unified_settings as us

        base = (us.llama_url or "").strip().rstrip("/")
    if not model:
        model = (
            ewa_getenv("EWA_ORCH_LLM_MODEL", "").strip() or ewa_getenv("EWA_COMPANION_INTENT_MODEL", "").strip() or ""
        )
        if not model:
            from api.core.unified_config import unified_settings as us

            model = (us.default_ai_model or "mistral").strip()
    return base, model


def agentic_think_timeout_sec() -> float:
    return max(10.0, min(ewa_getenv_float("EWA_AGENTIC_THINK_TIMEOUT_SEC", default=60.0), 180.0))


def agentic_loop_soft_time_limit_sec() -> int:
    """Celery soft time limit for ``agentic_loop_tick`` (Think HTTP + margin)."""

    think = int(agentic_think_timeout_sec())
    default = max(90, think + 30)
    return max(60, min(ewa_getenv_int("EWA_AGENTIC_LOOP_SOFT_TIME_LIMIT_SEC", default=default), 900))


def agentic_loop_time_limit_sec() -> int:
    """Celery hard time limit for ``agentic_loop_tick``."""

    soft = agentic_loop_soft_time_limit_sec()
    hard = max(soft + 30, min(ewa_getenv_int("EWA_AGENTIC_LOOP_TIME_LIMIT_SEC", default=soft + 30), 960))
    return hard


def agentic_think_num_predict() -> int:
    return max(256, min(ewa_getenv_int("EWA_AGENTIC_THINK_NUM_PREDICT", default=4096), 8192))


def agentic_think_max_parse_retries() -> int:
    return max(0, min(ewa_getenv_int("EWA_AGENTIC_THINK_MAX_PARSE_RETRIES", default=1), 3))


def agentic_max_replanning_attempts() -> int:
    """Hard circuit breaker cap — replanning loops beyond this terminate the session."""

    return max(1, min(ewa_getenv_int("EWA_AGENTIC_MAX_REPLANNING_ATTEMPTS", default=5), 20))


def agentic_think_context_max_utf8() -> int:
    return max(4096, min(ewa_getenv_int("EWA_AGENTIC_THINK_CONTEXT_MAX_UTF8", default=120_000), 200_000))


def agentic_lease_reaper_enabled() -> bool:
    """Periodic Celery beat task that reclaims stale agentic session leases."""

    if not agentic_substrate_enabled():
        return False
    return ewa_getenv_bool("EWA_AGENTIC_LEASE_REAPER_ENABLED", default=True)


def agentic_lease_reaper_interval_sec() -> int:
    return max(30, min(ewa_getenv_int("EWA_AGENTIC_LEASE_REAPER_INTERVAL_SEC", default=120), 3600))


def agentic_gate_sweep_enabled() -> bool:
    """When ON, lease reaper beat also expires awaiting_human gates past expires_at."""

    if not agentic_substrate_enabled():
        return False
    return ewa_getenv_bool("EWA_AGENTIC_GATE_SWEEP_ENABLED", default=True)


def agentic_orphan_sweep_enabled() -> bool:
    """When ON, lease reaper beat also reclaims no-lease stale active sessions (Gate G2)."""

    if not agentic_substrate_enabled():
        return False
    return ewa_getenv_bool("EWA_AGENTIC_ORPHAN_SWEEP_ENABLED", default=True)


def agentic_orphan_stale_minutes() -> int:
    """Minutes without lease/update before an active session is treated as orphaned."""

    return max(1, min(ewa_getenv_int("EWA_AGENTIC_ORPHAN_STALE_MINUTES", default=5), 120))


def agentic_orphan_max_recoveries() -> int:
    """After this many orphan re-enqueues without progress, terminalize with fatal_error."""

    return max(1, min(ewa_getenv_int("EWA_AGENTIC_ORPHAN_MAX_RECOVERIES", default=3), 20))


def agentic_awaiting_child_poll_sec() -> int:
    """Soft poll delay while parent nodes wait for a terminal companion child run (Gate G5)."""

    return max(5, min(ewa_getenv_int("EWA_AGENTIC_AWAITING_CHILD_POLL_SEC", default=30), 600))


def agentic_session_default_max_wall_clock_sec() -> int | None:
    """Default session wall-clock budget when policy_json.budget omits max_wall_clock_sec."""

    raw = ewa_getenv("EWA_AGENTIC_SESSION_MAX_WALL_CLOCK_SEC", "3600").strip()
    if not raw or raw.lower() in {"0", "off", "none", "unlimited"}:
        return None
    try:
        return max(60, min(int(raw), 86_400))
    except ValueError:
        return 3600


def agentic_session_default_max_total_iterations() -> int | None:
    raw = ewa_getenv("EWA_AGENTIC_SESSION_MAX_TOTAL_ITERATIONS", "50").strip()
    if not raw or raw.lower() in {"0", "off", "none", "unlimited"}:
        return None
    try:
        return max(1, min(int(raw), 500))
    except ValueError:
        return 50
