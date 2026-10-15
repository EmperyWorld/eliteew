# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Facade for Site Studio runtime service — re-exports helpers + SiteStudioRuntimeManager.
# Split modules live under api.services.site_studio_runtime/.
# Invariants:
# - Existing `from api.services.site_studio_runtime_service import …` import sites keep working.
# Related:
# - documentation/product/SITE-STUDIO.md
# - documentation/platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md
# ---
from __future__ import annotations

from api.services.site_studio_runtime.helpers import *  # noqa: F403, F405
from api.services.site_studio_runtime.manager import (
    SiteStudioRuntimeManager as SiteStudioRuntimeManager,
)
from api.services.site_studio_runtime.manager import (
    execute_site_studio_runtime_task as execute_site_studio_runtime_task,
)
from api.services.site_studio_runtime.manager import (
    get_site_studio_runtime_manager as get_site_studio_runtime_manager,
)

# Public facade surface (no private `_` helpers). Keep in sync with helpers.__all__ public names.
__all__ = [  # noqa: F405
    "API_PORT",
    "DEFAULT_RUNTIME_BASE_DIR",
    "DEFAULT_TEMPLATE_KEY",
    "DEFAULT_TEMPLATE_ROOT",
    "FRONTEND_PREVIEW_PORT",
    "SITE_STUDIO_ADMIN_APP_URL",
    "SITE_STUDIO_AURELIA_TEMPLATE_KEY",
    "SITE_STUDIO_COMPOSE_RESTART_POLICY",
    "SITE_STUDIO_DB_SCHEMA_STRATEGY",
    "SITE_STUDIO_HEALTH_POLL_SECONDS",
    "SITE_STUDIO_HEALTH_TIMEOUT_SECONDS",
    "SITE_STUDIO_INTERNAL_HOST",
    "SITE_STUDIO_OLENTI_API_IMAGE",
    "SITE_STUDIO_OLENTI_FRONTEND_IMAGE",
    "SITE_STUDIO_PODMAN_COMPOSE_PROVIDER",
    "SITE_STUDIO_RUNTIME_DEFAULT",
    "SITE_STUDIO_RUNTIME_GID",
    "SITE_STUDIO_RUNTIME_MODE",
    "SITE_STUDIO_RUNTIME_UID",
    "SITE_STUDIO_SUPPORTED_RUNTIMES",
    "SITE_STUDIO_TEMPLATE_PROFILE_STATE_KEY",
    "SiteStudioRuntimeError",
    "SiteStudioRuntimeInstance",
    "SiteStudioRuntimeLayout",
    "SiteStudioRuntimeManager",
    "build_kirs_site_slug",
    "build_site_slug",
    "build_site_studio_internal_api_base_url",
    "build_site_studio_internal_public_url",
    "build_site_studio_public_urls",
    "resolve_site_studio_runtime_health_urls",
    "decrypt_site_studio_secret",
    "encrypt_site_studio_secret",
    "execute_site_studio_runtime_task",
    "get_site_studio_runtime_manager",
    "is_supported_site_studio_template",
    "normalize_site_studio_template_key",
    "read_site_studio_applied_profile_id",
    "resolve_site_studio_public_hostname",
    "resolve_site_studio_template_profile",
    "resolve_site_studio_template_profile_id",
    "resolve_site_studio_template_root",
    "rewrite_site_studio_internal_url",
    "slugify_site_title",
    "with_site_studio_applied_profile",
]
