# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Public exports for kernel AI provider router (editions / client pack).
# Invariants:
# - Policy fail-closed; O3a probes; O3b completions (json + stream).
# Related:
# - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md
# ---

from api.services.ai_provider_router.adapters_eliteew_http import (
    EliteewHttpProviderProbe,
    probe_eliteew_http_provider,
)
from api.services.ai_provider_router.adapters_local import (
    LocalAiProviderProbe,
    probe_local_ai_provider,
)
from api.services.ai_provider_router.adapters_third_party import (
    ThirdPartyAiProviderProbe,
    probe_third_party_ai_provider,
)
from api.services.ai_provider_router.completions import (
    AiProviderCompletionEndpoint,
    chat_completion_json,
    chat_completion_stream,
    resolve_active_completion_endpoint,
)
from api.services.ai_provider_router.policy import (
    DEFAULT_ALLOWLIST_BY_EDITION,
    AiProviderKind,
    AiProviderNotConfiguredError,
    parse_allowlist,
    parse_provider_kind,
    resolve_provider_kind,
)
from api.services.ai_provider_router.probes import AiProviderProbeView
from api.services.ai_provider_router.runtime import (
    ActiveAiProviderSnapshot,
    get_active_ai_provider_kind,
    get_active_ai_provider_snapshot,
    probe_active_provider,
    probe_all_providers,
    probe_provider,
)

__all__ = [
    "ActiveAiProviderSnapshot",
    "AiProviderCompletionEndpoint",
    "AiProviderProbeView",
    "DEFAULT_ALLOWLIST_BY_EDITION",
    "AiProviderKind",
    "AiProviderNotConfiguredError",
    "EliteewHttpProviderProbe",
    "LocalAiProviderProbe",
    "ThirdPartyAiProviderProbe",
    "chat_completion_json",
    "chat_completion_stream",
    "get_active_ai_provider_kind",
    "get_active_ai_provider_snapshot",
    "parse_allowlist",
    "parse_provider_kind",
    "probe_active_provider",
    "probe_all_providers",
    "probe_eliteew_http_provider",
    "probe_local_ai_provider",
    "probe_provider",
    "probe_third_party_ai_provider",
    "resolve_active_completion_endpoint",
    "resolve_provider_kind",
]
