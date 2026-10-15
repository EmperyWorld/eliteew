# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Central runtime resolver for global web-search config in Admin DB, including encrypted secrets.
# Invariants:
# - Plaintext provider secrets are never returned from service payloads or audit snapshots.
# - Runtime uses DB-first settings and env fallback on DB unavailability.
# Related:
# - api/models/search_runtime_config.py
# - api/services/search_service.py
# - api/routers/desktop_admin_search_config.py
# ---

from __future__ import annotations

import base64
import hashlib
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from api.core.unified_config import get_unified_settings, unified_settings
from api.models.search_runtime_config import SearchRuntimeConfig, SearchRuntimeConfigAudit
from api.services.unified_content.encryption_service import get_encryption_service

logger = logging.getLogger(__name__)

SEARCH_SURFACES: tuple[str, ...] = ("desktop", "ewa", "marketing", "imperorg", "ugs")
SEARCH_SECRET_KEYS: tuple[str, ...] = ("yandex_api_key", "yandex_folder_id")
SEARCH_PROVIDER_ID = "yandex"
DEFAULT_CACHE_TTL_SEC = 300
DEFAULT_CACHE_EMPTY_TTL_SEC = 60
MAX_CACHE_TTL_SEC = 3600


@dataclass(frozen=True)
class EffectiveSearchRuntimeConfig:
    yandex_api_key: str
    yandex_folder_id: str
    yandex_search_type: str
    yandex_search_l10n: str
    yandex_search_region: str
    yandex_groups_on_page: int
    cache_enabled: bool
    cache_ttl_sec: int
    cache_empty_ttl_sec: int
    quota_enforced: bool
    monthly_free_default: int
    default_limit: int
    surfaces: dict[str, bool]
    source: str
    surface_enabled: bool
    updated_by: str | None = None
    updated_at_iso: str | None = None

    @property
    def provider_mode(self) -> str:
        """Legacy read-only alias — production uses Yandex only."""
        return SEARCH_PROVIDER_ID


class SearchSecretEncryptionError(RuntimeError):
    """Raised when search secret encryption cannot be performed safely."""


def _strip_legacy_settings(raw: dict[str, Any]) -> dict[str, Any]:
    cleaned = dict(raw)
    cleaned.pop("searxng_url", None)
    cleaned.pop("provider_mode", None)
    return cleaned


def _normalize_positive_int(raw: Any, *, fallback: int, lower: int, upper: int) -> int:
    try:
        value = int(raw)
    except TypeError, ValueError:
        return fallback
    return max(lower, min(upper, value))


def _normalize_flag(raw: Any, *, fallback: bool) -> bool:
    if isinstance(raw, bool):
        return raw
    if raw is None:
        return fallback
    text = str(raw).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return fallback


def _normalize_text(raw: Any, *, fallback: str) -> str:
    text = str(raw or "").strip()
    return text or fallback


def _normalize_surfaces(raw: Any) -> dict[str, bool]:
    base = {surface: True for surface in SEARCH_SURFACES}
    if not isinstance(raw, dict):
        return base
    for surface in SEARCH_SURFACES:
        if surface in raw:
            base[surface] = _normalize_flag(raw.get(surface), fallback=base[surface])
    return base


def _env_settings_defaults() -> dict[str, Any]:
    settings = get_unified_settings()
    return {
        "yandex_search_type": _normalize_text(getattr(settings, "yandex_search_type", "auto"), fallback="auto"),
        "yandex_search_l10n": _normalize_text(getattr(settings, "yandex_search_l10n", "auto"), fallback="auto"),
        "yandex_search_region": _normalize_text(getattr(settings, "yandex_search_region", "225"), fallback="225"),
        "yandex_groups_on_page": _normalize_positive_int(
            getattr(settings, "yandex_search_groups_on_page", 5),
            fallback=5,
            lower=1,
            upper=20,
        ),
        "cache_enabled": True,
        "cache_ttl_sec": DEFAULT_CACHE_TTL_SEC,
        "cache_empty_ttl_sec": DEFAULT_CACHE_EMPTY_TTL_SEC,
        "quota_enforced": _normalize_flag(getattr(settings, "web_search_quota_enforced", True), fallback=True),
        "monthly_free_default": _normalize_positive_int(
            getattr(settings, "web_search_monthly_free_default", 50),
            fallback=50,
            lower=0,
            upper=10_000,
        ),
        "default_limit": 8,
        "surfaces": _normalize_surfaces(None),
    }


def _env_secret_defaults() -> dict[str, str]:
    settings = get_unified_settings()
    return {
        "yandex_api_key": str(getattr(settings, "yandex_search_api_key", None) or "").strip(),
        "yandex_folder_id": str(getattr(settings, "yandex_cloud_folder_id", None) or "").strip(),
    }


def _normalize_settings_payload(payload: dict[str, Any] | None, *, fallback: dict[str, Any]) -> dict[str, Any]:
    raw = _strip_legacy_settings(payload or {})
    out: dict[str, Any] = {
        "yandex_search_type": _normalize_text(
            raw.get("yandex_search_type", fallback["yandex_search_type"]), fallback="auto"
        ),
        "yandex_search_l10n": _normalize_text(
            raw.get("yandex_search_l10n", fallback["yandex_search_l10n"]), fallback="auto"
        ),
        "yandex_search_region": _normalize_text(
            raw.get("yandex_search_region", fallback["yandex_search_region"]), fallback="225"
        ),
        "yandex_groups_on_page": _normalize_positive_int(
            raw.get("yandex_groups_on_page", fallback["yandex_groups_on_page"]),
            fallback=int(fallback["yandex_groups_on_page"]),
            lower=1,
            upper=20,
        ),
        "cache_enabled": _normalize_flag(raw.get("cache_enabled", fallback.get("cache_enabled", True)), fallback=True),
        "cache_ttl_sec": _normalize_positive_int(
            raw.get("cache_ttl_sec", fallback.get("cache_ttl_sec", DEFAULT_CACHE_TTL_SEC)),
            fallback=int(fallback.get("cache_ttl_sec", DEFAULT_CACHE_TTL_SEC)),
            lower=0,
            upper=MAX_CACHE_TTL_SEC,
        ),
        "cache_empty_ttl_sec": _normalize_positive_int(
            raw.get("cache_empty_ttl_sec", fallback.get("cache_empty_ttl_sec", DEFAULT_CACHE_EMPTY_TTL_SEC)),
            fallback=int(fallback.get("cache_empty_ttl_sec", DEFAULT_CACHE_EMPTY_TTL_SEC)),
            lower=0,
            upper=MAX_CACHE_TTL_SEC,
        ),
        "quota_enforced": _normalize_flag(raw.get("quota_enforced", fallback["quota_enforced"]), fallback=True),
        "monthly_free_default": _normalize_positive_int(
            raw.get("monthly_free_default", fallback["monthly_free_default"]),
            fallback=int(fallback["monthly_free_default"]),
            lower=0,
            upper=10_000,
        ),
        "default_limit": _normalize_positive_int(
            raw.get("default_limit", fallback.get("default_limit", 8)),
            fallback=int(fallback.get("default_limit", 8)),
            lower=1,
            upper=20,
        ),
    }
    out["surfaces"] = _normalize_surfaces(raw.get("surfaces", fallback.get("surfaces")))
    return out


def _search_runtime_fallback_cipher():
    from cryptography.fernet import Fernet

    key_source = (
        unified_settings.encryption_master_key or unified_settings.secret_key or unified_settings.jwt_secret_key or ""
    ).strip()
    if not key_source:
        return None
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(f"search-runtime::{key_source}".encode()).digest())
    return Fernet(derived_key)


def encrypt_search_secret(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""

    try:
        encrypted = get_encryption_service().encrypt(text)
        if encrypted and encrypted != text:
            return encrypted
    except Exception as exc:  # noqa: BLE001
        logger.warning("Search runtime secret encryption fallback: %s", exc)

    cipher = _search_runtime_fallback_cipher()
    if cipher is None:
        msg = "Search runtime secret encryption is unavailable (no encryption key)"
        raise SearchSecretEncryptionError(msg)
    return base64.b64encode(cipher.encrypt(text.encode("utf-8"))).decode("utf-8")


def decrypt_search_secret(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        decrypted = get_encryption_service().decrypt(text)
        if decrypted and decrypted != text:
            return decrypted
    except Exception as exc:  # noqa: BLE001
        logger.warning("Search runtime secret decryption fallback: %s", exc)

    cipher = _search_runtime_fallback_cipher()
    if cipher is None:
        return ""
    try:
        encrypted = base64.b64decode(text.encode("utf-8"))
        return cipher.decrypt(encrypted).decode("utf-8")
    except Exception:  # noqa: BLE001
        return ""


def _decrypted_db_secrets(encrypted_map: dict[str, Any] | None) -> dict[str, str]:
    payload = encrypted_map or {}
    out: dict[str, str] = {}
    for key in SEARCH_SECRET_KEYS:
        out[key] = decrypt_search_secret(str(payload.get(key) or ""))
    return out


def _effective_secret_values(
    *,
    encrypted_map: dict[str, Any] | None,
    env_defaults: dict[str, str],
) -> dict[str, str]:
    db_values = _decrypted_db_secrets(encrypted_map)
    return {key: (db_values.get(key) or env_defaults.get(key) or "").strip() for key in SEARCH_SECRET_KEYS}


def _build_secret_status(
    *,
    encrypted_map: dict[str, Any] | None,
    effective_values: dict[str, str],
) -> dict[str, dict[str, bool]]:
    raw = encrypted_map or {}
    out: dict[str, dict[str, bool]] = {}
    for key in SEARCH_SECRET_KEYS:
        configured_in_db = bool(str(raw.get(key) or "").strip())
        configured = bool(str(effective_values.get(key) or "").strip())
        out[key] = {
            "configured": configured,
            "configured_in_db": configured_in_db,
            "value_masked": configured_in_db,
        }
    return out


def _merge_settings_patch(base: dict[str, Any], patch: dict[str, Any] | None) -> dict[str, Any]:
    if not patch:
        return dict(base)
    merged = dict(base)
    for key, value in patch.items():
        if key == "surfaces" and isinstance(value, dict):
            current = dict(merged.get("surfaces") or {})
            for surface, surface_enabled in value.items():
                if surface in SEARCH_SURFACES:
                    current[surface] = _normalize_flag(surface_enabled, fallback=bool(current.get(surface, True)))
            merged["surfaces"] = current
            continue
        merged[key] = value
    return merged


def _runtime_from_payload(
    *,
    settings: dict[str, Any],
    secrets: dict[str, str],
    source: str,
    surface: str | None,
    updated_by: str | None,
    updated_at_iso: str | None,
) -> EffectiveSearchRuntimeConfig:
    surfaces = _normalize_surfaces(settings.get("surfaces"))
    normalized = _normalize_settings_payload(settings, fallback=_env_settings_defaults())
    surface_key = (surface or "").strip().lower()
    surface_enabled = True if not surface_key else bool(surfaces.get(surface_key, True))
    return EffectiveSearchRuntimeConfig(
        yandex_api_key=str(secrets.get("yandex_api_key") or ""),
        yandex_folder_id=str(secrets.get("yandex_folder_id") or ""),
        yandex_search_type=str(normalized["yandex_search_type"]),
        yandex_search_l10n=str(normalized["yandex_search_l10n"]),
        yandex_search_region=str(normalized["yandex_search_region"]),
        yandex_groups_on_page=int(normalized["yandex_groups_on_page"]),
        cache_enabled=bool(normalized["cache_enabled"]),
        cache_ttl_sec=int(normalized["cache_ttl_sec"]),
        cache_empty_ttl_sec=int(normalized["cache_empty_ttl_sec"]),
        quota_enforced=bool(normalized["quota_enforced"]),
        monthly_free_default=int(normalized["monthly_free_default"]),
        default_limit=int(normalized["default_limit"]),
        surfaces=surfaces,
        source=source,
        surface_enabled=surface_enabled,
        updated_by=updated_by,
        updated_at_iso=updated_at_iso,
    )


def _normalized_db_settings(row: SearchRuntimeConfig | None) -> dict[str, Any]:
    fallback = _env_settings_defaults()
    raw = dict(row.settings_json or {}) if row is not None and isinstance(row.settings_json, dict) else {}
    return _normalize_settings_payload(_strip_legacy_settings(raw), fallback=fallback)


def _db_row_has_explicit_values(row: SearchRuntimeConfig) -> bool:
    settings_present = bool(dict(row.settings_json or {})) if isinstance(row.settings_json, dict) else False
    if settings_present:
        return True
    if not isinstance(row.secrets_encrypted_json, dict):
        return False
    return any(str(row.secrets_encrypted_json.get(key) or "").strip() for key in SEARCH_SECRET_KEYS)


def _encrypt_env_secrets_for_storage() -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in _env_secret_defaults().items():
        plain = str(value or "").strip()
        if not plain:
            continue
        out[key] = encrypt_search_secret(plain)
    return out


async def resolve_effective_search_runtime_config(
    db: AsyncSession | None,
    *,
    surface: str | None = None,
) -> EffectiveSearchRuntimeConfig:
    env_settings = _env_settings_defaults()
    env_secrets = _env_secret_defaults()
    if db is None:
        logger.debug("[STEP] search_config_fallback_env reason=missing_db")
        return _runtime_from_payload(
            settings=env_settings,
            secrets=env_secrets,
            source="env",
            surface=surface,
            updated_by=None,
            updated_at_iso=None,
        )

    try:
        row = await db.get(SearchRuntimeConfig, 1)
    except Exception as exc:  # noqa: BLE001
        logger.debug("[STEP] search_config_fallback_env reason=db_error err=%s", exc)
        return _runtime_from_payload(
            settings=env_settings,
            secrets=env_secrets,
            source="env",
            surface=surface,
            updated_by=None,
            updated_at_iso=None,
        )

    if row is None:
        logger.debug("[STEP] search_config_fallback_env reason=missing_row")
        return _runtime_from_payload(
            settings=env_settings,
            secrets=env_secrets,
            source="env",
            surface=surface,
            updated_by=None,
            updated_at_iso=None,
        )

    if not _db_row_has_explicit_values(row):
        logger.debug("[STEP] search_config_fallback_env reason=empty_db_row")
        return _runtime_from_payload(
            settings=env_settings,
            secrets=env_secrets,
            source="env",
            surface=surface,
            updated_by=None,
            updated_at_iso=None,
        )

    normalized_settings = _normalized_db_settings(row)
    effective_secrets = _effective_secret_values(
        encrypted_map=(dict(row.secrets_encrypted_json or {}) if isinstance(row.secrets_encrypted_json, dict) else {}),
        env_defaults=env_secrets,
    )
    return _runtime_from_payload(
        settings=normalized_settings,
        secrets=effective_secrets,
        source="db",
        surface=surface,
        updated_by=str(row.updated_by) if row.updated_by else None,
        updated_at_iso=row.updated_at.isoformat() if row.updated_at else None,
    )


async def get_search_runtime_admin_payload(db: AsyncSession) -> dict[str, Any]:
    runtime = await resolve_effective_search_runtime_config(db, surface=None)
    row = await db.get(SearchRuntimeConfig, 1)
    encrypted_map = (
        dict(row.secrets_encrypted_json or {}) if row and isinstance(row.secrets_encrypted_json, dict) else {}
    )
    status = _build_secret_status(
        encrypted_map=encrypted_map,
        effective_values={
            "yandex_api_key": runtime.yandex_api_key,
            "yandex_folder_id": runtime.yandex_folder_id,
        },
    )
    return {
        "settings": {
            "provider": SEARCH_PROVIDER_ID,
            "yandex_search_type": runtime.yandex_search_type,
            "yandex_search_l10n": runtime.yandex_search_l10n,
            "yandex_search_region": runtime.yandex_search_region,
            "yandex_groups_on_page": runtime.yandex_groups_on_page,
            "cache_enabled": runtime.cache_enabled,
            "cache_ttl_sec": runtime.cache_ttl_sec,
            "cache_empty_ttl_sec": runtime.cache_empty_ttl_sec,
            "quota_enforced": runtime.quota_enforced,
            "monthly_free_default": runtime.monthly_free_default,
            "default_limit": runtime.default_limit,
            "surfaces": dict(runtime.surfaces),
        },
        "secrets": status,
        "source": runtime.source,
        "updated_by": runtime.updated_by,
        "updated_at": runtime.updated_at_iso,
    }


async def patch_search_runtime_admin_payload(
    db: AsyncSession,
    *,
    actor_user_id: UUID | None,
    settings_patch: dict[str, Any] | None,
    secret_updates: dict[str, dict[str, Any]] | None,
    audit_note: str | None = None,
) -> dict[str, Any]:
    row = await db.get(SearchRuntimeConfig, 1)
    if row is None:
        row = SearchRuntimeConfig(
            id=1,
            settings_json=_env_settings_defaults(),
            secrets_encrypted_json=_encrypt_env_secrets_for_storage(),
            updated_by=actor_user_id,
            updated_at=datetime.now(UTC),
        )
        db.add(row)
        await db.flush()

    before_settings = _normalized_db_settings(row)
    before_effective = _effective_secret_values(
        encrypted_map=(dict(row.secrets_encrypted_json or {}) if isinstance(row.secrets_encrypted_json, dict) else {}),
        env_defaults=_env_secret_defaults(),
    )
    before_status = _build_secret_status(
        encrypted_map=(dict(row.secrets_encrypted_json or {}) if isinstance(row.secrets_encrypted_json, dict) else {}),
        effective_values=before_effective,
    )

    merged = _merge_settings_patch(before_settings, settings_patch)
    next_settings = _normalize_settings_payload(merged, fallback=_env_settings_defaults())

    encrypted_map = dict(row.secrets_encrypted_json or {}) if isinstance(row.secrets_encrypted_json, dict) else {}
    for key, op in (secret_updates or {}).items():
        if key not in SEARCH_SECRET_KEYS or not isinstance(op, dict):
            continue
        action = str(op.get("action") or "keep").strip().lower()
        if action in {"set", "rotate"}:
            value = str(op.get("value") or "").strip()
            if not value:
                msg = f"Secret '{key}' requires non-empty value for action '{action}'."
                raise ValueError(msg)
            encrypted_map[key] = encrypt_search_secret(value)
        elif action == "clear":
            encrypted_map.pop(key, None)

    row.settings_json = next_settings
    row.secrets_encrypted_json = encrypted_map
    row.updated_by = actor_user_id
    row.updated_at = datetime.now(UTC)

    after_effective = _effective_secret_values(
        encrypted_map=encrypted_map,
        env_defaults=_env_secret_defaults(),
    )
    after_status = _build_secret_status(
        encrypted_map=encrypted_map,
        effective_values=after_effective,
    )

    db.add(
        SearchRuntimeConfigAudit(
            actor_user_id=actor_user_id,
            action="patch",
            before_settings=before_settings,
            after_settings=next_settings,
            before_secrets_status=before_status,
            after_secrets_status=after_status,
            note=(audit_note or "").strip() or None,
        )
    )
    await db.commit()

    from api.services.search_service import invalidate_web_search_cache

    await invalidate_web_search_cache()

    return await get_search_runtime_admin_payload(db)


async def bootstrap_search_runtime_config_from_env(
    db: AsyncSession,
    *,
    actor_user_id: UUID | None,
    force: bool = False,
    audit_note: str | None = None,
) -> dict[str, Any]:
    row = await db.get(SearchRuntimeConfig, 1)
    before_settings: dict[str, Any] = {}
    before_status: dict[str, dict[str, bool]] = {
        key: {"configured": False, "configured_in_db": False, "value_masked": False} for key in SEARCH_SECRET_KEYS
    }
    if row is not None:
        before_settings = _normalized_db_settings(row)
        before_effective = _effective_secret_values(
            encrypted_map=(
                dict(row.secrets_encrypted_json or {}) if isinstance(row.secrets_encrypted_json, dict) else {}
            ),
            env_defaults=_env_secret_defaults(),
        )
        before_status = _build_secret_status(
            encrypted_map=(
                dict(row.secrets_encrypted_json or {}) if isinstance(row.secrets_encrypted_json, dict) else {}
            ),
            effective_values=before_effective,
        )
        if _db_row_has_explicit_values(row) and not force:
            return await get_search_runtime_admin_payload(db)
    settings = _env_settings_defaults()
    encrypted_secrets = _encrypt_env_secrets_for_storage()
    if row is None:
        row = SearchRuntimeConfig(
            id=1,
            settings_json=settings,
            secrets_encrypted_json=encrypted_secrets,
            updated_by=actor_user_id,
            updated_at=datetime.now(UTC),
        )
        db.add(row)
    else:
        row.settings_json = settings
        row.secrets_encrypted_json = encrypted_secrets
        row.updated_by = actor_user_id
        row.updated_at = datetime.now(UTC)

    after_effective = _effective_secret_values(
        encrypted_map=encrypted_secrets,
        env_defaults=_env_secret_defaults(),
    )
    after_status = _build_secret_status(
        encrypted_map=encrypted_secrets,
        effective_values=after_effective,
    )
    db.add(
        SearchRuntimeConfigAudit(
            actor_user_id=actor_user_id,
            action="bootstrap_env",
            before_settings=before_settings,
            after_settings=settings,
            before_secrets_status=before_status,
            after_secrets_status=after_status,
            note=(audit_note or "").strip() or None,
        )
    )
    await db.commit()
    return await get_search_runtime_admin_payload(db)
