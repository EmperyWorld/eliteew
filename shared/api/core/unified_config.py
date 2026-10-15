#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pydantic/BaseSettings configuration from environment: service catalog, integrations, ports,
# and derived URLs for internal vs browser-facing HTTP.
# Invariants:
# - Prefer env aliases (``validation_alias``); no secrets in defaults.
# Related:
# - ``api.ewa_platform.desktop.runtime`` (intra-process ``httpx`` to same FastAPI via ``eliteew_self_http_base_url``).
# ---
"""Unified configuration management for EliteEW application. Только env."""

import logging
import os
import secrets
from copy import deepcopy
from enum import StrEnum
from typing import Any, Literal, Self, TypedDict

from pydantic import (  # type: ignore[import-untyped]
    AliasChoices,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict  # type: ignore[import-not-found]


def _env_int(key: str, default: int) -> int:
    v = os.environ.get(key)
    return int(v) if v is not None and str(v).strip() else default


# LAN / operator host for external_port URLs in to_dict (override via HOST_IP)
_DEFAULT_HOST_IP = "192.168.1.141"


def _default_portainer_url() -> str:
    host = os.environ.get("HOST_IP", _DEFAULT_HOST_IP)
    return f"http://{host}:9000"


# Stack5 (SearXNG / Crawl4AI) отключён — дефолтные URL не заданы. Раскомментируй при поднятом compose:
# SEARXNG_INTERNAL_DEFAULT_BASE = "http://stack5-searxng:8080"
# CRAWL4AI_INTERNAL_DEFAULT_BASE = "http://stack5-crawl4ai:11235"
SEARXNG_INTERNAL_DEFAULT_BASE = ""
CRAWL4AI_INTERNAL_DEFAULT_BASE = ""


class StackType(StrEnum):
    DATABASES = "databases"
    AI_SERVICES = "ai_services"
    DEVOPS = "devops"
    DOCUMENTS = "documents"
    COMMUNICATION = "communication"
    DEPLOYMENT = "deployment"


class ServiceConfigDict(TypedDict):
    """TypedDict for ServiceConfig.to_dict() return type."""

    name: str
    container_name: str
    host: str
    internal_port: int
    external_port: int
    stack: str
    internal_url: str
    external_url: str
    health_url: str
    network: str
    enabled: bool
    requires_gpu: bool
    description: str


class ServiceConfig:
    def __init__(
        self,
        name: str,
        container_name: str,
        internal_port: int,
        external_port: int,
        stack: StackType,
        health_endpoint: str = "/health",
        network: str = "ew_net_6211",
        *,
        enabled: bool = True,
        requires_gpu: bool = False,
        description: str = "",
        host: str | None = None,
    ):
        self.name = name
        self.container_name = container_name
        self.internal_port = internal_port
        self.external_port = external_port
        self.stack = stack
        self.health_endpoint = health_endpoint
        self.network = network
        self.enabled = enabled
        self.requires_gpu = requires_gpu
        self.description = description
        self.host = host or container_name

    @property
    def internal_url(self) -> str:
        return f"http://{self.container_name}:{self.internal_port}"

    @property
    def external_url(self) -> str:
        host = os.environ.get("HOST_IP", _DEFAULT_HOST_IP)
        return f"http://{host}:{self.external_port}"

    @property
    def health_url(self) -> str:
        return f"{self.internal_url}{self.health_endpoint}"

    def to_dict(self) -> ServiceConfigDict:
        return {
            "name": self.name,
            "container_name": self.container_name,
            "host": self.host,
            "internal_port": self.internal_port,
            "external_port": self.external_port,
            "stack": self.stack.value,
            "internal_url": self.internal_url,
            "external_url": self.external_url,
            "health_url": self.health_url,
            "network": self.network,
            "enabled": self.enabled,
            "requires_gpu": self.requires_gpu,
            "description": self.description,
        }


class UnifiedConfig(BaseSettings):
    """Docker Compose configuration."""

    # =============================================================================
    #
    # =============================================================================
    app_name: str = "EliteEW  API"
    app_version: str = "2.0.0-unified"
    debug: bool = Field(default=False, validation_alias="DEBUG")
    #: When True, Swagger/ReDoc/OpenAPI paths skip JWT in OAuth2ProtectionMiddleware (see oauth2_protection).
    public_openapi_docs: bool = Field(
        default=False,
        validation_alias=AliasChoices("ELITEEW_PUBLIC_OPENAPI_DOCS", "PUBLIC_OPENAPI_DOCS"),
    )
    api_v1_str: str = Field(default="/api", validation_alias="API_V1_STR")

    #: Product edition label (cloud / onprem / client). Must match active install profile.edition.
    eliteew_product_edition: Literal["cloud", "onprem", "client"] = Field(
        default="cloud",
        validation_alias="ELITEEW_PRODUCT_EDITION",
    )
    #: Named install profile under shared/apps/_profiles/. Empty → default profile for edition.
    eliteew_install_profile: str = Field(
        default="",
        validation_alias="ELITEEW_INSTALL_PROFILE",
    )
    #: Default AI provider kind for editions router (ai.local | ai.third_party | ai.eliteew). Empty → policy fallback.
    eliteew_ai_provider_default: str = Field(
        default="",
        validation_alias="ELITEEW_AI_PROVIDER_DEFAULT",
    )
    #: Comma-separated AI provider allowlist. Empty → edition default allowlist.
    eliteew_ai_providers_allowlist: str = Field(
        default="",
        validation_alias="ELITEEW_AI_PROVIDERS_ALLOWLIST",
    )
    #: Local OpenAI-compat base URL for ai.local probe (O3a). Empty → not configured.
    eliteew_ai_local_base_url: str = Field(
        default="",
        validation_alias="ELITEEW_AI_LOCAL_BASE_URL",
    )
    #: Optional model id for ai.local (display/probe metadata).
    eliteew_ai_local_model: str = Field(
        default="",
        validation_alias="ELITEEW_AI_LOCAL_MODEL",
    )
    #: Third-party OpenAI-compat base URL for ai.third_party probe (O3a). No API key here.
    eliteew_ai_third_party_base_url: str = Field(
        default="",
        validation_alias="ELITEEW_AI_THIRD_PARTY_BASE_URL",
    )
    #: Optional model id for ai.third_party probe metadata.
    eliteew_ai_third_party_model: str = Field(
        default="",
        validation_alias="ELITEEW_AI_THIRD_PARTY_MODEL",
    )
    #: Bearer API key for ai.third_party completions (O3b). Never exposed via probes/install-profile.
    eliteew_ai_third_party_api_key: str = Field(
        default="",
        validation_alias="ELITEEW_AI_THIRD_PARTY_API_KEY",
    )
    #: Gen/Forge Admin Factory control plane (Wave F5). OFF → 503 on factory routes.
    eliteew_factory_enabled: bool = Field(
        default=True,
        validation_alias="ELITEEW_FACTORY_ENABLED",
    )
    #: When false (default), factory intentions run plan/verify only — no implement writes.
    eliteew_factory_autonomous: bool = Field(
        default=False,
        validation_alias="ELITEEW_FACTORY_AUTONOMOUS",
    )
    #: Max verify→fix loops before failed.
    eliteew_factory_max_fix_loops: int = Field(
        default=3,
        ge=0,
        le=20,
        validation_alias="ELITEEW_FACTORY_MAX_FIX_LOOPS",
    )
    #: When true, factory ticks go to Celery queue ewa_factory (default sync).
    eliteew_factory_async_jobs: bool = Field(
        default=False,
        validation_alias="ELITEEW_FACTORY_ASYNC_JOBS",
    )
    #: Wave F7 config-driven assembly (Gate T∧C). Default OFF — Admin shows state.
    eliteew_factory_assembly: bool = Field(
        default=False,
        validation_alias="ELITEEW_FACTORY_ASSEMBLY",
    )

    docker_network: str = "ew_net_6211"

    database_name: str = Field(default="ai_services", validation_alias="POSTGRES_DB")
    database_password: str = Field(
        default="",
        validation_alias="POSTGRES_PASSWORD",
        description="PostgreSQL password (min 16 chars, prefer POSTGRES_PASSWORD env)",
    )

    @field_validator("database_password", mode="before")
    @classmethod
    def validate_database_password_before(cls, v: Any) -> str:  # noqa: ANN401
        """Generate local-dev placeholder if env var is empty; in production require explicit POSTGRES_PASSWORD."""
        is_production = os.environ.get("ELITEEW_ENV", "").strip().lower() == "production"
        if not v or (isinstance(v, str) and v.strip() == ""):
            if is_production:
                raise ValueError("POSTGRES_PASSWORD must be set in production (use env-file aligned with .env.stack1)")
            return secrets.token_urlsafe(32)
        return v

    database_user: str = Field(
        default="ai_user",
        validation_alias="POSTGRES_USER",
        description="PostgreSQL user (must match POSTGRES_USER / superuser in stack1; not the literal role postgres)",
    )

    @field_validator("database_user", mode="before")
    @classmethod
    def validate_database_user_before(cls, v: Any) -> str:  # noqa: ANN401
        """In production require explicit POSTGRES_USER; dev fallback matches stack1 (ai_user)."""
        is_production = os.environ.get("ELITEEW_ENV", "").strip().lower() == "production"
        if is_production and (not v or (isinstance(v, str) and v.strip() == "")):
            raise ValueError("POSTGRES_USER must be set in production (use env-file aligned with .env.stack1)")
        if not v or (isinstance(v, str) and v.strip() == ""):
            return "ai_user"
        return v

    #: SQLAlchemy async engine pool (keep total connections << Postgres max_connections).
    #: Defaults sized for several stack0 processes (api + worker + celery) on shared stack1-postgres
    #: with Paperless and other DBs — see documentation/platform/docker-re_doc/STACK1-POSTGRES-TUNING.md.
    postgres_pool_size: int = Field(default=10, ge=1, le=256, validation_alias="POSTGRES_POOL_SIZE")
    postgres_max_overflow: int = Field(default=15, ge=0, le=256, validation_alias="POSTGRES_MAX_OVERFLOW")
    postgres_pool_timeout: int = Field(default=30, ge=1, validation_alias="POSTGRES_POOL_TIMEOUT")
    postgres_pool_recycle: int = Field(default=3600, ge=0, validation_alias="POSTGRES_POOL_RECYCLE")
    #: asyncpg pool used for raw SQL paths (RAG, marketing vault, user profile, etc.).
    asyncpg_pool_min_size: int = Field(default=1, ge=1, le=64, validation_alias="ASYNCPG_POOL_MIN_SIZE")
    asyncpg_pool_max_size: int = Field(default=5, ge=1, le=64, validation_alias="ASYNCPG_POOL_MAX_SIZE")

    redis_url_override: str | None = Field(default=None, validation_alias="REDIS_URL")
    redis_password: str | None = Field(
        default=None,
        validation_alias="REDIS_PASSWORD",
        description="Redis password for stack1-redis (empty = no AUTH, set in environment)",
    )
    # redis_host is a property, not a field - see @property redis_host() below
    redis_port: int = 6379
    redis_db: int = 0
    minio_access_key: str = Field(
        default="",
        validation_alias=AliasChoices("AWS_ACCESS_KEY_ID", "MINIO_ACCESS_KEY"),
    )
    minio_secret_key: str = Field(
        default="",
        validation_alias=AliasChoices("AWS_SECRET_ACCESS_KEY", "MINIO_SECRET_KEY"),
    )
    minio_secure: bool = Field(
        default=False,
        validation_alias=AliasChoices("S3_SECURE", "MINIO_SECURE"),
    )
    aws_s3_endpoint: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AWS_S3_ENDPOINT", "S3_ENDPOINT", "MINIO_ENDPOINT"),
    )
    s3_bucket: str = Field(
        default="unified-content",
        validation_alias=AliasChoices("S3_BUCKET", "MINIO_BUCKET"),
    )
    content_user_storage_quota_bytes: int = Field(
        default=10 * 1024 * 1024 * 1024,
        ge=1,
        validation_alias="CONTENT_USER_STORAGE_QUOTA_BYTES",
        description="Per-user unified content storage quota in bytes (default 10 GiB).",
    )
    aws_s3_region: str = Field(
        default="us-east-1",
        validation_alias=AliasChoices("AWS_REGION", "S3_REGION"),
        description="Регион для SigV4 при обращении к SeaweedFS/любому S3-совместимому endpoint.",
    )
    s3_bucket_default_encryption: bool | None = Field(
        default=None,
        validation_alias=AliasChoices("S3_BUCKET_DEFAULT_ENCRYPTION", "S3_SSE_BUCKET_DEFAULT"),
        description="Только для дефолтного SSE бакета в object storage. None = наследовать от ENCRYPTION_ENABLED.",
    )

    keycloak_base_url: str = Field(default="http://stack6-keycloak:8080", validation_alias="KEYCLOAK_URL")
    keycloak_public_url: str = Field(default="https://auth.eliteew.ru", validation_alias="KEYCLOAK_PUBLIC_URL")
    keycloak_realm: str = Field(default="empery", validation_alias="KEYCLOAK_REALM")
    keycloak_client_id: str = Field(default="empery-api", validation_alias="KEYCLOAK_CLIENT_ID")
    keycloak_client_secret: str | None = Field(default=None, validation_alias="KEYCLOAK_CLIENT_SECRET")
    # Публичный клиент (SPA): браузерный login / refresh без secret в API.
    keycloak_web_client_id: str = Field(default="empery-web", validation_alias="KEYCLOAK_WEB_CLIENT_ID")
    keycloak_apk_download_client_id: str = Field(
        default="empery-apk-distro",
        validation_alias="KEYCLOAK_APK_DOWNLOAD_CLIENT_ID",
    )
    # Публичный клиент native mobile (AppAuth/PKCE): отдельный client session bucket в Keycloak.
    keycloak_mobile_client_id: str = Field(default="empery-mobile", validation_alias="KEYCLOAK_MOBILE_CLIENT_ID")
    # Публичный клиент native Tauri desktop-client (PKCE): отдельный SSO client_class=desktop.
    keycloak_desktop_client_id: str = Field(
        default="empery-desktop",
        validation_alias="KEYCLOAK_DESKTOP_CLIENT_ID",
    )
    # Публичный клиент FoFline local SPA shell (PKCE): SSO client_class=fofline; XOR vs browser.
    keycloak_fofline_client_id: str = Field(
        default="empery-fofline",
        validation_alias="KEYCLOAK_FOFLINE_CLIENT_ID",
    )
    # browser↔fofline exclusivity: displace (default) | deny | off.
    sso_fofline_browser_xor_policy: str = Field(
        default="displace",
        validation_alias="SSO_FOFLINE_BROWSER_XOR_POLICY",
    )
    # Optional CSV of extra API path prefixes allowed for FoFline remote-tools (W5).
    fofline_remote_tools_extra_prefixes: str = Field(
        default="",
        validation_alias="FOFLINE_REMOTE_TOOLS_EXTRA_PREFIXES",
    )
    #: Optional CSV of extra API path prefixes allowed for client edition remote-tools gate.
    client_remote_tools_extra_prefixes: str = Field(
        default="",
        validation_alias="CLIENT_REMOTE_TOOLS_EXTRA_PREFIXES",
    )
    # Optional Ed25519 seed (32-byte hex) to mint signed offline entitlement on redeem.
    # Unset → redeem still binds device; client uses USB-imported signed file for cold start.
    desktop_client_entitlement_signing_key: str | None = Field(
        default=None,
        validation_alias="DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY",
    )
    desktop_client_capsule_recipient_public_key: str | None = Field(
        default=None,
        validation_alias="DESKTOP_CLIENT_CAPSULE_RECIPIENT_PUBLIC_KEY",
    )
    desktop_client_capsule_signing_key: str | None = Field(
        default=None,
        validation_alias="DESKTOP_CLIENT_CAPSULE_SIGNING_KEY",
    )
    keycloak_ewpower_web_client_id: str = Field(
        default="ewpower-web",
        validation_alias="KEYCLOAK_EWPOWER_WEB_CLIENT_ID",
    )
    keycloak_admin_user: str = Field(default="admin", validation_alias="KEYCLOAK_ADMIN_USER")
    keycloak_admin_password: str | None = Field(default=None, validation_alias="KEYCLOAK_ADMIN_PASSWORD")
    keycloak_verify_audience: bool = Field(default=True, validation_alias="KEYCLOAK_VERIFY_AUDIENCE")
    # TLS verification for direct httpx calls to KEYCLOAK_URL (e.g. token revoke). False only for dev / lab MITM.
    keycloak_http_verify_tls: bool = Field(default=True, validation_alias="KEYCLOAK_HTTP_VERIFY_TLS")
    # Stage 2 / Wave C: provider selection with instant rollback to keycloak.
    auth_provider_backend: str = Field(default="keycloak", validation_alias="AUTH_PROVIDER_BACKEND")
    # Optional shadow validation (side-by-side): does not affect auth decision.
    auth_provider_shadow_enabled: bool = Field(default=False, validation_alias="AUTH_PROVIDER_SHADOW_ENABLED")
    auth_provider_shadow_backend: str = Field(default="", validation_alias="AUTH_PROVIDER_SHADOW_BACKEND")
    # Generic OIDC pilot adapter settings (used when AUTH_PROVIDER_BACKEND=oidc_generic).
    oidc_provider_issuer_url: str = Field(default="", validation_alias="OIDC_PROVIDER_ISSUER_URL")
    oidc_provider_client_id: str | None = Field(default=None, validation_alias="OIDC_PROVIDER_CLIENT_ID")
    oidc_provider_client_secret: str | None = Field(default=None, validation_alias="OIDC_PROVIDER_CLIENT_SECRET")
    oidc_provider_web_client_id: str | None = Field(default=None, validation_alias="OIDC_PROVIDER_WEB_CLIENT_ID")
    oidc_provider_verify_audience: bool = Field(default=True, validation_alias="OIDC_PROVIDER_VERIFY_AUDIENCE")
    # Comma-separated client ids used by token role resolver (provider-neutral).
    # Empty means backward-compatible fallback to keycloak/oidc client ids from config.
    auth_role_client_ids: str = Field(default="", validation_alias="AUTH_ROLE_CLIENT_IDS")

    jwt_algorithm: str = Field(default="RS256", validation_alias="JWT_ALGORITHM")
    jwt_secret_key: str | None = Field(default=None, validation_alias="JWT_SECRET_KEY")
    jwt_audience: str = Field(default="empery-api,account", validation_alias="JWT_AUDIENCE")
    #: Symmetric HS256 session tokens from :mod:`api.services.session_service` (not Keycloak RS256 claims).
    hs256_session_jwt_issuer: str = Field(default="emperyworld-auth", validation_alias="HS256_SESSION_JWT_ISSUER")
    hs256_session_jwt_audience: str = Field(default="emperyworld-api", validation_alias="HS256_SESSION_JWT_AUDIENCE")
    secret_key: str | None = Field(default=None, validation_alias="SECRET_KEY")
    # Stack11 / Jitsi Meet: API signs short-lived room tokens, Prosody validates the same secret.
    jitsi_app_id: str = Field(default="jitsi", validation_alias="JITSI_APP_ID")
    jitsi_app_secret: str | None = Field(default=None, validation_alias="JITSI_APP_SECRET")
    jitsi_jwt_secret: str | None = Field(default=None, validation_alias="JITSI_JWT_SECRET")
    jitsi_public_url: str = Field(default="https://meet.eliteew.ru", validation_alias="JITSI_PUBLIC_URL")
    jitsi_xmpp_domain: str = Field(default="meet.eliteew.ru", validation_alias="JITSI_XMPP_DOMAIN")
    jitsi_token_ttl_seconds: int = Field(
        default=3600,
        ge=60,
        le=24 * 3600,
        validation_alias="JITSI_TOKEN_TTL_SECONDS",
    )
    mobile_apk_path: str = Field(
        default="/app/mobile-release/empery-mobile.apk",
        validation_alias="MOBILE_APK_PATH",
        description="Production Android APK on API host (ro mount from local/binaries release store).",
    )
    mobile_release_base_url: str | None = Field(
        default="http://stack-mobile-release",
        validation_alias="MOBILE_RELEASE_BASE_URL",
        description="Dedicated OTA nginx (stack-mobile-release): manifest at /v1/manifest.json.",
    )
    mobile_app_download_page_url: str = Field(
        default="https://app.eliteew.ru/mobile-app/",
        validation_alias="MOBILE_APP_DOWNLOAD_PAGE_URL",
        description="Fixed SPA page: Keycloak login then APK download for Telegram/bot links.",
    )
    mobile_trusted_device_wg_endpoint: str | None = Field(
        default=None,
        validation_alias="MOBILE_TRUSTED_DEVICE_WG_ENDPOINT",
        description="WireGuard endpoint returned to trusted MobileAndroid devices, e.g. edge.example:51822.",
    )
    mobile_trusted_device_wg_server_public_key: str | None = Field(
        default=None,
        validation_alias="MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY",
        description="WireGuard server public key returned to trusted MobileAndroid devices.",
    )
    mobile_trusted_device_wg_dns: str = Field(
        default="10.88.88.1",
        validation_alias="MOBILE_TRUSTED_DEVICE_WG_DNS",
        description="Tunnel DNS address for trusted MobileAndroid devices.",
    )
    mobile_trusted_device_wg_allowed_ips: str = Field(
        default="10.88.88.1/32",
        validation_alias="MOBILE_TRUSTED_DEVICE_WG_ALLOWED_IPS",
        description="AllowedIPs returned to trusted MobileAndroid devices.",
    )
    mobile_trusted_device_wg_mtu: int = Field(
        default=1280,
        ge=576,
        le=1500,
        validation_alias="MOBILE_TRUSTED_DEVICE_WG_MTU",
        description="Client WireGuard MTU for trusted MobileAndroid private tunnel (cellular-safe default 1280).",
    )
    mobile_trusted_device_wg_peer_ip_prefix: str = Field(
        default="10.88.88.",
        validation_alias="MOBILE_TRUSTED_DEVICE_WG_PEER_IP_PREFIX",
        description="IPv4 prefix used by API to assign trusted MobileAndroid peer addresses.",
    )
    mobile_trusted_device_wg_peer_ip_start: int = Field(
        default=101,
        ge=2,
        le=254,
        validation_alias="MOBILE_TRUSTED_DEVICE_WG_PEER_IP_START",
        description="First host octet for trusted MobileAndroid WireGuard peer assignment.",
    )
    mobile_private_tunnel_edge_sync_enabled: bool = Field(
        default=False,
        validation_alias="MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED",
        description="When true, Celery reconciles active trusted-device WG peers onto the edge VM after bind/revoke/rotate.",
    )
    mobile_private_tunnel_edge_ssh_host: str | None = Field(
        default=None,
        validation_alias="MOBILE_PRIVATE_TUNNEL_EDGE_SSH_HOST",
        description="SSH host for incremental wg-mobile peer reconcile (typically Yandex edge public IP).",
    )
    mobile_private_tunnel_edge_ssh_user: str = Field(
        default="eliteew-edge",
        validation_alias="MOBILE_PRIVATE_TUNNEL_EDGE_SSH_USER",
        description="SSH user for mobile private tunnel edge peer reconcile.",
    )
    mobile_private_tunnel_edge_ssh_private_key: str | None = Field(
        default=None,
        validation_alias="MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY",
        description="PEM private key for edge SSH (config plane only; never log).",
    )
    mobile_private_tunnel_edge_ssh_timeout_seconds: int = Field(
        default=15,
        ge=5,
        le=120,
        validation_alias="MOBILE_PRIVATE_TUNNEL_EDGE_SSH_TIMEOUT_SECONDS",
        description="SSH connect and remote wg command timeout for edge peer reconcile.",
    )
    desktop_client_portal_edge_sync_enabled: bool = Field(
        default=False,
        validation_alias="DESKTOP_CLIENT_PORTAL_EDGE_SYNC_ENABLED",
        description="When true, Celery syncs desktop_client_portal_peers onto edge wg-portal.",
    )
    desktop_client_portal_edge_sync_mode: str = Field(
        default="additive",
        validation_alias="DESKTOP_CLIENT_PORTAL_EDGE_SYNC_MODE",
        description=(
            "Portal edge sync mode: 'additive' (default; keep foreign peers) or "
            "'full_iface' (edge peers == DB actives only; enable only after parity green)."
        ),
    )
    desktop_client_portal_edge_ssh_host: str | None = Field(
        default=None,
        validation_alias="DESKTOP_CLIENT_PORTAL_EDGE_SSH_HOST",
        description="SSH host for wg-portal peer sync (edge VM). Separate from mobile_* settings.",
    )
    desktop_client_portal_edge_ssh_user: str = Field(
        default="eliteew-edge",
        validation_alias="DESKTOP_CLIENT_PORTAL_EDGE_SSH_USER",
        description="SSH user for desktop portal edge peer sync.",
    )
    desktop_client_portal_edge_ssh_private_key: str | None = Field(
        default=None,
        validation_alias="DESKTOP_CLIENT_PORTAL_EDGE_SSH_PRIVATE_KEY",
        description="PEM private key for portal edge SSH (config plane only; never log).",
    )
    desktop_client_portal_edge_ssh_timeout_seconds: int = Field(
        default=15,
        ge=5,
        le=120,
        validation_alias="DESKTOP_CLIENT_PORTAL_EDGE_SSH_TIMEOUT_SECONDS",
        description="SSH timeout for desktop portal edge peer sync.",
    )
    desktop_client_portal_edge_reconcile_interval_minutes: int = Field(
        default=15,
        ge=5,
        le=1440,
        validation_alias="DESKTOP_CLIENT_PORTAL_EDGE_RECONCILE_INTERVAL_MINUTES",
        description="Celery beat interval for additive portal peer sync when enabled (Wave 3b.1).",
    )
    desktop_client_portal_peer_keepalive_seconds: int = Field(
        default=25,
        ge=0,
        le=120,
        validation_alias="DESKTOP_CLIENT_PORTAL_PEER_KEEPALIVE_SECONDS",
        description="PersistentKeepalive for DB-managed wg-portal peers.",
    )
    desktop_client_portal_endpoint: str | None = Field(
        default=None,
        validation_alias="DESKTOP_CLIENT_PORTAL_ENDPOINT",
        description="Client Endpoint host:port for handoff conf (e.g. edge public IP:51823).",
    )
    desktop_client_portal_edge_public_key: str | None = Field(
        default=None,
        validation_alias="DESKTOP_CLIENT_PORTAL_EDGE_PUBLIC_KEY",
        description="Edge wg-portal interface public key for client handoff conf Peer block.",
    )
    mobile_private_tunnel_interface: str = Field(
        default="wg-mobile",
        validation_alias="MOBILE_PRIVATE_TUNNEL_INTERFACE",
        description="WireGuard interface name on the edge VM for trusted MobileAndroid peers.",
    )
    mobile_private_tunnel_peer_keepalive_seconds: int = Field(
        default=25,
        ge=0,
        le=300,
        validation_alias="MOBILE_PRIVATE_TUNNEL_PEER_KEEPALIVE_SECONDS",
        description="persistent-keepalive applied when reconciling mobile WG peers on the edge.",
    )
    mobile_private_tunnel_edge_reconcile_interval_minutes: int = Field(
        default=10,
        ge=3,
        le=120,
        validation_alias="MOBILE_PRIVATE_TUNNEL_EDGE_RECONCILE_INTERVAL_MINUTES",
        description="Celery beat interval for full DB→edge peer parity reconcile.",
    )
    mobile_trusted_device_smtp_host: str = Field(
        default="",
        validation_alias="MOBILE_TRUSTED_DEVICE_SMTP_HOST",
        description="SMTP host used by trusted-device transfer email confirmation.",
    )
    mobile_trusted_device_smtp_port: int = Field(
        default=587,
        ge=1,
        le=65535,
        validation_alias="MOBILE_TRUSTED_DEVICE_SMTP_PORT",
        description="SMTP port used by trusted-device transfer email confirmation.",
    )
    mobile_trusted_device_smtp_username: str = Field(
        default="",
        validation_alias="MOBILE_TRUSTED_DEVICE_SMTP_USERNAME",
        description="SMTP username used by trusted-device transfer email confirmation.",
    )
    mobile_trusted_device_smtp_password: str | None = Field(
        default=None,
        validation_alias="MOBILE_TRUSTED_DEVICE_SMTP_PASSWORD",
        description="SMTP password used by trusted-device transfer email confirmation.",
    )
    mobile_trusted_device_smtp_from_email: str = Field(
        default="secrets@eliteew.ru",
        validation_alias="MOBILE_TRUSTED_DEVICE_SMTP_FROM_EMAIL",
        description="From address for trusted-device transfer email confirmation.",
    )
    mobile_trusted_device_smtp_starttls: bool = Field(
        default=True,
        validation_alias="MOBILE_TRUSTED_DEVICE_SMTP_STARTTLS",
        description="Use STARTTLS for trusted-device transfer SMTP.",
    )
    mobile_trusted_device_smtp_ssl: bool = Field(
        default=False,
        validation_alias="MOBILE_TRUSTED_DEVICE_SMTP_SSL",
        description="Use implicit TLS for trusted-device transfer SMTP.",
    )
    mobile_trusted_device_smtp_timeout_seconds: float = Field(
        default=10.0,
        ge=1.0,
        le=60.0,
        validation_alias="MOBILE_TRUSTED_DEVICE_SMTP_TIMEOUT_SECONDS",
        description="SMTP timeout for trusted-device transfer email confirmation.",
    )
    mobile_fcm_enabled: bool = Field(
        default=True,
        validation_alias="MOBILE_FCM_ENABLED",
        description="When false, API never sends FCM fallback pushes to Android.",
    )
    video_call_ringing_answer_timeout_seconds: int = Field(
        default=30,
        ge=10,
        le=120,
        validation_alias="VIDEO_CALL_RINGING_ANSWER_TIMEOUT_SECONDS",
        description="Seconds after successful 1:1 call delivery before auto-missed no_answer.",
    )
    video_call_delivery_retry_count: int = Field(
        default=3,
        ge=1,
        le=10,
        validation_alias="VIDEO_CALL_DELIVERY_RETRY_COUNT",
        description="Delivery watchdog attempts before callee_unreachable missed.",
    )
    video_call_delivery_retry_interval_seconds: int = Field(
        default=5,
        ge=2,
        le=60,
        validation_alias="VIDEO_CALL_DELIVERY_RETRY_INTERVAL_SECONDS",
        description="Seconds between incoming-call delivery retries.",
    )
    mobile_fcm_project_id: str | None = Field(
        default=None,
        validation_alias="MOBILE_FCM_PROJECT_ID",
        description="Firebase project id for FCM HTTP v1 (defaults to project_id in service account JSON).",
    )
    mobile_fcm_service_account_json: str | None = Field(
        default=None,
        validation_alias="MOBILE_FCM_SERVICE_ACCOUNT_JSON",
        description="Path to Firebase service account JSON or inline JSON string for FCM HTTP v1.",
    )
    mobile_fcm_server_key: str | None = Field(
        default=None,
        validation_alias="MOBILE_FCM_SERVER_KEY",
        description="Legacy FCM server key (optional fallback when service account JSON is not set).",
    )

    prometheus_url: str = Field(default="http://stack3-prometheus:9090", validation_alias="PROMETHEUS_URL")
    grafana_url: str = Field(default="http://stack3-grafana:3000", validation_alias="GRAFANA_URL")

    rate_limit_enabled: bool = Field(default=True, validation_alias="RATE_LIMIT_ENABLED")
    rate_limit_per_minute: int = Field(default=60, validation_alias="RATE_LIMIT_PER_MINUTE")
    upload_rate_limit_per_minute: int = Field(default=10, validation_alias="UPLOAD_RATE_LIMIT_PER_MINUTE")
    upload_rate_limit_burst: int = Field(default=20, validation_alias="UPLOAD_RATE_LIMIT_BURST")
    feedback_ticket_rate_limit_per_minute: int = Field(
        default=8,
        ge=1,
        le=120,
        validation_alias="FEEDBACK_TICKET_RATE_LIMIT_PER_MINUTE",
        description="Лимит создания обращений (feedback) на пользователя в минуту",
    )
    feedback_ticket_rate_limit_burst: int = Field(
        default=12,
        ge=1,
        le=200,
        validation_alias="FEEDBACK_TICKET_RATE_LIMIT_BURST",
        description="Бurst для лимита обращений (token bucket)",
    )
    assistant_chat_rate_limit_per_minute: int = Field(
        default=20,
        ge=1,
        le=120,
        validation_alias="ASSISTANT_CHAT_RATE_LIMIT_PER_MINUTE",
        description="Лимит POST /product-desktop/assistant/chat и /assistant/chat/stream на пользователя в минуту",
    )
    assistant_chat_rate_limit_burst: int = Field(
        default=30,
        ge=1,
        le=200,
        validation_alias="ASSISTANT_CHAT_RATE_LIMIT_BURST",
        description="Burst для лимита чата справочника (token bucket)",
    )
    feedback_wish_limit_default: int = Field(
        default=2,
        ge=1,
        le=10_000,
        validation_alias="FEEDBACK_WISH_LIMIT_DEFAULT",
        description="Максимум пожеланий (wish) на пользователя за всё время — обычный аккаунт",
    )
    feedback_bug_limit_default: int = Field(
        default=5,
        ge=1,
        le=10_000,
        validation_alias="FEEDBACK_BUG_LIMIT_DEFAULT",
        description="Максимум сообщений об ошибках (bug) на пользователя — обычный аккаунт",
    )
    feedback_wish_limit_trusted: int = Field(
        default=5,
        ge=1,
        le=10_000,
        validation_alias="FEEDBACK_WISH_LIMIT_TRUSTED",
        description="Максимум пожеланий (wish) — пользователь с is_trusted",
    )
    feedback_bug_limit_trusted: int = Field(
        default=10,
        ge=1,
        le=10_000,
        validation_alias="FEEDBACK_BUG_LIMIT_TRUSTED",
        description="Максимум сообщений об ошибках (bug) — пользователь с is_trusted",
    )
    marketing_cabinet_ai_rate_limit_per_minute: int = Field(
        default=30,
        validation_alias="MARKETING_CABINET_AI_RATE_LIMIT_PER_MIN",
        description="Лимит AI-запросов маркетингового кабинета на пользователя в минуту (кламп на стороне rate_limiter)",
    )
    amka_audit_llm_delay_ms: int = Field(
        default=450,
        ge=0,
        le=60_000,
        validation_alias="AMKA_AUDIT_LLM_DELAY_MS",
        description="Пауза между LLM-вызовами аудита AMKA по разделам (сопоставимо с кнопкой «Все разделы»)",
    )
    amka_audit_llm_parallelism: int = Field(
        default=1,
        ge=1,
        le=8,
        validation_alias="AMKA_AUDIT_LLM_PARALLELISM",
        description="Параллельные LLM-вызовы аудита AMKA (1 = строго по очереди с задержкой)",
    )
    amka_master_plan_retry_on_parse: bool = Field(
        default=False,
        validation_alias="AMKA_MASTER_PLAN_RETRY_ON_PARSE",
        description="Глобально разрешить один retry LLM master plan при пустом/непарсящемся JSON (дополняет retry_on_parse_failure в конструкторе AMKA)",
    )
    amka_master_plan_repair_json: bool = Field(
        default=False,
        validation_alias="AMKA_MASTER_PLAN_REPAIR_JSON",
        description="Глобально разрешить один вызов repair LLM для починки сырого JSON master plan AMKA (дополняет repair_json_on_parse_failure в конструкторе)",
    )
    amka_project_generate_step_max_wait_seconds: float = Field(
        default=900.0,
        ge=30.0,
        le=7200.0,
        validation_alias="AMKA_PROJECT_GENERATE_STEP_MAX_WAIT_SEC",
        description="Максимум ожидания завершения дочернего marketing_ai_run при шаге AMKA project_generate_async",
    )
    amka_section_audit_context_max_chars: int = Field(
        default=10_000,
        ge=500,
        le=100_000,
        validation_alias="AMKA_SECTION_AUDIT_CONTEXT_MAX_CHARS",
        description="Максимум символов секционного RAG+контекста в промпте LLM-аудита AMKA",
    )
    amka_execute_reuse_merged_context_between_steps: bool = Field(
        default=False,
        validation_alias="AMKA_EXECUTE_REUSE_MERGED_CONTEXT",
        description="Если true — между шагами execute переиспользовать project_context_text, пока предыдущий шаг не менял данные (осторожно: устаревание после мутаций)",
    )
    marketing_dashboard_write_rate_limit_per_minute: int = Field(
        default=120,
        validation_alias="MARKETING_DASHBOARD_WRITE_RATE_LIMIT_PER_MIN",
        description="Лимит мутаций интерактивного дашборда (макет/виджеты) на пользователя в минуту",
    )
    marketing_dashboard_max_widgets_per_layout: int = Field(
        default=60,
        ge=1,
        le=500,
        validation_alias="MARKETING_DASHBOARD_MAX_WIDGETS_PER_LAYOUT",
        description="Максимум виджетов на одном макете дашборда (POST add widget)",
    )
    marketing_dashboard_post_widget_max_bytes: int = Field(
        default=131_072,
        ge=4096,
        le=8_388_608,
        validation_alias="MARKETING_DASHBOARD_POST_WIDGET_MAX_BYTES",
        description="Верхняя граница Content-Length для POST /dashboard-layouts/widgets (multipart JSON)",
    )
    marketing_dashboard_disabled_widget_keys: str = Field(
        default="",
        validation_alias="MARKETING_DASHBOARD_DISABLED_WIDGET_KEYS",
        description="Скрыть типы виджетов в UI: widget_key через запятую (фичефлаг)",
    )
    marketing_dashboard_widget_config_url_allowlist: str = Field(
        default="",
        validation_alias="MARKETING_DASHBOARD_WIDGET_CONFIG_URL_ALLOWLIST",
        description="Разрешённые hostname для строковых http(s) URL в widget_config (иначе очищаются); через запятую",
    )
    marketing_cabinet_llama_timeout_chat_seconds: float = Field(
        default=180.0,
        validation_alias="MARKETING_CABINET_LLAMA_TIMEOUT_CHAT_SEC",
        description="Таймаут HTTP к Llama/vLLM для чата маркетингового кабинета (сек)",
    )
    marketing_cabinet_llama_timeout_extract_seconds: float = Field(
        default=240.0,
        validation_alias="MARKETING_CABINET_LLAMA_TIMEOUT_EXTRACT_SEC",
        description="Таймаут для JTBD extract в маркетинговом кабинете (сек)",
    )
    marketing_cabinet_llama_timeout_swot_seconds: float = Field(
        default=240.0,
        validation_alias="MARKETING_CABINET_LLAMA_TIMEOUT_SWOT_SEC",
        description="Таймаут для генерации SWOT в маркетинговом кабинете (сек)",
    )
    marketing_cabinet_router_model: str = Field(
        ...,
        min_length=1,
        validation_alias="MARKETING_CABINET_ROUTER_MODEL",
        description=(
            "Модель Llama для tool-agent маршрутизатора маркетингового кабинета (docker/env_file/.env.stack0.backend)."
        ),
    )
    imc_rag_max_prompt_chars: int = Field(
        default=120_000,
        ge=4096,
        le=600_000,
        validation_alias="IMC_RAG_MAX_PROMPT_CHARS",
        description="Макс. длина промпта ИМК RAG на шаг оркестрации / single-shot (символы); контекст проекта режется при превышении",
    )
    imc_rag_merge_max_prompt_chars: int = Field(
        default=280_000,
        ge=4096,
        le=600_000,
        validation_alias="IMC_RAG_MERGE_MAX_PROMPT_CHARS",
        description="Макс. длина промпта только для финального merge (все черновики разделов); держите выше imc_rag_max_prompt_chars",
    )
    imc_rag_num_predict: int = Field(
        default=49_152,
        ge=512,
        le=262_144,
        validation_alias="IMC_RAG_NUM_PREDICT",
        description="Потолок новых токенов ответа ИМК (Llama options.num_predict); увеличьте при ОПП на GPU",
    )
    imc_rag_llama_num_ctx: int = Field(
        default=32_768,
        ge=0,
        le=262_144,
        validation_alias="IMC_RAG_LLAMA_NUM_CTX",
        description=(
            "Llama options.num_ctx для ИМК RAG; 0 = не передавать (дефолт модели). "
            "Держите согласованным с -c / LLAMA_CHAT_CTX у llama-chat на stack2 (256 Ki KV class, до 262_144)."
        ),
    )
    imc_rag_llama_repeat_penalty: float = Field(
        default=1.18,
        ge=1.0,
        le=2.0,
        validation_alias="IMC_RAG_LLAMA_REPEAT_PENALTY",
        description="Llama options.repeat_penalty; 1.0 = не передавать",
    )
    imc_rag_llama_repeat_last_n: int = Field(
        default=128,
        ge=0,
        le=2048,
        validation_alias="IMC_RAG_LLAMA_REPEAT_LAST_N",
        description="Llama options.repeat_last_n; 0 = не передавать",
    )
    imc_rag_llama_top_p: float = Field(
        default=0.92,
        ge=0.0,
        le=1.0,
        validation_alias="IMC_RAG_LLAMA_TOP_P",
        description="Llama options.top_p; 0 или 1 = не передавать",
    )
    imc_rag_repetition_trim_min_bold: int = Field(
        default=18,
        ge=6,
        le=200,
        validation_alias="IMC_RAG_REPETITION_TRIM_MIN_BOLD",
        description="Обрезка хвоста при ≥N подряд одинаковых **фрагментов** (зацикливание модели)",
    )
    imc_rag_llama_generate_timeout_seconds: float = Field(
        default=2400.0,
        ge=60.0,
        le=7200.0,
        validation_alias="IMC_RAG_LLAMA_GENERATE_TIMEOUT_SEC",
        description="HTTP read timeout для POST /api/generate в imc_rag_research_provider (длинные отчёты, большой num_predict)",
    )
    imc_rag_orchestrate_max_steps_cap: int = Field(
        default=12,
        ge=2,
        le=24,
        validation_alias="IMC_RAG_ORCHESTRATE_MAX_STEPS_CAP",
        description="Верхняя граница числа шагов оркестрации ИМК RAG (срез type_metadata.imc_rag_orchestrate_max_steps)",
    )
    imc_rag_trace: bool = Field(
        default=False,
        validation_alias="IMC_RAG_TRACE",
        description="Подробные логи [STEP] imc.rag_trace.*: запрос RAG, чанки Qdrant, превью контекста и Llama prompt/response",
    )
    imc_rag_trace_full: bool = Field(
        default=False,
        validation_alias="IMC_RAG_TRACE_FULL",
        description="При IMC_RAG_TRACE=1 писать полный prompt/ответ в DEBUG (очень большие сообщения)",
    )
    ugs_sanitize_string_max_chars: int = Field(
        default=1_048_576,
        ge=8192,
        le=16_777_216,
        validation_alias="UGS_SANITIZE_STRING_MAX_CHARS",
        description=(
            "Макс. длина одной строки в JSON результата UGS после sanitize (generation_requests.output_data, get_result). "
            "Глубокое ИМК (markdown) легко превышает 32 KiB; иначе в отчёте появляется ...TRUNCATED..."
        ),
    )

    encryption_enabled: bool = Field(default=True, validation_alias="ENCRYPTION_ENABLED")
    encryption_master_key: str | None = Field(default=None, validation_alias="ENCRYPTION_MASTER_KEY")

    malware_scan_enabled: bool = Field(default=True, validation_alias="MALWARE_SCAN_ENABLED")

    registration_enabled: bool = Field(default=False, validation_alias="REGISTRATION_ENABLED")
    admin_panel_enabled: bool = Field(default=True, validation_alias="ADMIN_PANEL_ENABLED")
    monitoring_enabled: bool = Field(default=True, validation_alias="MONITORING_ENABLED")

    host_ip: str = Field(default=_DEFAULT_HOST_IP, validation_alias="HOST_IP")
    external_domain: str = Field(default="eliteew.ru", validation_alias="EXTERNAL_DOMAIN")
    public_publish_port: int = Field(default=28999, validation_alias="PUBLIC_PUBLISH_PORT")
    public_base_url_override: str | None = Field(default=None, validation_alias="PUBLIC_BASE_URL")
    #: Uvicorn listen port inside API container (distinct from ``PUBLIC_PUBLISH_PORT``, often used for WebSocket host mapping).
    api_listen_http_port: int = Field(default=8000, validation_alias="API_PORT")
    #: Optional full base URL for intra-process ``httpx`` to this same FastAPI instance (desktop driver, orchestration hints).
    eliteew_self_http_base_url_override: str | None = Field(default=None, validation_alias="ELITEEW_SELF_HTTP_BASE_URL")

    environment: str = Field(default="production", validation_alias="ELITEEW_ENV")
    jaeger_agent_host: str | None = Field(default=None, validation_alias="OTEL_EXPORTER_JAEGER_AGENT_HOST")
    jaeger_agent_port: int = Field(default=6831, validation_alias="OTEL_EXPORTER_JAEGER_AGENT_PORT")
    log_level: str = Field(default="DEBUG", validation_alias="ELITEEW_LOG_LEVEL")
    log_file: str | None = Field(
        default=None,
        validation_alias="ELITEEW_LOG_FILE",
        description="If set, duplicate logs to this file (e.g. /data/logs/api.log or logs/eliteew-api.log)",
    )

    airflow_url_override: str | None = Field(default=None, validation_alias="AIRFLOW_URL")
    airflow_username: str = Field(default="admin", validation_alias="AIRFLOW_USERNAME")
    airflow_password: str | None = Field(default=None, validation_alias="AIRFLOW_PASSWORD")

    # Имя LLAMA_URL историческое: сюда указывают любой HTTP LLM — нативный Llama или OpenAI-compat (llama.cpp на stack2).
    # Пустое значение: см. свойство llama_url ниже и дефолт host:port для stack2-llama в create().
    # Канон для оператора: documentation/platform/docker-re_doc/STACK0-LLM-OVERVIEW.md
    llama_base_url: str | None = Field(
        default=None,
        validation_alias="LLAMA_URL",
        description=(
            "Базовый HTTP URL текстового LLM. История имени не требует демона Llama — допустим OpenAI-compat llama-server. "
            "Пусто → llama_url собирается из LLAMA_HOST:LLAMA_PORT (дефолт stack2-llama:11434); см. STACK0-LLM-OVERVIEW.md."
        ),
    )
    #: Отдельный llama-server только для эмбеддингов (POST /v1/embeddings). Пусто = тот же хост, что LLAMA_URL (/api/embed у Llama).
    llama_embedding_url: str | None = Field(default=None, validation_alias="LLAMA_EMBEDDING_URL")
    #: Отдельный llama-server с --reranking: POST {base}/v1/rerank. Пусто = реранк выключен (порядок как в Qdrant).
    rag_rerank_base_url: str = Field(default="", validation_alias="RAG_RERANK_BASE_URL")

    @field_validator("rag_rerank_base_url", mode="before")
    @classmethod
    def _normalize_rag_rerank_base_url(cls, v: Any) -> str:
        if v is None:
            return ""
        s = str(v).strip()
        return s.rstrip("/") if s else ""

    # Primary Llama (remote GPU): tried first for chat; if unavailable, use llama_url + session model.
    llama_primary_url: str | None = Field(
        default=None,
        validation_alias="LLAMA_PRIMARY_URL",
        description="Primary Llama URL. Tried first; set to empty to disable.",
    )
    llama_primary_model: str = Field(
        default="",
        validation_alias="LLAMA_PRIMARY_MODEL",
        description="Model when primary Llama is available; пусто = LLAMA_MODEL (см. .env.stack0.backend).",
    )
    ugs_llama_chat_read_timeout_seconds: float = Field(
        default=300.0,
        ge=60.0,
        le=3600.0,
        validation_alias="UGS_LLAMA_CHAT_READ_TIMEOUT_SEC",
        description=("HTTP read timeout LlamaProvider (UGS chat/generate: music lyrics, text chat, image prompts)."),
    )

    @field_validator("llama_primary_url", mode="before")
    @classmethod
    def _empty_primary_llama_is_none(cls, v: Any) -> str | None:
        if v is None:
            return v
        s = str(v).strip() if v else ""
        return s or None  # empty env disables primary

    llama_health_endpoint: str = Field(
        default="/api/tags",
        validation_alias="LLAMA_HEALTH_ENDPOINT",
        description=(
            "Legacy health path hint: native Llama often uses /api/tags; llama.cpp server uses GET /health. "
            "LlamaService and llm_openai_compat_http probe /health first, then /api/tags, then /v1/models."
        ),
    )
    # If True — use /v1/chat/completions (vLLM/OpenAI). If False — /api/chat (Llama). None — auto: /api/tags → Llama, иначе /health + /v1/models (llama.cpp).
    llama_use_openai_api: bool | None = Field(
        default=None,
        validation_alias="LLAMA_USE_OPENAI_API",
        description="Force OpenAI API (True) or native Llama (False). None = auto-detect (llama-server без /api/generate).",
    )

    @field_validator("llama_use_openai_api", mode="before")
    @classmethod
    def validate_llama_use_openai_api(cls, v: Any) -> bool | None:  # noqa: ANN401
        if v is None or v == "":
            return None
        if isinstance(v, bool):
            return v
        s = str(v).strip().lower()
        if s in ("1", "true", "yes"):
            return True
        if s in ("0", "false", "no"):
            return False
        return None

    # Per-request keep_alive in Llama JSON API. "-1" = keep loaded (matches typical stack2 LLAMA_KEEP_ALIVE).
    # If unset in request body, server default applies; EliteEW used to send "5m", which overrode longer server TTL.
    llama_keep_alive: str = Field(
        default="-1",
        validation_alias="LLAMA_KEEP_ALIVE",
        description="Llama keep_alive for API requests (-1 = indefinite; or duration string e.g. 30m).",
    )

    # Production web search: production uses Yandex Search API only (stack5/SearXNG retired).
    web_search_provider: str = Field(
        default="yandex",
        validation_alias="WEB_SEARCH_PROVIDER",
        description="Deprecated env alias; runtime is Yandex-only. Value is ignored if not yandex.",
    )
    yandex_search_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("YANDEX_SEARCH_API_KEY", "SEARCH_API_KEY"),
        description="Yandex Cloud Search API key (scope yc.search-api.execute).",
    )
    yandex_cloud_folder_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("YANDEX_CLOUD_FOLDER_ID", "FOLDER_ID"),
        description="Yandex Cloud folder id for Search API billing scope.",
    )
    yandex_search_type: str = Field(
        default="auto",
        validation_alias="YANDEX_SEARCH_TYPE",
        description="SEARCH_TYPE_RU | SEARCH_TYPE_COM | auto (cyrillic heuristic).",
    )
    yandex_search_l10n: str = Field(
        default="auto",
        validation_alias="YANDEX_SEARCH_L10N",
        description="LOCALIZATION_RU | LOCALIZATION_EN | auto (derived from search type).",
    )
    yandex_search_region: str = Field(
        default="225",
        validation_alias="YANDEX_SEARCH_REGION",
        description="Yandex Search API region id (225 = Russia).",
    )
    yandex_search_groups_on_page: int = Field(
        default=5,
        validation_alias="YANDEX_SEARCH_GROUPS_ON_PAGE",
        ge=1,
        le=20,
        description="groupSpec.groupsOnPage cap for Yandex web/search requests.",
    )
    yandex_search_max_passages: int = Field(
        default=4,
        validation_alias="YANDEX_SEARCH_MAX_PASSAGES",
        ge=1,
        le=5,
        description="Yandex Search API maxPassages (snippets per document; API range 1–5).",
    )
    web_search_monthly_free_default: int = Field(
        default=50,
        validation_alias="WEB_SEARCH_MONTHLY_FREE_DEFAULT",
        ge=0,
        le=10_000,
        description="Default free web searches per user per calendar month when user has no override.",
    )
    web_search_quota_enforced: bool = Field(
        default=True,
        validation_alias="WEB_SEARCH_QUOTA_ENFORCED",
        description="When false, skip per-user web search quota (operator/debug only).",
    )
    # Legacy stack5 SearXNG — not used by web_search(); kept for env compatibility only.
    searxng_url: str | None = Field(
        default=None,
        validation_alias="SEARXNG_URL",
        description="Retired: SearXNG/stack5 web search. Ignored by search_service (Yandex-only).",
    )

    # Crawl4AI (chat crawl tool). Stack5 optional; see CRAWL4AI_INTERNAL_DEFAULT_BASE.
    crawl4ai_url: str | None = Field(
        default=None,
        validation_alias="CRAWL4AI_URL",
        description=("Crawl4AI base URL. If unset, uses CRAWL4AI_INTERNAL_DEFAULT_BASE (empty when stack5 off)."),
    )
    crawl_fallback_timeout_seconds: float = Field(
        default=45.0,
        validation_alias="ELITEEW_CRAWL_FALLBACK_TIMEOUT",
        description=(
            "HTTP client timeout for simple GET fallback when Crawl4AI fails (Playwright timeout / heavy docs sites)."
        ),
    )
    crawl_http_first_host_suffixes: str = Field(
        default="stripe.com,openai.com,tiangolo.com,readthedocs.io,python.org",
        validation_alias="ELITEEW_CRAWL_HTTP_FIRST_HOSTS",
        description=(
            "Comma-separated host suffixes for HTTP-first page fetch (skip Playwright when enough text). "
            "Empty string disables this list; path heuristics (/docs/, docs.*) still apply."
        ),
    )
    bez_tool_budget_seconds: float = Field(
        default=420.0,
        validation_alias="ELITEEW_BEZ_TOOL_BUDGET_SECONDS",
        ge=30.0,
        le=900.0,
        description="Wall-clock budget for Bezrazdelny tool loop (search/crawl/image); remaining steps skipped after.",
    )
    bez_diagnostic_logs: bool = Field(
        default=True,
        validation_alias="ELITEEW_BEZ_DIAGNOSTIC_LOGS",
        description=(
            "Extra [STEP] bez.diag_* INFO logs for Bezrazdelny (session settings, token budget, stream outcome). "
            "Set false to reduce log volume."
        ),
    )
    bez_sandbox_enable: bool = Field(
        default=True,
        validation_alias="ELITEEW_BEZ_SANDBOX_ENABLE",
        description="Allow Bezrazdelny code_sandbox tool (Docker --network none).",
    )
    bez_sandbox_image: str = Field(
        default="python:3.12-slim-bookworm",
        validation_alias="ELITEEW_BEZ_SANDBOX_IMAGE",
        description="Docker image for isolated Python execution.",
    )
    bez_sandbox_timeout_seconds: float = Field(
        default=25.0,
        validation_alias="ELITEEW_BEZ_SANDBOX_TIMEOUT_SECONDS",
        ge=5.0,
        le=120.0,
        description="Per-run timeout for sandboxed Python.",
    )
    bez_sandbox_memory: str = Field(
        default="256m",
        validation_alias="ELITEEW_BEZ_SANDBOX_MEMORY",
        description="Docker -m limit for sandbox container.",
    )
    bez_sandbox_cpus: str = Field(
        default="1",
        validation_alias="ELITEEW_BEZ_SANDBOX_CPUS",
        description="Docker --cpus limit for sandbox container.",
    )
    bez_attachment_extract_max_chars: int = Field(
        default=12_000,
        validation_alias="ELITEEW_BEZ_ATTACHMENT_MAX_CHARS",
        ge=2_000,
        le=200_000,
        description="Max characters of Tika plain text injected into Bezrazdelny context per attachment.",
    )
    bez_crawl_per_url_timeout_seconds: float = Field(
        default=40.0,
        validation_alias="ELITEEW_BEZ_CRAWL_PER_URL_TIMEOUT",
        ge=8.0,
        le=115.0,
        description=(
            "Async timeout per URL for Bezrazdelny crawl step (wraps scrape_url). "
            "Lower than Crawl4AI client timeout to fail fast on hung fetches."
        ),
    )
    bez_skip_crawl_without_grounding: bool = Field(
        default=True,
        validation_alias="ELITEEW_BEZ_SKIP_CRAWL_WITHOUT_GROUNDING",
        description=(
            "If web search produced no results and the user message has no explicit URL, "
            "skip the crawl step (avoid expensive guesses)."
        ),
    )
    bez_search_empty_retry: bool = Field(
        default=True,
        validation_alias="ELITEEW_BEZ_SEARCH_EMPTY_RETRY",
        description="After empty SearXNG results, try condensed / alternate queries before giving up.",
    )
    bez_search_micro_replan: bool = Field(
        default=True,
        validation_alias="ELITEEW_BEZ_SEARCH_MICRO_REPLAN",
        description=("If search still empty after heuristic retries, one short LLM call to propose 1–2 new queries."),
    )
    bez_planner_native_json_format: bool = Field(
        default=True,
        validation_alias="ELITEEW_BEZ_PLANNER_NATIVE_JSON",
        description=("On native Llama /api/chat (not OpenAI-compatible), request format=json for planner JSON."),
    )
    bez_planner_json_repair: bool = Field(
        default=True,
        validation_alias="ELITEEW_BEZ_PLANNER_JSON_REPAIR",
        description=("If planner/replanner free-text response is not valid JSON, one short LLM pass to repair it."),
    )
    bez_planner_native_json_schema: bool = Field(
        default=True,
        validation_alias="ELITEEW_BEZ_PLANNER_NATIVE_JSON_SCHEMA",
        description=("On native Llama /api/chat, pass a JSON Schema in `format` (stronger than plain format=json)."),
    )
    bez_planner_openai_json_object: bool = Field(
        default=True,
        validation_alias="ELITEEW_BEZ_PLANNER_OPENAI_JSON_MODE",
        description=(
            "On OpenAI-compatible LLM endpoints, use response_format json_object for planner/repair/replanner."
        ),
    )
    bez_planner_llm_timeout_initial_seconds: float = Field(
        default=45.0,
        ge=5.0,
        le=900.0,
        validation_alias="ELITEEW_BEZ_PLANNER_LLM_TIMEOUT_INITIAL_SEC",
        description=(
            "Total + sock_read timeout (seconds) for Bezrazdelny initial planner LLM calls "
            "(native JSON /api/chat and OpenAI-style completion). Raise if logs show "
            "SocketTimeoutError on llm_path=bez_planner_native_json."
        ),
    )
    bez_planner_llm_timeout_replanner_seconds: float = Field(
        default=40.0,
        ge=5.0,
        le=900.0,
        validation_alias="ELITEEW_BEZ_PLANNER_LLM_TIMEOUT_REPLANNER_SEC",
        description=("Same as bez_planner_llm_timeout_initial_seconds for URL replanner LLM calls."),
    )
    bez_planner_model: str | None = Field(
        default=None,
        validation_alias="ELITEEW_BEZ_PLANNER_MODEL",
        description=(
            "Optional Llama model name for Bezrazdelny planner/repair/replanner/micro-replan only. "
            "When unset, the session chat model is used (same as before). "
            "Use a small or tool-oriented model (e.g. functiongemma:latest) to speed up planning "
            "while keeping the session model for the final streamed reply."
        ),
    )
    bez_planner_mode: str = Field(
        default="json",
        validation_alias="ELITEEW_BEZ_PLANNER_MODE",
        description=(
            "Bezrazdelny initial planner: json (native JSON schema / OpenAI completion) or "
            "native_tools (Llama /api/chat with submit_bez_plan tool call). "
            "URL replanner and JSON repair stay on json."
        ),
    )

    comfyui_base_url: str | None = Field(default=None, validation_alias="COMFYUI_URL")
    # Единая модель LLM (Llama): только docker/env_file/.env.stack0.backend (LLAMA_MODEL / DEFAULT_AI_MODEL).
    default_ai_model: str = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices("LLAMA_MODEL", "DEFAULT_AI_MODEL"),
    )
    embedding_ai_model: str = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices("LLAMA_EMBEDDING_MODEL", "LLAMA_MODEL_EMBEDDING"),
    )
    llama_embed_timeout_sec: int = Field(
        default=180,
        ge=15,
        le=900,
        validation_alias=AliasChoices("LLAMA_EMBED_TIMEOUT_SEC", "LLAMA_EMBEDDING_TIMEOUT_SEC"),
        description=(
            "HTTP total (сек) для Llama POST /api/embed: холодный старт эмбед-модели при занятой GPU "
            "часто 30–45с+; 30с даёт 499 в логах Llama."
        ),
    )
    llama_model_bi: str | None = Field(default=None, validation_alias="LLAMA_MODEL_BI")
    llama_model_marketing: str | None = Field(default=None, validation_alias="LLAMA_MODEL_MARKETING")
    #: Тексты песен / стиль / improve в Music Generator (UGS Llama chat). Пусто = как у остального Llama (провайдер default_model).
    llama_model_music_text_gen: str | None = Field(
        default=None,
        validation_alias="LLAMA_MODEL_MUSIC_TEXT_GEN",
    )
    #: Image Studio: UGS `image_studio_image_prompt` (доработка промпта перед ComfyUI). Пусто = LLAMA_MODEL; не из default_model в БД.
    llama_model_image_studio: str | None = Field(
        default=None,
        validation_alias="LLAMA_MODEL_IMAGE_STUDIO",
    )
    #: HTTP total (сек) для EWRP → Llama POST /api/generate (outline). Раньше 90с — обрыв на медленных LLM.
    ewrp_llama_outline_timeout_sec: int = Field(
        default=240,
        ge=30,
        le=3600,
        validation_alias="EWRP_LLAMA_OUTLINE_TIMEOUT_SEC",
    )
    #: То же для каждого слайда и monolithic fallback в PresentationContentGeneratorService.
    ewrp_llama_slide_timeout_sec: int = Field(
        default=300,
        ge=30,
        le=7200,
        validation_alias="EWRP_LLAMA_SLIDE_TIMEOUT_SEC",
    )

    @property
    def bi_ai_model(self) -> str:
        """BI/UGS: LLAMA_MODEL_BI → LLAMA_MODEL_MARKETING → LLAMA_MODEL (см. .env.stack0.backend)."""
        for raw in (self.llama_model_bi, self.llama_model_marketing):
            if raw and str(raw).strip():
                return str(raw).strip()
        return self.default_ai_model

    @property
    def ai_embeddings_model(self) -> str:
        """Синоним для отчётов/конфигов Chroma: та же строка, что LLAMA_EMBEDDING_MODEL."""
        return self.embedding_ai_model

    whisperx_url: str = Field(default="http://localhost:9999", validation_alias="WHISPERX_URL")
    whisper_fast_url: str = Field(default="http://stack9-whisper-fast:8000", validation_alias="WHISPER_FAST_URL")

    livekit_url: str = Field(default="http://livekit-server:7880", validation_alias="LIVEKIT_URL")
    livekit_api_key: str | None = Field(default=None, validation_alias="LIVEKIT_API_KEY")
    livekit_api_secret: str | None = Field(default=None, validation_alias="LIVEKIT_API_SECRET")

    telegram_bot_token: str | None = Field(default=None, validation_alias="TELEGRAM_BOT_TOKEN")
    telegram_api_id: int | None = Field(default=None, validation_alias="TELEGRAM_API_ID")
    telegram_api_hash: str | None = Field(default=None, validation_alias="TELEGRAM_API_HASH")

    @field_validator("telegram_api_id", mode="before")
    @classmethod
    def validate_telegram_api_id(cls, v: Any) -> int | None:  # noqa: ANN401
        """Convert empty string to None for telegram_api_id."""
        if v == "" or v is None:
            return None
        if isinstance(v, str):
            try:
                return int(v)
            except ValueError:
                return None
        return v

    @field_validator("bez_planner_mode", mode="before")
    @classmethod
    def validate_bez_planner_mode(cls, v: Any) -> str:  # noqa: ANN401
        s = str(v or "json").strip().lower()
        if s in ("json", "native_tools"):
            return s
        return "json"

    @model_validator(mode="after")
    def _coalesce_llama_primary_and_document_ai_lists(self) -> Self:
        opm = (self.llama_primary_model or "").strip()
        object.__setattr__(self, "llama_primary_model", opm if opm else self.default_ai_model)
        da = deepcopy(self.document_ai_services)
        summ = da.get("summarization")
        if isinstance(summ, dict):
            da["summarization"] = {**summ, "models": [self.default_ai_model]}
        emb_gen = da.get("embeddings_generation")
        if isinstance(emb_gen, dict):
            emb_list = [self.embedding_ai_model]
            fb = (self.ai_embeddings_fallback_model or "").strip()
            if fb:
                emb_list.append(fb)
            da["embeddings_generation"] = {**emb_gen, "models": emb_list}
        object.__setattr__(self, "document_ai_services", da)
        return self

    telegram_session_string: str | None = Field(default=None, validation_alias="TELEGRAM_SESSION_STRING")
    telegram_webhook_base_url: str | None = Field(default=None, validation_alias="TELEGRAM_WEBHOOK_BASE_URL")
    twitter_bearer_token: str | None = Field(default=None, validation_alias="TWITTER_BEARER_TOKEN")
    linkedin_access_token: str | None = Field(default=None, validation_alias="LINKEDIN_ACCESS_TOKEN")
    facebook_access_token: str | None = Field(default=None, validation_alias="FACEBOOK_ACCESS_TOKEN")

    portainer_url: str = Field(default_factory=_default_portainer_url, validation_alias="PORTAINER_URL")
    portainer_username: str = Field(default="friend_claude", validation_alias="PORTAINER_USERNAME")
    portainer_password: str | None = Field(default=None, validation_alias="PORTAINER_PASSWORD")

    celery_broker_url: str = Field(
        default="redis://stack1-redis:6379/0",
        validation_alias="CELERY_BROKER_URL",
        description="Env mirror; actual Celery app broker is api.tasks.celery_app (CELERY_REDIS_DB + get_connection_string).",
    )
    celery_result_backend: str = Field(
        default="redis://stack1-redis:6379/0",
        validation_alias="CELERY_RESULT_BACKEND",
        description="Env mirror; actual Celery result backend is api.tasks.celery_app.",
    )

    # Default faster-whisper model size for local STT
    # Available: tiny, base, small, medium, large, large-v1, large-v2, large-v3, turbo
    whisper_model_size: str = Field(default="large-v3", validation_alias="WHISPER_MODEL_SIZE")
    whisper_device: str = Field(default="cuda", validation_alias="WHISPER_DEVICE")
    whisper_compute_type: str = Field(default="float16", validation_alias="WHISPER_COMPUTE_TYPE")
    whisper_batch_size: int = Field(default=24, validation_alias="WHISPER_BATCH_SIZE")
    whisper_model_dir: str = Field(default="/app/api/models/whisper", validation_alias="WHISPER_MODEL_DIR")

    tika_url: str = Field(default="http://stack4-tika:9998", validation_alias="TIKA_URL")
    tesseract_url: str = Field(default="http://stack4-tesseract:8884", validation_alias="TESSERACT_URL")
    paperless_api_token: str = Field(default="", validation_alias="PAPERLESS_API_TOKEN")

    elasticsearch_host_override: str | None = Field(default=None, validation_alias="ELASTICSEARCH_HOST")
    elasticsearch_port_override: int | None = Field(default=None, validation_alias="ELASTICSEARCH_PORT")
    elasticsearch_user: str = Field(default="elastic", validation_alias="ELASTICSEARCH_USER")
    elasticsearch_password: str | None = Field(default=None, validation_alias="ELASTICSEARCH_PASSWORD")

    enable_cadvisor_metrics: bool = Field(default=False, validation_alias="ENABLE_CADVISOR_METRICS")

    @property
    def minio_credentials(self) -> dict[str, str]:
        """Backward compatibility property for minio_credentials."""
        return {"access_key": self.minio_access_key, "secret_key": self.minio_secret_key}

    @field_validator("s3_bucket_default_encryption", mode="before")
    @classmethod
    def _s3_sse_bucket_empty_means_unset(cls, v: Any) -> Any:
        """Docker Compose передаёт пустую строку, если переменная не задана в .env."""
        if v is None or v == "":
            return None
        return v

    @field_validator("minio_access_key", mode="before")
    @classmethod
    def validate_minio_access_key_before(cls, v: Any) -> str:  # noqa: ANN401
        is_production = os.environ.get("ELITEEW_ENV", "").strip().lower() == "production"
        if not v or (isinstance(v, str) and v.strip() == ""):
            if is_production:
                raise ValueError("MINIO_ACCESS_KEY/AWS_ACCESS_KEY_ID must be set in production")
            return f"dev-{secrets.token_urlsafe(16)}"
        return str(v)

    # Secret validation (only for minio_secret_key now, database_password has separate validator)
    @field_validator("minio_secret_key", mode="before")
    @classmethod
    def validate_secret(cls, v: Any, info: ValidationInfo) -> str:
        """Validate that secrets are secure (min 16 chars, no placeholders).

        SECURITY: Prevents weak or placeholder passwords in production.
        """
        field_name: str = info.field_name or "field"

        if not v or v.strip() == "":
            if os.environ.get("ELITEEW_ENV", "").strip().lower() == "production":
                msg = f"{field_name} must be set via environment variable"
                raise ValueError(msg)
            return secrets.token_urlsafe(32)

        # Check for common placeholder values
        min_secret_length = 16
        forbidden_values = ["change_me", "password", "secret", "12345", "admin", "test"]
        v = str(v)
        if v.lower() in forbidden_values:
            msg = (
                f"{field_name} contains insecure placeholder value. "
                f"Use strong random password (min {min_secret_length} chars)"
            )
            raise ValueError(msg)

        # Minimum length check
        if len(v) < min_secret_length:
            msg = (
                f"{field_name} must be at least {min_secret_length} characters long (got {len(v)}). "
                f"Generate strong password: openssl rand -base64 32"
            )
            raise ValueError(msg)

        return v

    def apply_service_overrides(self, overrides: dict[str, dict[str, Any]]) -> None:
        """Apply overrides (e.g. from env) to service configs."""

        for service_name, config in (overrides or {}).items():
            service = getattr(self, service_name, None)
            if not isinstance(service, ServiceConfig):
                continue
            if isinstance(config, dict):  # type: ignore[redundant-expr]
                for field, value in config.items():
                    if hasattr(service, field):
                        setattr(service, field, value)

    @classmethod
    def create(cls) -> UnifiedConfig:
        # Только env: Pydantic BaseSettings читает из os.environ
        instance = cls()  # pyright: ignore[reportCallIssue]
        # Сервисы: host/port из env (те же переменные, что в database_manager)
        service_overrides: dict[str, dict[str, Any]] = {
            "postgres": {
                "host": os.environ.get("POSTGRES_HOST", "stack1-postgres"),
                "internal_port": _env_int("POSTGRES_PORT", 5432),
            },
            "redis": {
                "host": os.environ.get("REDIS_HOST", "stack1-redis"),
                "internal_port": _env_int("REDIS_PORT", 6379),
            },
            "minio": {
                "host": os.environ.get("MINIO_HOST", "stack1-seaweedfs"),
                "internal_port": _env_int("MINIO_PORT", 8333),
            },
            "elasticsearch": {
                "host": os.environ.get("ELASTICSEARCH_HOST", "stack1-elasticsearch"),
                "internal_port": _env_int("ELASTICSEARCH_PORT", 9200),
            },
            # Compose-дефолт для «слоя LLM»: не утверждает наличие демона Llama — только канонический docker hostname.
            # Реальный URL лучше задать через LLAMA_URL в .env.stack0.backend; см. STACK0-LLM-OVERVIEW.md
            "llama": {
                "host": os.environ.get("LLAMA_HOST", "stack2-llama"),
                "internal_port": _env_int("LLAMA_PORT", 11434),
            },
            "comfyui": {
                "host": os.environ.get("COMFYUI_HOST", "stack2-comfyui"),
                "internal_port": _env_int("COMFYUI_PORT", 3000),
            },
        }
        instance.apply_service_overrides(service_overrides)
        return instance

    @staticmethod
    def _service_host(service: ServiceConfig) -> str:
        return getattr(service, "host", service.container_name)

    @property
    def postgres_host(self) -> str:
        return self._service_host(self.postgres)

    @property
    def redis_host(self) -> str:
        return self._service_host(self.redis)

    @property
    def minio_host(self) -> str:
        return self._service_host(self.minio)

    @property
    def airflow_host(self) -> str:
        return self._service_host(self.airflow)

    @property
    def llama_host(self) -> str:
        return self._service_host(self.llama)

    @property
    def comfyui_host(self) -> str:
        return self._service_host(self.comfyui)

    @property
    def database_dsn(self) -> str:
        host = self.postgres_host
        port = self.postgres.internal_port
        return f"postgresql://{self.database_user}:{self.database_password}@{host}:{port}/{self.database_name}"

    @property
    def redis_url(self) -> str:
        if self.redis_url_override:
            return self.redis_url_override

        password = self.redis_password
        if password:
            return f"redis://:{password}@{self.redis_host}:{self.redis.internal_port}/{self.redis_db}"

        return f"redis://{self.redis_host}:{self.redis.internal_port}/{self.redis_db}"

    @property
    def minio_endpoint(self) -> str:
        if self.aws_s3_endpoint:
            return self.aws_s3_endpoint.rstrip("/")
        protocol = "https" if self.minio_secure else "http"
        return f"{protocol}://{self.minio_host}:{self.minio.internal_port}"

    @property
    def s3_use_bucket_default_sse(self) -> bool:
        """PutBucketEncryption / SSE-S3 default только для объектного стора; не путать с PII ENCRYPTION_ENABLED."""
        if self.s3_bucket_default_encryption is not None:
            return bool(self.s3_bucket_default_encryption)
        return bool(self.encryption_enabled)

    @property
    def airflow_url(self) -> str:
        if self.airflow_url_override:
            return self.airflow_url_override.rstrip("/")
        return f"http://{self.airflow_host}:{self.airflow.internal_port}"

    @property
    def llama_url(self) -> str:
        """Базовый URL HTTP LLM. При пустом LLAMA_* из env здесь будет http://LLAMA_HOST:LLAMA_PORT (часто stack2-llama:11434)."""
        if self.llama_base_url:
            return self.llama_base_url.rstrip("/")
        return f"http://{self.llama_host}:{self.llama.internal_port}"

    @property
    def llama_embeddings_service_base(self) -> str:
        """База HTTP для эмбеддингов: LLAMA_EMBEDDING_URL или LLAMA_URL."""
        raw = self.llama_embedding_url
        if raw and str(raw).strip():
            return str(raw).strip().rstrip("/")
        return self.llama_url

    @property
    def comfyui_url(self) -> str:
        if self.comfyui_base_url:
            return self.comfyui_base_url.rstrip("/")
        return f"http://{self.comfyui_host}:{self.comfyui.internal_port}"

    @property
    def companion_episodic_qdrant_http_url(self) -> str:
        """Resolved REST base URL for companion episodic Qdrant (HCM Phase 2+ dedicated cluster optional)."""

        explicit = str(self.ewa_qdrant_url or "").strip().rstrip("/")
        return explicit if explicit else str(self.qdrant.internal_url or "").strip().rstrip("/")

    @property
    def elasticsearch_host(self) -> str:
        if self.elasticsearch_host_override:
            return self.elasticsearch_host_override
        return self._service_host(self.elasticsearch)

    @property
    def elasticsearch_port(self) -> int:
        if self.elasticsearch_port_override is not None:
            return int(self.elasticsearch_port_override)
        return self.elasticsearch.internal_port

    @property
    def public_base_url(self) -> str:
        if self.public_base_url_override:
            return self.public_base_url_override.rstrip("/")
        return f"http://{self.host_ip}:{self.public_publish_port}"

    @property
    def eliteew_self_http_base_url(self) -> str:
        """Base URL for server-side HTTP clients targeting this API process.

        ``public_base_url`` may advertise ``HOST_IP`` + ``PUBLIC_PUBLISH_PORT`` (browser/WebSocket);
        FastAPI listens on ``API_PORT`` (typically 8000). Loopback avoids hairpin/outbound issues.
        """
        raw = self.eliteew_self_http_base_url_override
        if raw and str(raw).strip():
            return str(raw).strip().rstrip("/")
        port = max(1, int(self.api_listen_http_port))
        return f"http://127.0.0.1:{port}"

    # =============================================================================
    #  STACK 1: DATABASES ( 30000-30099)
    # =============================================================================

    # PostgreSQL -
    postgres: ServiceConfig = ServiceConfig(
        name="postgres",
        container_name="stack1-postgres",
        internal_port=5432,
        external_port=5432,
        stack=StackType.DATABASES,
        health_endpoint="/",  # PostgreSQL   HTTP endpoint
        description="PostgreSQL",
    )

    # Redis -
    redis: ServiceConfig = ServiceConfig(
        name="redis",
        container_name="stack1-redis",
        internal_port=6379,
        external_port=6379,
        stack=StackType.DATABASES,
        health_endpoint="/ping",
        description="Redis",
    )

    # ChromaDB -
    chroma: ServiceConfig = ServiceConfig(
        name="chroma",
        container_name="stack1-chroma",
        internal_port=8000,
        external_port=8000,
        stack=StackType.DATABASES,
        health_endpoint="/api/v1/heartbeat",
        description="ChromaDB",
    )

    # Qdrant -
    qdrant: ServiceConfig = ServiceConfig(
        name="qdrant",
        container_name="stack1-qdrant",
        internal_port=6333,
        external_port=6333,
        stack=StackType.DATABASES,
        health_endpoint="/collections",
        description="Qdrant",
    )

    # SeaweedFS (S3-compatible object storage)
    minio: ServiceConfig = ServiceConfig(
        name="seaweedfs",
        container_name="stack1-seaweedfs",
        internal_port=8333,
        external_port=8333,
        stack=StackType.DATABASES,
        health_endpoint="/",
        description="SeaweedFS S3-compatible storage",
    )

    # Elasticsearch -
    elasticsearch: ServiceConfig = ServiceConfig(
        name="elasticsearch",
        container_name="stack1-elasticsearch",
        internal_port=9200,
        external_port=9200,
        stack=StackType.DATABASES,
        health_endpoint="/_cluster/health",
        description="Elasticsearch",
    )

    # RabbitMQ -
    rabbitmq: ServiceConfig = ServiceConfig(
        name="rabbitmq",
        container_name="stack1-rabbitmq",
        internal_port=5672,
        external_port=5672,
        stack=StackType.DATABASES,
        health_endpoint="/api/healthchecks/node",
        description="RabbitMQ",
    )

    # =============================================================================
    #  STACK 2: AI SERVICES ( 31000-31099)
    # =============================================================================

    # Stack2 LLM: по умолчанию llama.cpp server (OpenAI API); при возврате на Llama — stack2-llama:11434 и /api/tags
    llama: ServiceConfig = ServiceConfig(
        name="llama",
        container_name="stack2-llama-chat",
        internal_port=8080,
        external_port=8080,
        stack=StackType.AI_SERVICES,
        health_endpoint="/health",
        requires_gpu=True,
        description="LLM (llama.cpp server or Llama)",
    )

    # OpenWebUI -   LLM
    openwebui: ServiceConfig = ServiceConfig(
        name="openwebui",
        container_name="openwebui-cuda128",
        internal_port=8080,
        external_port=31001,
        stack=StackType.AI_SERVICES,
        health_endpoint="/api/v1/health",
        requires_gpu=True,
        description="OpenWebUI   LLM",
    )

    # Stable Diffusion (A1111 WebUI — health on the GPU container, not EliteEW)
    stable_diffusion: ServiceConfig = ServiceConfig(
        name="stable_diffusion",
        container_name="stack2-stable-diffusion",
        internal_port=7860,
        external_port=7860,
        stack=StackType.AI_SERVICES,
        health_endpoint="/sdapi/v1/system-info",
        requires_gpu=True,
        description="Stable Diffusion WebUI",
    )

    # ComfyUI (zeroclue image — port 3000 inside container)
    comfyui: ServiceConfig = ServiceConfig(
        name="comfyui",
        container_name="stack2-comfyui",
        internal_port=3000,
        external_port=31003,
        stack=StackType.AI_SERVICES,
        health_endpoint="/system_stats",
        requires_gpu=True,
        description="ComfyUI",
    )

    # Real-ESRGAN -
    real_esrgan: ServiceConfig = ServiceConfig(
        name="real_esrgan",
        container_name="stack2-real-esrgan",
        internal_port=5000,
        external_port=31004,
        stack=StackType.AI_SERVICES,
        health_endpoint="/health",
        requires_gpu=True,
        description="Real-ESRGAN  ",
    )

    # LocalAI -  AI API
    localai: ServiceConfig = ServiceConfig(
        name="localai",
        container_name="stack2-localai",
        internal_port=8080,
        external_port=31005,
        stack=StackType.AI_SERVICES,
        health_endpoint="/health",
        requires_gpu=True,
        description="LocalAI  AI API",
    )

    # LocalAGI -  AI
    localagi: ServiceConfig = ServiceConfig(
        name="localagi",
        container_name="stack2-localagi",
        internal_port=9090,
        external_port=31006,
        stack=StackType.AI_SERVICES,
        health_endpoint="/health",
        requires_gpu=True,
        description="LocalAGI  AI",
    )

    # WhisperX -
    whisperx: ServiceConfig = ServiceConfig(
        name="whisperx",
        container_name="stack2-whisperx",
        internal_port=9000,
        external_port=31007,
        stack=StackType.AI_SERVICES,
        health_endpoint="/health",
        requires_gpu=True,
        description="WhisperX  ",
    )

    # SadTalker -
    sadtalker: ServiceConfig = ServiceConfig(
        name="sadtalker",
        container_name="stack2-sadtalker",
        internal_port=5000,
        external_port=31008,
        stack=StackType.AI_SERVICES,
        health_endpoint="/health",
        requires_gpu=True,
        description="SadTalker  ",
    )

    # Airflow -
    airflow: ServiceConfig = ServiceConfig(
        name="airflow",
        container_name="stack2-airflow",
        internal_port=8080,
        external_port=31009,
        stack=StackType.AI_SERVICES,
        health_endpoint="/health",
        description="Apache Airflow ",
    )

    # MLflow - ML
    mlflow: ServiceConfig = ServiceConfig(
        name="mlflow",
        container_name="stack2-mlflow",
        internal_port=5000,
        external_port=31010,
        stack=StackType.AI_SERVICES,
        health_endpoint="/health",
        description="MLflow ML ",
    )

    # SUPIR -
    supir: ServiceConfig = ServiceConfig(
        name="supir",
        container_name="stack2-supir",
        internal_port=8000,
        external_port=31011,
        stack=StackType.AI_SERVICES,
        health_endpoint="/health",
        requires_gpu=True,
        description="SUPIR  ",
    )

    # =============================================================================
    # ? STACK 3: DEVOPS ( 32000-32099)
    # =============================================================================

    # Heimdall -  dashboard
    heimdall: ServiceConfig = ServiceConfig(
        name="heimdall",
        container_name="stack3-heimdall",
        internal_port=80,
        external_port=32000,
        stack=StackType.DEVOPS,
        health_endpoint="/",
        description="Heimdall  dashboard",
    )

    # Code Server - VS Code
    code_server: ServiceConfig = ServiceConfig(
        name="code_server",
        container_name="stack3-code-server",
        internal_port=8080,
        external_port=32002,
        stack=StackType.DEVOPS,
        health_endpoint="/healthz",
        requires_gpu=True,
        description="Code Server VS Code  ",
    )

    # ESP-IDF IDE - REMOVED
    # Gitea - Git
    gitea: ServiceConfig = ServiceConfig(
        name="gitea",
        container_name="stack3-gitea",
        internal_port=3000,
        external_port=32004,
        stack=StackType.DEVOPS,
        health_endpoint="/api/healthz",
        description="Gitea Git ",
    )

    # Jenkins - CI/CD
    jenkins: ServiceConfig = ServiceConfig(
        name="jenkins",
        container_name="stack3-jenkins",
        internal_port=8080,
        external_port=32006,
        stack=StackType.DEVOPS,
        health_endpoint="/login",
        requires_gpu=True,
        description="Jenkins CI/CD",
    )

    # JupyterLab
    jupyter: ServiceConfig = ServiceConfig(
        name="jupyter",
        container_name="stack3-jupyter",
        internal_port=8888,
        external_port=32008,
        stack=StackType.DEVOPS,
        health_endpoint="/api",
        requires_gpu=True,
        description="JupyterLab  ",
    )

    # SonarQube -
    sonarqube: ServiceConfig = ServiceConfig(
        name="sonarqube",
        container_name="stack3-sonarqube",
        internal_port=9000,
        external_port=32009,
        stack=StackType.DEVOPS,
        health_endpoint="/api/system/status",
        description="SonarQube  ",
    )

    # Nexus -
    nexus: ServiceConfig = ServiceConfig(
        name="nexus",
        container_name="stack3-nexus",
        internal_port=8081,
        external_port=32010,
        stack=StackType.DEVOPS,
        health_endpoint="/service/rest/v1/status",
        description="Nexus  ",
    )

    # Portainer Agent
    portainer_agent: ServiceConfig = ServiceConfig(
        name="portainer_agent",
        container_name="stack3-portainer-agent",
        internal_port=9001,
        external_port=32012,
        stack=StackType.DEVOPS,
        health_endpoint="/",
        description="Portainer Agent  ",
    )

    # Grafana -
    grafana: ServiceConfig = ServiceConfig(
        name="grafana",
        container_name="stack3-grafana",
        internal_port=3000,
        external_port=32016,
        stack=StackType.DEVOPS,
        health_endpoint="/api/health",
        description="Grafana   ",
    )

    # Prometheus -
    prometheus: ServiceConfig = ServiceConfig(
        name="prometheus",
        container_name="stack3-prometheus",
        internal_port=9090,
        external_port=32017,
        stack=StackType.DEVOPS,
        health_endpoint="/-/healthy",
        description="Prometheus  ",
    )

    # Glances -
    glances: ServiceConfig = ServiceConfig(
        name="glances",
        container_name="stack3-glances",
        internal_port=61208,
        external_port=32018,
        stack=StackType.DEVOPS,
        health_endpoint="/api/3/status",
        requires_gpu=True,
        description="Glances  ",
    )

    # =============================================================================
    #  STACK 4: DOCUMENTS ( 33000-33099)
    # =============================================================================

    # Paperless-ngx
    paperless: ServiceConfig = ServiceConfig(
        name="paperless",
        container_name="stack4-paperless",
        internal_port=8000,
        external_port=33000,
        stack=StackType.DOCUMENTS,
        health_endpoint="/api/",
        description="Paperless-ngx  ",
    )

    # Tika Server
    tika: ServiceConfig = ServiceConfig(
        name="tika",
        container_name="stack4-tika",
        internal_port=9998,
        external_port=33004,
        stack=StackType.DOCUMENTS,
        health_endpoint="/tika",
        description="Apache Tika  ",
    )

    # OCRmyPDF API
    ocrmypdf: ServiceConfig = ServiceConfig(
        name="ocrmypdf",
        container_name="stack4-ocrmypdf-api",
        internal_port=5000,
        external_port=33005,
        stack=StackType.DOCUMENTS,
        health_endpoint="/health",
        description="OCRmyPDF API OCR",
    )

    # Tesseract Server
    tesseract: ServiceConfig = ServiceConfig(
        name="tesseract",
        container_name="stack4-tesseract",
        internal_port=8884,
        external_port=33010,
        stack=StackType.DOCUMENTS,
        health_endpoint="/",
        description="Tesseract OCR",
    )

    # Gotenberg
    gotenberg: ServiceConfig = ServiceConfig(
        name="gotenberg",
        container_name="stack4-gotenberg",
        internal_port=3000,
        external_port=33011,
        stack=StackType.DOCUMENTS,
        health_endpoint="/health",
        description="Gotenberg",
    )

    # =============================================================================
    #  STACK 5: COMMUNICATION  34000-34099)
    # =============================================================================

    # Excalidraw Backend
    excalidraw: ServiceConfig = ServiceConfig(
        name="excalidraw",
        container_name="stack5-excalidraw-backend",
        internal_port=3002,
        external_port=34004,
        stack=StackType.COMMUNICATION,
        health_endpoint="/health",
        description="Excalidraw",
    )

    # Etherpad
    etherpad: ServiceConfig = ServiceConfig(
        name="etherpad",
        container_name="stack5-etherpad",
        internal_port=9001,
        external_port=34005,
        stack=StackType.COMMUNICATION,
        health_endpoint="/stats",
        description="Etherpad",
    )

    # AI Meeting Assistant
    ai_assistant: ServiceConfig = ServiceConfig(
        name="ai_assistant",
        container_name="stack5-ai-assistant",
        internal_port=8000,
        external_port=34008,
        stack=StackType.COMMUNICATION,
        health_endpoint="/health",
        description="AI Meeting Assistant",
    )

    # Keycloak
    keycloak: ServiceConfig = ServiceConfig(
        name="keycloak",
        container_name="stack5-keycloak",
        internal_port=8080,
        external_port=34009,
        stack=StackType.COMMUNICATION,
        health_endpoint="/health",
        description="Keycloak",
    )

    # =============================================================================
    #  STACK 6: DEPLOYMENT ( 35000-35099)
    # =============================================================================

    # Coolify
    coolify: ServiceConfig = ServiceConfig(
        name="coolify",
        container_name="stack6-coolify",
        internal_port=80,
        external_port=35000,
        stack=StackType.DEPLOYMENT,
        health_endpoint="/api/health",
        description="Coolify",
    )

    # =============================================================================
    #  DOCUMENT EDITOR CONFIGURATION -
    # =============================================================================

    # Document Editor
    document_editor_enabled: bool = Field(default=True, validation_alias="DOCUMENT_EDITOR_ENABLED")
    document_editor_max_file_size: int = Field(
        default=50 * 1024 * 1024, validation_alias="DOCUMENT_MAX_FILE_SIZE"
    )  # 50MB
    document_editor_supported_formats: list[str] = [
        ".doc",
        ".docx",
        ".pdf",
        ".html",
        ".txt",
        ".md",
        ".rtf",
        ".odt",
    ]
    document_editor_ai_integration: bool = Field(default=True, validation_alias="DOCUMENT_AI_INTEGRATION")
    document_editor_collaboration: bool = Field(default=True, validation_alias="DOCUMENT_COLLABORATION")
    document_editor_version_control: bool = Field(default=True, validation_alias="DOCUMENT_VERSION_CONTROL")
    document_editor_real_time_sync: bool = Field(default=True, validation_alias="DOCUMENT_REAL_TIME_SYNC")

    # Stack integrations  Document Editor
    document_stack_integrations: dict[str, str] = {
        "stack1_postgres": "documents database",
        "stack1_redis": "caching & real-time sessions",
        "stack1_elasticsearch": "document search indexing",
        "stack1_minio": "file storage & attachments",
        "stack2_llama": "AI text analysis & generation",
        "stack2_localai": "content enhancement & summarization",
        "stack4_tika": "text extraction from files",
        "stack4_ocrmypdf": "OCR processing",
        "stack4_tesseract": "OCR text recognition",
        "stack4_gotenberg": "document conversion",
    }

    # Document processing
    document_processing_timeout: int = Field(default=300, validation_alias="DOCUMENT_PROCESSING_TIMEOUT")  # 5 minutes
    document_auto_save_interval: int = Field(default=30, validation_alias="DOCUMENT_AUTO_SAVE_INTERVAL")  # 30 seconds
    document_collaboration_max_users: int = Field(default=10, validation_alias="DOCUMENT_COLLABORATION_MAX_USERS")
    document_ai_analysis_enabled: bool = Field(default=True, validation_alias="DOCUMENT_AI_ANALYSIS_ENABLED")

    # Browser render sidecar (Playwright on queue-worker; stack0-api uses HTTP only)
    browser_render_service_url: str = Field(
        default="",
        validation_alias="BROWSER_RENDER_SERVICE_URL",
        description="Full base URL for queue-worker browser render sidecar (e.g. http://stack0-eliteew-api-worker-prod:8095).",
    )
    browser_render_worker_host: str = Field(
        default="stack0-eliteew-api-worker-prod",
        validation_alias="BROWSER_RENDER_WORKER_HOST",
        description="Fallback host when BROWSER_RENDER_SERVICE_URL is empty.",
    )
    browser_render_service_port: int = Field(
        default=8095,
        ge=1024,
        le=65535,
        validation_alias="BROWSER_RENDER_SERVICE_PORT",
        description="Fallback port for browser render sidecar on queue-worker.",
    )

    # Science stack sidecar (numpy/scipy/sklearn on queue-worker; stack0-api uses HTTP only)
    science_stack_service_url: str = Field(
        default="",
        validation_alias="SCIENCE_STACK_SERVICE_URL",
        description="Full base URL for queue-worker science stack sidecar (e.g. http://stack0-eliteew-api-worker-prod:8096).",
    )
    science_stack_worker_host: str = Field(
        default="stack0-eliteew-api-worker-prod",
        validation_alias="SCIENCE_STACK_WORKER_HOST",
        description="Fallback host when SCIENCE_STACK_SERVICE_URL is empty.",
    )
    science_stack_service_port: int = Field(
        default=8096,
        ge=1024,
        le=65535,
        validation_alias="SCIENCE_STACK_SERVICE_PORT",
        description="Fallback port for science stack sidecar on queue-worker.",
    )

    # AI processing (default_factory: cannot use self.default_ai_model at class definition time)
    document_ai_services: dict[str, dict[str, Any]] = Field(
        default_factory=lambda: {
            "text_extraction": {
                "primary_service": "tika",
                "fallback_service": "tesseract",
                "timeout": 120,
            },
            "content_analysis": {
                "primary_service": "llama",
                "fallback_service": "localai",
                "timeout": 180,
            },
            "summarization": {
                "primary_service": "llama",
                "models": [],
                "timeout": 300,
            },
            "translation": {"primary_service": "localai", "timeout": 240},
            "ocr_processing": {
                "primary_service": "ocrmypdf",
                "fallback_service": "tesseract",
                "timeout": 300,
            },
            "embeddings_generation": {
                "primary_service": "llama",
                "models": [],
                "timeout": 180,
                "vector_storage": "chromadb",
            },
            "semantic_search": {
                "primary_service": "chromadb",
                "embedding_service": "llama",
                "timeout": 60,
                "max_results": 10,
            },
            "similarity_matching": {
                "primary_service": "chromadb",
                "similarity_threshold": 0.7,
                "timeout": 30,
                "enable_context": True,
            },
        }
    )

    # Document categories
    document_default_categories: list[dict[str, Any]] = [
        {"name": "General", "color": "#6366F1", "icon": "document"},
        {"name": "Templates", "color": "#8B5CF6", "icon": "template"},
        {"name": "AI Generated", "color": "#10B981", "icon": "robot"},
        {"name": "Collaborative", "color": "#F59E0B", "icon": "users"},
        {"name": "Archive", "color": "#6B7280", "icon": "archive"},
    ]

    # Workflow
    document_workflow_enabled: bool = Field(default=True, validation_alias="DOCUMENT_WORKFLOW_ENABLED")
    document_default_workflows: list[dict[str, Any]] = [
        {"name": "Basic Review", "steps": ["Draft", "Review", "Published"], "auto_trigger": False},
        {
            "name": "AI Processing",
            "steps": ["Upload", "AI Analysis", "Ready"],
            "auto_trigger": True,
        },
    ]

    # WebSocket configuration  real-time collaboration
    document_websocket_enabled: bool = Field(default=True, validation_alias="DOCUMENT_WEBSOCKET_ENABLED")
    document_websocket_room_prefix: str = "document_"
    document_websocket_max_connections_per_document: int = 20

    document_access_levels: list[str] = ["private", "team", "public", "restricted"]
    document_permission_types: list[str] = ["view", "edit", "comment", "share", "delete", "admin"]

    # =============================================================================
    #  AI EMBEDDINGS CONFIGURATION - ChromaDB Vector Search Integration
    # =============================================================================

    ai_embeddings_enabled: bool = Field(default=True, validation_alias="AI_EMBEDDINGS_ENABLED")
    ai_embeddings_fallback_model: str | None = Field(
        default=None,
        validation_alias="AI_EMBEDDINGS_FALLBACK_MODEL",
        description="Запасная модель эмбеддингов; только env (.env.stack0.backend).",
    )
    ai_embeddings_dimension: int = Field(default=768, validation_alias="AI_EMBEDDINGS_DIMENSION")
    ai_embeddings_batch_size: int = Field(
        default=50,
        validation_alias="AI_EMBEDDINGS_BATCH_SIZE",
        description="Число чанков на один HTTP POST к embedder при индексации RAG (clamp 8…128 в rag_http_embed_batch_size).",
    )
    ai_embeddings_cache_ttl: int = Field(default=300, validation_alias="AI_EMBEDDINGS_CACHE_TTL")  # 5 minutes
    ai_embeddings_auto_index: bool = Field(default=True, validation_alias="AI_EMBEDDINGS_AUTO_INDEX")
    #: Optional dedicated Qdrant REST base URL for **EWA companion episodic** memory (HCM). Empty uses stack catalog ``qdrant.internal_url``.
    ewa_qdrant_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("EWA_QDRANT_URL", "EWA_QDRANT_HTTP_URL"),
        description=(
            "Companion episodic memory Qdrant HTTP base URL (same shape as AsyncQdrantClient url arg). "
            "Unset → ``self.qdrant.internal_url`` (shared with generic chat-memory client when api key absent)."
        ),
    )
    #: Optional bearer for managed-Qdrant; only used when constructing the companion episodic client.
    ewa_qdrant_api_key: str | None = Field(
        default=None,
        validation_alias="EWA_QDRANT_API_KEY",
        description="Optional API key for companion episodic Qdrant (distinct from anonymous in-cluster REST).",
    )
    #: Wall-clock soft budget for embedding + Qdrant in ``compose_memory_window`` — exceed → episodic retrieval skipped / fallback path.
    ewa_companion_retrieval_budget_ms: int = Field(
        default=4500,
        ge=50,
        le=30000,
        validation_alias="EWA_COMPANION_RETRIEVAL_BUDGET_MS",
        description=(
            "Milliseconds for companion HCM episodic retrieval (embed + vector search). Logs timing; over-budget skips vector layer. "
            "Raise when embedding HTTP targets off-host (LAN, separate machine) or when using large episodic windows."
        ),
    )

    chromadb_default_collections: dict[str, dict[str, Any]] = {
        "documents": {
            "name": "eliteew_documents",
            "metadata": {"description": "Document editor content", "type": "documents"},
            "auto_index": True,
            "similarity_threshold": 0.7,
        },
        "chats": {
            "name": "eliteew_chats",
            "metadata": {"description": "Chat conversation history", "type": "conversations"},
            "auto_index": True,
            "similarity_threshold": 0.6,
        },
        "knowledge": {
            "name": "eliteew_knowledge",
            "metadata": {"description": "AI knowledge base", "type": "knowledge"},
            "auto_index": True,
            "similarity_threshold": 0.8,
        },
        "user_content": {
            "name": "eliteew_user_content",
            "metadata": {"description": "User-generated content", "type": "user_data"},
            "auto_index": False,
            "similarity_threshold": 0.7,
        },
    }

    # AI Embeddings integration settings
    ai_embeddings_integration: dict[str, dict[str, Any]] = {
        "document_editor": {
            "enabled": True,
            "auto_index_on_save": True,
            "collection": "documents",
            "chunk_size": 1000,
            "overlap": 200,
            "min_content_length": 50,
        },
        "chat_system": {
            "enabled": True,
            "auto_index_conversations": True,
            "collection": "chats",
            "context_search_enabled": True,
            "max_context_results": 5,
        },
        "knowledge_base": {
            "enabled": True,
            "collection": "knowledge",
            "auto_categorization": True,
            "semantic_deduplication": True,
        },
    }

    ai_embeddings_models: dict[str, dict[str, Any]] = {
        "nomic-embed-text": {
            "dimension": 768,
            "max_tokens": 8192,
            "description": "General purpose text embeddings",
            "use_cases": ["documents", "chats", "general_text"],
        },
        "mxbai-embed-large": {
            "dimension": 1024,
            "max_tokens": 512,
            "description": "High quality embeddings for precise matching",
            "use_cases": ["knowledge", "precise_search"],
        },
        "all-minilm": {
            "dimension": 384,
            "max_tokens": 256,
            "description": "Fast lightweight embeddings",
            "use_cases": ["quick_search", "real_time"],
        },
    }

    vector_search_config: dict[str, Any] = {
        "similarity_metrics": ["cosine", "euclidean", "manhattan"],
        "default_metric": "cosine",
        "search_timeout": 30,
        "max_results": 100,
        "min_similarity": 0.5,
        "enable_rerank": True,
        "rerank_top_k": 20,
    }

    # =============================================================================
    # =============================================================================

    # Note: jwt_secret_key, secret_key, registration_enabled already defined above
    registration_require_approval: bool = Field(default=True, validation_alias="REGISTRATION_REQUIRE_APPROVAL")
    registration_allowed_domains: list[str] = Field(default=[], validation_alias="REGISTRATION_ALLOWED_DOMAINS")
    registration_max_per_day: int = Field(default=10, validation_alias="REGISTRATION_MAX_PER_DAY")

    # Authentication domains configuration
    auth_domains: dict[str, dict[str, Any]] = {
        "auth.eliteew.ru": {
            "description": "Unified authentication domain",
            "features": ["login", "logout", "token_refresh", "password_reset"],
            "registration_enabled": False,
            "restricted_endpoints": [
                "/api/auth/login",
                "/api/auth/logout",
                "/api/auth/refresh",
                "/api/auth/me",
            ],
        },
        "app.eliteew.ru": {
            "description": "Main application domain",
            "features": ["full_app", "dashboard", "ai_services", "document_editor"],
            "registration_enabled": False,
            "requires_auth": True,
        },
        "eliteew.ru": {
            "description": "Landing page and marketing site",
            "features": ["landing_page", "about", "contact"],
            "registration_enabled": False,
            "public_access": True,
        },
    }

    allowed_hosts: str = Field(default="*", validation_alias="ALLOWED_HOSTS")
    cors_origins: str = Field(default="*", validation_alias="CORS_ORIGINS")

    health_check_interval: int = Field(default=30, validation_alias="HEALTH_CHECK_INTERVAL")
    request_timeout: int = Field(default=30, validation_alias="REQUEST_TIMEOUT")

    # Note: log_level already defined above
    log_format: str = Field(default="json", validation_alias="LOG_FORMAT")

    model_config = SettingsConfigDict(case_sensitive=False, extra="allow")

    def get_all_services(self) -> dict[str, ServiceConfig]:
        services: dict[str, ServiceConfig] = {}
        service_attrs = [
            "postgres",
            "redis",
            "chroma",
            "qdrant",
            "minio",
            "elasticsearch",
            "rabbitmq",
            "llama",
            "openwebui",
            "stable_diffusion",
            "comfyui",
            "real_esrgan",
            "localai",
            "localagi",
            "whisperx",
            "sadtalker",
            "airflow",
            "mlflow",
            "supir",
            "heimdall",
            "code_server",
            "gitea",
            "jenkins",
            "jupyter",
            "sonarqube",
            "nexus",
            "portainer_agent",
            "grafana",
            "prometheus",
            "glances",
            "paperless",
            "tika",
            "ocrmypdf",
            "tesseract",
            "gotenberg",
            "excalidraw",
            "etherpad",
            "ai_assistant",
            "keycloak",
            "coolify",
        ]

        for attr_name in service_attrs:
            if hasattr(self, attr_name):
                attr = getattr(self, attr_name)
                if isinstance(attr, ServiceConfig):
                    services[attr.name] = attr
        return services

    def get_services_by_stack(self, stack: StackType) -> dict[str, ServiceConfig]:
        return {name: service for name, service in self.get_all_services().items() if service.stack == stack}

    def get_gpu_services(self) -> dict[str, ServiceConfig]:
        return {name: service for name, service in self.get_all_services().items() if service.requires_gpu}

    def get_enabled_services(self) -> dict[str, ServiceConfig]:
        return {name: service for name, service in self.get_all_services().items() if service.enabled}

    @property
    def service_stacks(self) -> dict[str, dict[str, Any]]:
        """Backward compatibility: service_stacks (docker_orchestrator moved to trash)."""
        stacks: dict[str, dict[str, Any]] = {}
        for stack_type in StackType:
            stacks[stack_type.value] = {}
            for service in self.get_services_by_stack(stack_type).values():
                stacks[stack_type.value][service.name] = {
                    "port": service.internal_port,
                    "health_endpoint": service.health_endpoint,
                    "container": service.container_name,
                    "external_port": service.external_port,
                    "requires_gpu": service.requires_gpu,
                }
        return stacks

    def validate_configuration(self) -> dict[str, Any]:
        all_svcs = self.get_all_services()
        enabled_svcs = self.get_enabled_services()
        external_ports = [s.external_port for s in enabled_svcs.values()]

        duplicated_external = [p for p in external_ports if external_ports.count(p) > 1]

        return {
            "total_services": len(all_svcs),
            "enabled_services": len(enabled_svcs),
            "gpu_services": len(self.get_gpu_services()),
            "stacks": {stack.value: len(self.get_services_by_stack(stack)) for stack in StackType},
            "duplicated_external_ports": duplicated_external,
            "validation_passed": len(duplicated_external) == 0,
        }

    def get_connection_string(self, service_name: str, database_name: str | None = None) -> str:
        if service_name == "postgres":
            db_name = database_name or self.database_name
            host = self.postgres_host
            port = self.postgres.internal_port
            return f"postgresql://{self.database_user}:{self.database_password}@{host}:{port}/{db_name}"
        if service_name == "redis":
            db_number = str(database_name or self.redis_db)
            if self.redis_url_override:
                base, _, _ = self.redis_url_override.rpartition("/")
                return f"{base}/{db_number}" if base else f"{self.redis_url_override.rstrip('/')}/{db_number}"
            password = self.redis_password
            if password:
                return f"redis://:{password}@{self.redis_host}:{self.redis.internal_port}/{db_number}"
            return f"redis://{self.redis_host}:{self.redis.internal_port}/{db_number}"
        if service_name in {"chromadb", "chroma"}:
            return f"http://{self.chroma.container_name}:{self.chroma.internal_port}"
        if service_name == "elasticsearch":
            return f"http://{self.elasticsearch_host}:{self.elasticsearch_port}"
        if service_name in {"minio", "seaweedfs"}:  # Support both for backward compatibility
            return self.minio_endpoint
        if service_name == "llama_embeddings":
            return f"http://{self.llama.container_name}:{self.llama.internal_port}/api/embeddings"
        service = getattr(self, service_name, None)
        if service and hasattr(service, "internal_url"):
            url = service.internal_url
            return str(url) if url is not None else ""
        return ""

    def get_document_editor_config(self) -> dict[str, Any]:
        return {
            "enabled": self.document_editor_enabled,
            "max_file_size": self.document_editor_max_file_size,
            "supported_formats": self.document_editor_supported_formats,
            "ai_integration": self.document_editor_ai_integration,
            "collaboration": self.document_editor_collaboration,
            "version_control": self.document_editor_version_control,
            "real_time_sync": self.document_editor_real_time_sync,
            "stack_integrations": self.document_stack_integrations,
            "processing_timeout": self.document_processing_timeout,
            "auto_save_interval": self.document_auto_save_interval,
            "collaboration_max_users": self.document_collaboration_max_users,
            "ai_analysis_enabled": self.document_ai_analysis_enabled,
            "ai_services": self.document_ai_services,
            "default_categories": self.document_default_categories,
            "workflow_enabled": self.document_workflow_enabled,
            "default_workflows": self.document_default_workflows,
            "websocket_enabled": self.document_websocket_enabled,
            "websocket_room_prefix": self.document_websocket_room_prefix,
            "websocket_max_connections": self.document_websocket_max_connections_per_document,
            "access_levels": self.document_access_levels,
            "permission_types": self.document_permission_types,
            "database_connection": self.get_connection_string("postgres", "ai_services"),
            "redis_connection": self.get_connection_string("redis"),
            "minio_endpoint": self.minio.internal_url,
            "elasticsearch_endpoint": self.elasticsearch.internal_url,
            "chromadb_endpoint": self.chroma.internal_url,
            "llama_endpoint": self.llama.internal_url,
            "tika_endpoint": self.tika.internal_url,
            "tesseract_endpoint": self.tesseract.internal_url,
            "ai_embeddings_config": self.get_ai_embeddings_config(),
        }

    def get_document_ai_config(self) -> dict[str, Any]:
        return {
            "services": self.document_ai_services,
            "endpoints": {
                "llama": self.llama.internal_url,
                "localai": self.localai.internal_url,
                "chromadb": self.chroma.internal_url,
                "tika": self.tika.internal_url,
                "tesseract": self.tesseract.internal_url,
                "ocrmypdf": self.ocrmypdf.internal_url,
                "gotenberg": self.gotenberg.internal_url,
            },
            "default_models": {
                "text_generation": [self.default_ai_model],
                "text_analysis": [self.default_ai_model],
                "summarization": [self.default_ai_model],
                "embeddings": [self.embedding_ai_model]
                + (
                    [self.ai_embeddings_fallback_model.strip()]
                    if self.ai_embeddings_fallback_model and self.ai_embeddings_fallback_model.strip()
                    else []
                ),
            },
            "processing_timeouts": {
                "text_extraction": 120,
                "content_analysis": 180,
                "summarization": 300,
                "translation": 240,
                "ocr_processing": 300,
                "embeddings_generation": 180,
                "semantic_search": 60,
                "similarity_matching": 30,
            },
            "vector_search": self.vector_search_config,
            "embeddings_integration": self.ai_embeddings_integration,
        }

    def get_ai_embeddings_config(self) -> dict[str, Any]:
        return {
            "enabled": self.ai_embeddings_enabled,
            "default_model": self.ai_embeddings_model,
            "fallback_model": self.ai_embeddings_fallback_model,
            "dimension": self.ai_embeddings_dimension,
            "batch_size": self.ai_embeddings_batch_size,
            "cache_ttl": self.ai_embeddings_cache_ttl,
            "auto_index": self.ai_embeddings_auto_index,
            "collections": self.chromadb_default_collections,
            "integration": self.ai_embeddings_integration,
            "models": self.ai_embeddings_models,
            "vector_search": self.vector_search_config,
            "endpoints": {
                "chromadb": self.chroma.internal_url,
                "llama": self.llama.internal_url,
                "redis": self.redis.internal_url,
            },
            "connection_strings": {
                "chromadb": f"http://{self.chroma.container_name}:{self.chroma.internal_port}",
                "llama_embeddings": f"http://{self.llama.container_name}:{self.llama.internal_port}/api/embeddings",
                "redis_cache": f"redis://{self.redis.container_name}:{self.redis.internal_port}/4",  # DB 4 for unified config cache, без пароля
            },
        }

    def get_chromadb_config(self) -> dict[str, Any]:
        return {
            "host": self.chroma.container_name,
            "port": self.chroma.internal_port,
            "base_url": self.chroma.internal_url,
            "health_endpoint": self.chroma.health_endpoint,
            "default_collections": self.chromadb_default_collections,
            "embeddings_config": {
                "default_model": self.ai_embeddings_model,
                "dimension": self.ai_embeddings_dimension,
                "batch_size": self.ai_embeddings_batch_size,
                "llama_url": self.llama.internal_url,
            },
            "performance": {
                "cache_ttl": self.ai_embeddings_cache_ttl,
                "batch_size": self.ai_embeddings_batch_size,
                "timeout": 30,
                "retry_attempts": 3,
            },
        }

    def get_auth_config(self) -> dict[str, Any]:
        return {
            "registration_enabled": self.registration_enabled,
            "registration_require_approval": self.registration_require_approval,
            "registration_allowed_domains": self.registration_allowed_domains,
            "registration_max_per_day": self.registration_max_per_day,
            "auth_domains": self.auth_domains,
            "jwt_secret_key": self.jwt_secret_key,
            "secret_key": self.secret_key,
        }

    def is_registration_enabled_for_domain(self, domain: str) -> bool:
        if domain in self.auth_domains:
            value = self.auth_domains[domain].get("registration_enabled", self.registration_enabled)
            return bool(value) if value is not None else self.registration_enabled
        return self.registration_enabled


unified_settings = UnifiedConfig.create()

settings = unified_settings


def get_unified_settings() -> UnifiedConfig:
    """Get unified settings instance.

    This function provides a consistent way to access unified settings
    across the application, especially for modular routers that need
    to import settings dynamically.

    Returns:
        UnifiedConfig: The unified settings instance

    """
    return unified_settings


def get_container_mapping() -> dict[str, str]:
    return {service.name: service.container_name for service in unified_settings.get_all_services().values()}


def get_service_stacks() -> dict[str, dict[str, Any]]:
    stacks: dict[str, dict[str, Any]] = {}
    for stack_type in StackType:
        stacks[stack_type.value] = {}
        for service in unified_settings.get_services_by_stack(stack_type).values():
            stacks[stack_type.value][service.name] = {
                "port": service.internal_port,
                "health_endpoint": service.health_endpoint,
                "container": service.container_name,
                "external_port": service.external_port,
                "requires_gpu": service.requires_gpu,
            }
    return stacks


CONTAINER_MAPPING = get_container_mapping()


# Silent validation - only log critical errors
_logger = logging.getLogger(__name__)
_validation_result = unified_settings.validate_configuration()
if not _validation_result["validation_passed"]:
    _logger.warning(
        "?? Config validation: duplicated ports %s", _validation_result.get("duplicated_external_ports", [])
    )
# Config OK: {_validation_result['total_services']} services ({_validation_result['enabled_services']} enabled, {_validation_result['gpu_services']} GPU)
