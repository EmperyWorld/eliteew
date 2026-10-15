# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ai.third_party provider probe — customer OpenAI-compat base URL (no API key).
# Invariants:
# - URL presence ⇒ configured for O3a; key checked only on real calls (O3b).
# - Never read or log API keys here.
# Related:
# - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md §5
# ---

from __future__ import annotations

from dataclasses import dataclass

from api.services.ai_provider_router.policy import AiProviderKind


@dataclass(frozen=True, slots=True)
class ThirdPartyAiProviderProbe:
    kind: AiProviderKind = AiProviderKind.THIRD_PARTY
    base_url: str = ""
    model: str = ""

    def is_configured(self) -> bool:
        return bool(self.base_url.strip())


def probe_third_party_ai_provider() -> ThirdPartyAiProviderProbe:
    from api.core.unified_config import unified_settings

    base = ""
    model = ""
    try:
        base = str(getattr(unified_settings, "eliteew_ai_third_party_base_url", "") or "").strip()
    except Exception:
        base = ""
    try:
        model = str(getattr(unified_settings, "eliteew_ai_third_party_model", "") or "").strip()
    except Exception:
        model = ""
    return ThirdPartyAiProviderProbe(base_url=base, model=model)
