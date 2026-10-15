# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Kernel AI provider routing contract for product editions (client-first).
# Invariants:
# - Pack/edition allowlist is a hard floor over user preference.
# - Missing required provider → AiProviderNotConfiguredError (fail closed).
# Related:
# - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md
# - documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md §9
# ---

from __future__ import annotations

from enum import StrEnum
from typing import Literal

EditionName = Literal["cloud", "onprem", "client"]


class AiProviderKind(StrEnum):
    LOCAL = "ai.local"
    THIRD_PARTY = "ai.third_party"
    ELITEEW = "ai.eliteew"


class AiProviderNotConfiguredError(RuntimeError):
    """Required AI provider missing or forbidden by pack policy."""


DEFAULT_ALLOWLIST_BY_EDITION: dict[EditionName, frozenset[AiProviderKind]] = {
    "cloud": frozenset({AiProviderKind.ELITEEW, AiProviderKind.LOCAL, AiProviderKind.THIRD_PARTY}),
    "onprem": frozenset({AiProviderKind.ELITEEW, AiProviderKind.LOCAL, AiProviderKind.THIRD_PARTY}),
    # Client pack: local only by default; ai.third_party / ai.eliteew require ELITEEW_AI_PROVIDERS_ALLOWLIST.
    "client": frozenset({AiProviderKind.LOCAL}),
}


def parse_provider_kind(raw: str | AiProviderKind | None) -> AiProviderKind | None:
    if raw is None:
        return None
    if isinstance(raw, AiProviderKind):
        return raw
    text = str(raw).strip().lower()
    if not text:
        return None
    for kind in AiProviderKind:
        if text == kind.value or text == kind.name.lower():
            return kind
    # Accept short aliases
    aliases = {
        "local": AiProviderKind.LOCAL,
        "third_party": AiProviderKind.THIRD_PARTY,
        "third-party": AiProviderKind.THIRD_PARTY,
        "eliteew": AiProviderKind.ELITEEW,
        "cloud": AiProviderKind.ELITEEW,
    }
    return aliases.get(text)


def parse_allowlist(raw: str | None, *, edition: EditionName) -> frozenset[AiProviderKind]:
    """Empty/None → edition default allowlist. Unknown tokens fail closed."""
    if raw is None or not str(raw).strip():
        return DEFAULT_ALLOWLIST_BY_EDITION[edition]
    kinds: set[AiProviderKind] = set()
    for part in str(raw).split(","):
        kind = parse_provider_kind(part)
        if kind is None:
            raise AiProviderNotConfiguredError(f"unknown AI provider in allowlist: {part!r}")
        kinds.add(kind)
    if not kinds:
        raise AiProviderNotConfiguredError("AI providers allowlist resolved empty")
    return frozenset(kinds)


def resolve_provider_kind(
    *,
    edition: EditionName,
    allowlist: frozenset[AiProviderKind] | None = None,
    user_preference: str | AiProviderKind | None = None,
    default: str | AiProviderKind | None = None,
) -> AiProviderKind:
    """
    Dual-flag: allowlist is hard floor; user_preference wins among allowed;
    else default; else first of local → third_party → eliteew that is allowed.
    """
    allowed = allowlist if allowlist is not None else DEFAULT_ALLOWLIST_BY_EDITION[edition]
    if not allowed:
        raise AiProviderNotConfiguredError(f"no AI providers allowed for edition={edition}")

    pref = parse_provider_kind(user_preference)
    if pref is not None:
        if pref not in allowed:
            raise AiProviderNotConfiguredError(
                f"AI provider {pref.value} forbidden by pack allowlist for edition={edition}"
            )
        return pref

    fallback = parse_provider_kind(default)
    if fallback is not None:
        if fallback not in allowed:
            raise AiProviderNotConfiguredError(f"AI provider default {fallback.value} forbidden by pack allowlist")
        return fallback

    for candidate in (AiProviderKind.LOCAL, AiProviderKind.THIRD_PARTY, AiProviderKind.ELITEEW):
        if candidate in allowed:
            return candidate
    raise AiProviderNotConfiguredError(f"no resolvable AI provider for edition={edition}")
