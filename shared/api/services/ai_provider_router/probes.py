# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared AI provider probe contract (O3a) — is_configured only, no chat yet.
# Invariants:
# - Never log secrets; base_url may be empty when not configured.
# Related:
# - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md §5
# ---

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from api.services.ai_provider_router.policy import AiProviderKind


class ProviderProbe(Protocol):
    """Configuration probe for one AI provider kind."""

    @property
    def kind(self) -> AiProviderKind: ...

    @property
    def base_url(self) -> str: ...

    def is_configured(self) -> bool: ...


@dataclass(frozen=True, slots=True)
class AiProviderProbeView:
    """Serializable probe result for API / tests."""

    kind: AiProviderKind
    configured: bool
    base_url: str = ""
