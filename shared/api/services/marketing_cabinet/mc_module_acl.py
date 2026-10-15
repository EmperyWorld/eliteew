# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Check marketing cabinet mc_module:* grants for non-lead mutation paths.
# Invariants:
# - Lead / company owner bypass is handled by the caller (membership gate).
# - Empty member permissions deny module mutations (no legacy “see all ⇒ write all”).
# Related:
# - api/routers/projects.py (MC_MODULE_SLUGS_ALLOWED — keep in sync)
# - api/routers/marketing_cabinet/common.py
# - documentation/product/marketing/MARKETING-CABINET.md
# ---

from __future__ import annotations

MC_MODULE_PREFIX = "mc_module:"

# Keep aligned with api/routers/projects.py::MC_MODULE_SLUGS_ALLOWED.
_MC_MODULE_SLUGS_ALLOWED = frozenset(
    {
        "jtbd",
        "value_proposition",
        "swot",
        "competitors",
        "researches",
        "content_ai",
        "context_chat",
        "segments",
        "campaigns",
        "funnel",
        "tasks",
        "alerts",
        "ai_studio",
        "amka",
        "imc",
        "imc_research",
        "client_interaction",
        "cabinet_overview",
        "cabinet_companies",
        "cabinet_projects",
        "__mc_none__",
    }
)

# IMC sidebar may grant either slug; both unlock IMC mutations.
_MC_MODULE_MUTATION_ALIASES: dict[str, frozenset[str]] = {
    "imc": frozenset({"imc", "imc_research"}),
    "imc_research": frozenset({"imc", "imc_research"}),
}


def normalize_required_mc_module(slug: str | None) -> str | None:
    if slug is None:
        return None
    value = str(slug).strip()
    if not value:
        return None
    if value not in _MC_MODULE_SLUGS_ALLOWED:
        raise ValueError(f"unknown mc_module slug: {value}")
    return value


def member_permissions_grant_mc_module(
    permissions: object,
    required_mc_module: str,
) -> bool:
    """True when member permissions include mc_module:<required> (with IMC aliases)."""
    required = normalize_required_mc_module(required_mc_module)
    if required is None:
        return True
    accepted = _MC_MODULE_MUTATION_ALIASES.get(required, frozenset({required}))
    if not isinstance(permissions, (list, tuple)):
        return False
    for raw in permissions:
        if not isinstance(raw, str):
            continue
        token = raw.strip()
        if not token.startswith(MC_MODULE_PREFIX):
            continue
        slug = token[len(MC_MODULE_PREFIX) :].strip()
        if slug in accepted:
            return True
    return False
