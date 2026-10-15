# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ai.local provider probe — user/device local OpenAI-compat endpoint URL.
# Invariants:
# - is_configured() only; completions via completions.py (O3b).
# - Secrets never read or logged here.
# Related:
# - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md §5
# ---

from __future__ import annotations

from dataclasses import dataclass

from api.services.ai_provider_router.policy import AiProviderKind


@dataclass(frozen=True, slots=True)
class LocalAiProviderProbe:
    kind: AiProviderKind = AiProviderKind.LOCAL
    base_url: str = ""
    model: str = ""

    def is_configured(self) -> bool:
        return bool(self.base_url.strip())


def probe_local_ai_provider() -> LocalAiProviderProbe:
    from api.core.unified_config import unified_settings

    base = ""
    model = ""
    try:
        base = str(getattr(unified_settings, "eliteew_ai_local_base_url", "") or "").strip()
    except Exception:
        base = ""
    try:
        model = str(getattr(unified_settings, "eliteew_ai_local_model", "") or "").strip()
    except Exception:
        model = ""
    return LocalAiProviderProbe(base_url=base, model=model)
