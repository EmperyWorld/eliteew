from __future__ import annotations

from typing import TYPE_CHECKING

from starlette.routing import Host  # type: ignore[import-untyped]

from api.routers.site_studio_public import public_site_studio_app
from api.services.site_studio_public_utils import SITE_STUDIO_PUBLIC_HOST_PATTERN

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]


def register_domain_site_studio_public_gateway(app: FastAPI) -> None:
    """Register wildcard-host public gateway for Site Studio websites."""
    app.router.routes.insert(
        0,
        Host(
            SITE_STUDIO_PUBLIC_HOST_PATTERN,
            app=public_site_studio_app,
            name="site-studio-public",
        ),
    )
