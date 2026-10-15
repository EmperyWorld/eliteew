# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# First EliteEW-cloud AI provider adapter probe — uses platform llama_url config.
# Invariants:
# - is_configured() only; chat/completions via completions.py (O3b).
# - Secrets stay in UnifiedConfig / env; never logged here.
# Related:
# - api/core/unified_config.py (llama_url)
# - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md §5
# ---

from __future__ import annotations

from dataclasses import dataclass

from api.services.ai_provider_router.policy import AiProviderKind


@dataclass(frozen=True, slots=True)
class EliteewHttpProviderProbe:
    """Configuration probe for ai.eliteew (platform LLM HTTP)."""

    kind: AiProviderKind = AiProviderKind.ELITEEW
    base_url: str = ""
    model: str = ""

    def is_configured(self) -> bool:
        return bool(self.base_url.strip())


def probe_eliteew_http_provider() -> EliteewHttpProviderProbe:
    """Read llama endpoint from UnifiedConfig — fail soft with empty URL if missing."""
    from api.core.unified_config import unified_settings

    base = ""
    model = ""
    try:
        base = str(getattr(unified_settings, "llama_url", "") or "").strip()
    except Exception:
        base = ""
    try:
        model = str(getattr(unified_settings, "default_ai_model", "") or "").strip()
    except Exception:
        model = ""
    return EliteewHttpProviderProbe(base_url=base, model=model)
