"""Auth and user profile domain: OIDC provider, logout, profile, user_profile, themes."""

from __future__ import annotations

from typing import TYPE_CHECKING

from api.utils.router_registration import register_router_v1_and_legacy

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]


def register_domain_auth(app: FastAPI) -> None:
    """Register authentication and user management routers."""
    from api.routers.auth_keycloak import router as auth_keycloak  # noqa: PLC0415
    from api.routers.auth_logout import router as auth_logout  # noqa: PLC0415
    from api.routers.auth_mobile_embedded import router as auth_mobile_embedded  # noqa: PLC0415
    from api.routers.auth_refresh import router as auth_refresh  # noqa: PLC0415
    from api.routers.mobile_app import router as mobile_app  # noqa: PLC0415
    from api.routers.mobile_trusted_devices import router as mobile_trusted_devices  # noqa: PLC0415
    from api.routers.profile import router as profile  # noqa: PLC0415
    from api.routers.themes import router as themes  # noqa: PLC0415
    from api.routers.user_profile import router as user_profile  # noqa: PLC0415

    app.include_router(
        auth_refresh,
        prefix="/api/auth",
        tags=["Auth - Token Refresh (Legacy)"],
    )
    register_router_v1_and_legacy(app, auth_keycloak, v1_tags=["OIDC SSO Authentication"])
    register_router_v1_and_legacy(app, auth_mobile_embedded, v1_tags=["Mobile Embedded WebView Auth"])
    register_router_v1_and_legacy(app, auth_logout, v1_tags=["OAuth2 + OIDC Logout"])
    app.include_router(
        profile,
        prefix="/api",
        tags=["User Profile - OAuth2 Proxy (Legacy)"],
    )
    app.include_router(
        user_profile,
        prefix="/api/v1/profile",
        tags=["User Profile - Complete Profile Management Cabinet"],
    )
    app.include_router(
        user_profile,
        prefix="/api/profile",
        tags=["User Profile - Complete Profile Management Cabinet (Legacy)"],
    )
    register_router_v1_and_legacy(app, themes, v1_tags=["Theme Customization System"])
    register_router_v1_and_legacy(app, mobile_app, v1_tags=["Mobile App"])
    app.include_router(
        mobile_trusted_devices,
        prefix="/api/v1",
        tags=["Mobile Trusted Devices"],
    )
