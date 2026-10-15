# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve active AI provider kind from UnifiedConfig (edition packs) + O3a probes.
# Invariants:
# - Allowlist env is a hard floor; empty allowlist → edition defaults.
# - Probes are configuration-only; chat/completions live in completions.py (O3b).
# Related:
# - api/core/unified_config.py (ELITEEW_AI_PROVIDER_*)
# - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md
# ---

from __future__ import annotations

from dataclasses import dataclass

from api.services.ai_provider_router.adapters_eliteew_http import (
    probe_eliteew_http_provider,
)
from api.services.ai_provider_router.adapters_local import probe_local_ai_provider
from api.services.ai_provider_router.adapters_third_party import (
    probe_third_party_ai_provider,
)
from api.services.ai_provider_router.policy import (
    AiProviderKind,
    AiProviderNotConfiguredError,
    EditionName,
    parse_allowlist,
    resolve_provider_kind,
)
from api.services.ai_provider_router.probes import AiProviderProbeView, ProviderProbe


@dataclass(frozen=True, slots=True)
class ActiveAiProviderSnapshot:
    edition: EditionName
    provider: AiProviderKind
    allowlist: frozenset[AiProviderKind]
    default_configured: str


def _settings_ai_inputs() -> tuple[EditionName, str, str]:
    from api.core.unified_config import unified_settings

    edition_raw = str(getattr(unified_settings, "eliteew_product_edition", "cloud") or "cloud")
    edition = edition_raw.strip().lower()
    if edition not in ("cloud", "onprem", "client"):
        raise AiProviderNotConfiguredError(f"ELITEEW_PRODUCT_EDITION invalid for AI router: {edition_raw!r}")
    default = str(getattr(unified_settings, "eliteew_ai_provider_default", "") or "").strip()
    allowlist_raw = str(getattr(unified_settings, "eliteew_ai_providers_allowlist", "") or "").strip()
    return edition, default, allowlist_raw  # type: ignore[return-value]


def get_active_ai_provider_snapshot(
    *,
    user_preference: str | AiProviderKind | None = None,
) -> ActiveAiProviderSnapshot:
    """Env-resolved AI provider selection (pack allowlist hard floor)."""
    edition, default, allowlist_raw = _settings_ai_inputs()
    allowlist = parse_allowlist(allowlist_raw or None, edition=edition)
    provider = resolve_provider_kind(
        edition=edition,
        allowlist=allowlist,
        user_preference=user_preference,
        default=default or None,
    )
    return ActiveAiProviderSnapshot(
        edition=edition,
        provider=provider,
        allowlist=allowlist,
        default_configured=default,
    )


def get_active_ai_provider_kind(
    *,
    user_preference: str | AiProviderKind | None = None,
) -> AiProviderKind:
    return get_active_ai_provider_snapshot(user_preference=user_preference).provider


def probe_provider(kind: AiProviderKind) -> ProviderProbe:
    """Dispatch configuration probe for one provider kind (O3a)."""
    if kind is AiProviderKind.LOCAL:
        return probe_local_ai_provider()
    if kind is AiProviderKind.THIRD_PARTY:
        return probe_third_party_ai_provider()
    if kind is AiProviderKind.ELITEEW:
        return probe_eliteew_http_provider()
    raise AiProviderNotConfiguredError(f"no probe adapter for kind={kind!r}")


def probe_active_provider(
    *,
    user_preference: str | AiProviderKind | None = None,
) -> AiProviderProbeView:
    """Probe the policy-resolved active provider."""
    snap = get_active_ai_provider_snapshot(user_preference=user_preference)
    probe = probe_provider(snap.provider)
    return AiProviderProbeView(
        kind=snap.provider,
        configured=probe.is_configured(),
        base_url=str(getattr(probe, "base_url", "") or ""),
    )


def probe_all_providers() -> dict[AiProviderKind, AiProviderProbeView]:
    """Probe every known kind (for install-profile honesty)."""
    out: dict[AiProviderKind, AiProviderProbeView] = {}
    for kind in AiProviderKind:
        probe = probe_provider(kind)
        out[kind] = AiProviderProbeView(
            kind=kind,
            configured=probe.is_configured(),
            base_url=str(getattr(probe, "base_url", "") or ""),
        )
    return out
