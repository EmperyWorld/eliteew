# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `ewa_platform/companion/sidecar/trust_turn.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pre-main-LLM companion steps: **trust meter** + forward **Arlika v1 / v2** swap; while seed is **``arlika``** (hostile),
# **idle ≥1h** without a finished chat turn triggers auto-revert with **full amnesia** memory; else **wrath** decay and
# ``companion_profile_revert_arlika`` when wrath reaches **0** after calm turns (**SSE** ``ewa_restore``, mystic memory row).
# **``arlika_v2``** skips idle + wrath (friendly mode), but hostile auto-transform from abuse peak always enters
# classic **``arlika``** (v1); v2 is entered only by explicit chat switch.
# Invariants:
# - Forward hostile transform: **personal abuse / insult** (classifier or rude heuristic) → seed **``arlika``** (v1); trust score **not** required.
# - **``arlika_v2``** on abuse demotes to hostile **``arlika``** v1 (same transform path as EWA seeds).
# - Wrath classifier: ``True`` = quarrel (no decay), ``False`` = calm (decay). ``None`` = classify failure: treat as calm
#   when ``EWA_COMPANION_ARLIKA_WRATH_CLASSIFY_FAIL_OPEN`` is truthy (default **on**) so wrath still decays if stack2 hiccups.
# - Revert uses ``companion_profile_revert_arlika`` for **idle ≥1h** and for **wrath exhausted** — **v1 only**.
# - **Healing:** ``seed=arlika`` with wrath **≤0** in baseline still triggers ``companion_profile_revert_arlika`` (fixes stuck rows).
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - api/ewa_platform/companion/sidecar/trust_classify.py
# - api/ewa_platform/companion/sidecar/arlika_wrath_classify.py
# - api/ewa_platform/companion/sidecar/trust_state.py
# - api/ewa_platform/companion/sidecar/arlika_v2_dual_memory.py
# - api/ewa_platform/companion/affective/affective_router.py (consumes trust classifier signals downstream)
# **Canonical path:** ``api.ewa_platform.companion.sidecar.trust_turn``; shim ``companion_trust_turn``.
# ---
"""Pre-turn trust update + Arlika transformation / Arlika wrath decay + revert."""

from __future__ import annotations

import logging
import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import asyncpg
import httpx

from api.ewa_platform.companion.sidecar.arlika_quarrel import arlika_rude_user_heuristic
from api.ewa_platform.companion.sidecar.arlika_wrath_classify import (
    classify_arlika_wrath_quarrel,
    wrath_classify_model_from_env,
)
from api.ewa_platform.companion.sidecar.trust_classify import classify_companion_trust_turn
from api.ewa_platform.companion.sidecar.trust_state import (
    ARLIKA_IDLE_REVERT_AFTER_SEC,
    ARLIKA_V1_QUARREL_SEEN_KEY,
    ARLIKA_V2_SEED,
    apply_trust_delta,
    arlika_transform_baseline_delta,
    arlika_wrath_baseline_update,
    is_arlika_locked,
    read_arlika_wrath_score,
    read_trust_score,
    seconds_since_last_friend_chat_for_arlika_idle,
    trust_baseline_update,
)
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)

_ARLIKA_V2_ABUSE_HINT_RE = re.compile(
    r"(?iu)\b(?:идиот\w*|дебил\w*|туп\w*|дур\w*|иди нах\w*|пош\w* ты|idiot|stupid|asshole|moron)\b"
)


def _arlika_wrath_classify_fail_open() -> bool:
    raw = os.getenv("EWA_COMPANION_ARLIKA_WRATH_CLASSIFY_FAIL_OPEN", "true").strip().lower()
    return raw in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class CompanionTrustClassifySignals:
    """Snapshot from trust / wrath classifiers for downstream routing (no extra HTTP)."""

    trust_delta: int | None
    abuse_at_peak: bool | None
    argumentative_quarrel: bool | None = None


_NO_TRUST_SIGNALS = CompanionTrustClassifySignals(None, None)


def _user_abuse_for_arlika_transform(*, classifier_abuse: bool, user_line: str) -> bool:
    """True when the user line should flip a non-v1 companion into hostile Arlika v1."""

    return bool(classifier_abuse) or arlika_rude_user_heuristic(user_line)


async def _transform_profile_to_arlika_v1(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    rev: int,
    origin_seed: str,
    trust_score_before: int,
    signals: CompanionTrustClassifySignals,
) -> tuple[dict[str, Any], bool, bool, str | None, CompanionTrustClassifySignals] | None:
    """Apply hostile v1 transform; ``None`` if revision conflict (caller keeps prior profile)."""

    delta_b = arlika_transform_baseline_delta(origin_seed_persona_id=origin_seed)
    delta_b.update(trust_baseline_update(10))
    patched = await companion_pg.companion_profile_set_seed_persona_id(
        pool,
        principal_id=principal_id,
        seed_persona_id="arlika",
        baseline_delta=delta_b,
        expect_revision=rev,
        audit_action="arlika_transform",
        audit_detail_override={
            "trust_score": trust_score_before,
            "origin_seed": origin_seed,
        },
    )
    if patched is None:
        logger.warning("arlika_transform_revision_conflict principal_id=%s", principal_id)
        return None
    return patched, True, True, "arlika", signals


async def _friendly_path_trust_and_maybe_transform(
    pool: asyncpg.Pool,
    client: httpx.AsyncClient,
    *,
    principal_id: str,
    profile: dict[str, Any],
    baseline_obj: dict[str, Any],
    rev: int,
    seed: str,
    user_line: str,
    base_url: str,
    classify_model: str,
    timeout: httpx.Timeout,
) -> tuple[dict[str, Any], bool, bool, str | None, CompanionTrustClassifySignals]:
    """Trust classify + optional forward transform to hostile Arlika v1 (any seed except ``arlika``)."""

    if is_arlika_locked(baseline_obj) and seed not in ("arlika", ARLIKA_V2_SEED):
        logger.info(
            "companion_baseline_locked_without_arlika_seed principal_id=%s seed=%s",
            principal_id,
            seed,
        )
        return profile, False, False, None, _NO_TRUST_SIGNALS

    score = read_trust_score(baseline_obj)

    delta, abuse = await classify_companion_trust_turn(
        client,
        base_url=base_url,
        model=classify_model,
        timeout=timeout,
        user_message=user_line,
        current_trust_score=score,
    )
    trust_td: int | None
    try:
        trust_td = int(delta)
    except (TypeError, ValueError):  # fmt: skip
        trust_td = None
    abuse_detected = _user_abuse_for_arlika_transform(classifier_abuse=bool(abuse), user_line=user_line)
    abuse_peak: bool | None = None if not abuse_detected else True
    signals = CompanionTrustClassifySignals(trust_delta=trust_td, abuse_at_peak=abuse_peak)

    if abuse_detected:
        transformed = await _transform_profile_to_arlika_v1(
            pool,
            principal_id=principal_id,
            rev=rev,
            origin_seed=seed,
            trust_score_before=score,
            signals=signals,
        )
        if transformed is None:
            return profile, False, False, None, signals
        return transformed

    new_score = apply_trust_delta(score, delta)
    if new_score != score:
        patched = await companion_pg.companion_profile_patch(
            pool,
            principal_id=principal_id,
            baseline=trust_baseline_update(new_score),
            expect_revision=rev,
            audit_action="companion_trust_update",
            audit_detail_override={
                "trust_score_before": score,
                "trust_score_after": new_score,
                "delta": delta,
            },
        )
        if patched is None:
            logger.warning("companion_trust_patch_conflict principal_id=%s", principal_id)
            return profile, False, False, None, signals
        return patched, False, False, None, signals

    return profile, False, False, None, signals


async def ewa_companion_trust_pre_turn(
    pool: asyncpg.Pool,
    client: httpx.AsyncClient,
    *,
    principal_id: str,
    profile: dict[str, Any],
    user_line: str,
    base_url: str,
    classify_model: str,
    timeout: httpx.Timeout,
) -> tuple[dict[str, Any], bool, bool, str | None, CompanionTrustClassifySignals]:
    """Return ``(..., CompanionTrustClassifySignals)``.

    Signals are populated only after a successful companion trust classify call on the friendly path.
    """

    seed = str(profile.get("seed_persona_id") or "").strip().lower()
    baseline_raw = profile.get("baseline")
    baseline_obj: dict[str, Any] = dict(baseline_raw) if isinstance(baseline_raw, Mapping) else {}
    rev = int(profile.get("companion_revision") or 1)

    if seed == ARLIKA_V2_SEED:
        # Friendly v2 pre-turn avoids classifier HTTP calls, but explicit rude abuse still demotes
        # to hostile Arlika v1 using local heuristic.
        abuse_hint = arlika_rude_user_heuristic(user_line) or bool(_ARLIKA_V2_ABUSE_HINT_RE.search(user_line or ""))
        if not abuse_hint:
            return profile, False, False, None, _NO_TRUST_SIGNALS
        score = read_trust_score(baseline_obj)
        signals = CompanionTrustClassifySignals(trust_delta=None, abuse_at_peak=True)
        transformed = await _transform_profile_to_arlika_v1(
            pool,
            principal_id=principal_id,
            rev=rev,
            origin_seed=seed,
            trust_score_before=score,
            signals=signals,
        )
        if transformed is None:
            return profile, False, False, None, signals
        return transformed

    if seed == "arlika":
        idle_sec = seconds_since_last_friend_chat_for_arlika_idle(baseline_obj)
        if idle_sec is not None and idle_sec >= float(ARLIKA_IDLE_REVERT_AFTER_SEC):
            patched = await companion_pg.companion_profile_revert_arlika(
                pool,
                principal_id=principal_id,
                expect_revision=rev,
                idle_full_amnesia=True,
            )
            if patched is None:
                logger.warning(
                    "arlika_idle_revert_revision_or_seed_conflict principal_id=%s rev=%s — fall_through_wrath_path",
                    principal_id,
                    rev,
                )
            else:
                return patched, True, True, "ewa_restore", _NO_TRUST_SIGNALS

        wrath = read_arlika_wrath_score(baseline_obj)
        if wrath <= 0:
            logger.warning(
                "arlika_seed_but_wrath_nonpositive_healing_revert principal_id=%s",
                principal_id,
            )
            patched = await companion_pg.companion_profile_revert_arlika(
                pool,
                principal_id=principal_id,
                expect_revision=rev,
                idle_full_amnesia=False,
            )
            if patched is None:
                logger.warning(
                    "arlika_healing_revert_conflict principal_id=%s expect_rev=%s",
                    principal_id,
                    rev,
                )
                return profile, False, False, None, _NO_TRUST_SIGNALS
            return patched, True, True, "ewa_restore", _NO_TRUST_SIGNALS

        wrath_model = wrath_classify_model_from_env(classify_model)
        qc = await classify_arlika_wrath_quarrel(
            client,
            base_url=base_url,
            model=wrath_model,
            timeout=timeout,
            user_message=user_line,
        )
        if qc is None:
            if _arlika_wrath_classify_fail_open():
                logger.warning(
                    "arlika_wrath_classify_none_fail_open_as_calm principal_id=%s",
                    principal_id,
                )
                qc = False
            else:
                return profile, False, False, None, _NO_TRUST_SIGNALS

        if qc:
            quarrel_delta: dict[str, Any] = {ARLIKA_V1_QUARREL_SEEN_KEY: True}
            patched_q = await companion_pg.companion_profile_patch(
                pool,
                principal_id=principal_id,
                baseline=quarrel_delta,
                expect_revision=rev,
                audit_action="arlika_v1_quarrel_seen",
                audit_detail_override={"wrath": wrath},
            )
            if patched_q is None:
                logger.warning("arlika_quarrel_seen_patch_conflict principal_id=%s", principal_id)
                return profile, False, False, None, _NO_TRUST_SIGNALS
            return (
                patched_q,
                False,
                False,
                None,
                CompanionTrustClassifySignals(None, None, True),
            )

        new_wrath = max(0, wrath - 1)

        if new_wrath == 0:
            patched = await companion_pg.companion_profile_revert_arlika(
                pool,
                principal_id=principal_id,
                expect_revision=rev,
                idle_full_amnesia=False,
            )
            if patched is None:
                logger.warning(
                    "arlika_revert_revision_or_seed_conflict principal_id=%s expect_rev=%s idle_amnesia=False",
                    principal_id,
                    rev,
                )
                return profile, False, False, None, _NO_TRUST_SIGNALS
            logger.info(
                "arlika_wrath_exhausted_ewa_restore principal_id=%s wrath_before=%s",
                principal_id,
                wrath,
            )
            return patched, True, True, "ewa_restore", _NO_TRUST_SIGNALS

        patched = await companion_pg.companion_profile_patch(
            pool,
            principal_id=principal_id,
            baseline=arlika_wrath_baseline_update(new_wrath),
            expect_revision=rev,
            audit_action="arlika_wrath_update",
            audit_detail_override={
                "wrath_before": wrath,
                "wrath_after": new_wrath,
                "quarrel": False,
            },
        )
        if patched is None:
            logger.warning("arlika_wrath_patch_conflict principal_id=%s", principal_id)
            return profile, False, False, None, _NO_TRUST_SIGNALS
        return patched, False, False, None, _NO_TRUST_SIGNALS

    return await _friendly_path_trust_and_maybe_transform(
        pool,
        client,
        principal_id=principal_id,
        profile=profile,
        baseline_obj=baseline_obj,
        rev=rev,
        seed=seed,
        user_line=user_line,
        base_url=base_url,
        classify_model=classify_model,
        timeout=timeout,
    )


__all__: tuple[str, ...] = ("CompanionTrustClassifySignals", "ewa_companion_trust_pre_turn")
