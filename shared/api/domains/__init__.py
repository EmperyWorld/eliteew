# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Export domain router registration functions used by the FastAPI bootstrap.
# Invariants:
# - Domain modules should be imported here only as lightweight registration functions.
# - Heavy router imports remain lazy inside each domain registration function.
# Related:
# - api/main.py
# ---
"""Domain router registration. Each module registers a group of routers with the FastAPI app."""

from __future__ import annotations

from api.domains.auth import register_domain_auth
from api.domains.bi_ugs import register_domain_bi_ugs
from api.domains.chat import register_domain_chat
from api.domains.content import register_domain_content
from api.domains.creative import register_domain_creative
from api.domains.desktop import register_domain_desktop
from api.domains.desktop_client import register_domain_desktop_client
from api.domains.marketing import register_domain_marketing
from api.domains.misc import register_domain_misc
from api.domains.professional_worlds import register_domain_professional_worlds
from api.domains.site_studio_public import register_domain_site_studio_public_gateway
from api.domains.social import register_domain_social
from api.domains.voice import register_domain_voice

__all__ = [
    "register_domain_auth",
    "register_domain_bi_ugs",
    "register_domain_chat",
    "register_domain_content",
    "register_domain_creative",
    "register_domain_desktop",
    "register_domain_desktop_client",
    "register_domain_marketing",
    "register_domain_misc",
    "register_domain_professional_worlds",
    "register_domain_site_studio_public_gateway",
    "register_domain_social",
    "register_domain_voice",
]
