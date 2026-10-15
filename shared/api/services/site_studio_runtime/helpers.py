# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Site Studio runtime helpers (paths, templates, secrets, URL builders).
# Invariants:
# - Public imports remain via api.services.site_studio_runtime_service.
# Related:
# - documentation/product/SITE-STUDIO.md
# - api/services/site_studio_runtime_service.py
# ---
from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

from api.core.unified_config import unified_settings
from api.models.desktop import ProjectSiteInstance, UserSiteInstance

SiteStudioRuntimeInstance = UserSiteInstance | ProjectSiteInstance
from api.services.site_studio_public_utils import (
    SITE_STUDIO_PUBLIC_BASE_DOMAIN,
    build_site_studio_public_api_base_url,
    build_site_studio_public_hostname,
    build_site_studio_public_origin,
    is_site_studio_public_host,
    normalize_site_studio_request_host,
)

# Legacy product wildcard hosts (pre eliteew.ru cutover). Custom domains are kept as-is.
_SITE_STUDIO_LEGACY_PUBLIC_BASE_DOMAINS = ("sites.empery.world", "sites.eliteew.ru")
from api.services.unified_content.encryption_service import get_encryption_service
from api.utils.datetime_helpers import utc_now_naive

logger = logging.getLogger(__name__)


def _resolve_path_from_candidates(
    *,
    env_var: str,
    candidates: tuple[str, ...],
    prefer_existing: bool,
) -> Path:
    env_value = os.environ.get(env_var)
    ordered_candidates = tuple(
        candidate for candidate in ((env_value,) + candidates if env_value else candidates) if candidate
    )
    for candidate in ordered_candidates:
        path = Path(candidate).expanduser()
        if path.exists():
            return path.resolve()
    fallback = Path(ordered_candidates[0]).expanduser()
    if prefer_existing:
        return fallback
    return fallback.resolve()


# In-container checkout mirror. Compose bind-mounts repo slices here so scripts
# that walk parents from their own path still see docker/builders next to docker/scripts.
_CONTAINER_CHECKOUT = "/opt/eliteew"


def _monorepo_root() -> Path | None:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "docker" / "stack").is_dir() and (parent / "shared" / "api").is_dir():
            return parent
    return None


def _checkout_path(*parts: str) -> str:
    root = _monorepo_root()
    if root is None:
        return ""
    return str(root.joinpath(*parts))


DEFAULT_TEMPLATE_KEY = "olenti"
SITE_STUDIO_AURELIA_TEMPLATE_KEY = "aurelia"
_OLENTI_TEMPLATE_PATH_CANDIDATES: tuple[str, ...] = tuple(
    candidate
    for candidate in (
        "/app/site-templates/olenti",
        f"{_CONTAINER_CHECKOUT}/site-templates/olenti",
        _checkout_path("site-templates", "olenti"),
    )
    if candidate
)
# Alias templates use the same runtime stack as olenti (4-container template); operators may add dedicated roots later.
SITE_STUDIO_TEMPLATE_ROOT_CANDIDATES: dict[str, tuple[str, ...]] = {
    DEFAULT_TEMPLATE_KEY: _OLENTI_TEMPLATE_PATH_CANDIDATES,
    "allenti": (
        "/app/site-templates/allenti",
        f"{_CONTAINER_CHECKOUT}/site-templates/allenti",
        _checkout_path("site-templates", "allenti"),
        *_OLENTI_TEMPLATE_PATH_CANDIDATES,
    ),
    SITE_STUDIO_AURELIA_TEMPLATE_KEY: (
        "/app/site-templates/aurelia",
        f"{_CONTAINER_CHECKOUT}/site-templates/aurelia",
        _checkout_path("site-templates", "aurelia"),
        *_OLENTI_TEMPLATE_PATH_CANDIDATES,
    ),
}

SITE_STUDIO_TEMPLATE_PROFILE_STATE_KEY = "_site_template_profile"
SITE_STUDIO_TEMPLATE_RUNTIME_PROFILES: dict[str, dict[str, Any]] = {
    SITE_STUDIO_AURELIA_TEMPLATE_KEY: {
        "profile_id": "aurelia-v1",
        "site_settings": {
            "siteTitle": "{brand}",
            "siteDescription": "{brand} - премиальная витрина: {topic}",
            "defaultTheme": "nocturnal-bloom",
            "contactEmail": "{admin_email}",
            "contactPhone": "+7 (900) 000-70-70",
            "contactAddress": "Онлайн + встречи по записи",
            "workingHours": "Пн-Сб 10:00-20:00",
        },
        "blocks": [
            {"page": "home", "section": "hero", "key": "badge", "value": "Премиальный формат под ключ"},
            {"page": "home", "section": "hero", "key": "headline_1", "value": "{brand}"},
            {
                "page": "home",
                "section": "hero",
                "key": "headline_2",
                "value": "Сайт, который уверенно продает ваш опыт",
            },
            {
                "page": "home",
                "section": "hero",
                "key": "lead",
                "value": (
                    "Мы соединяем витрину, услуги и личный бренд в единый сценарий: "
                    "посетитель сразу видит ценность, офферы и понятный путь к заявке."
                ),
            },
            {"page": "home", "section": "hero", "key": "cta_shop", "value": "Смотреть предложения"},
            {"page": "home", "section": "hero", "key": "cta_consultation", "value": "Записаться на встречу"},
            {"page": "home", "section": "hero", "key": "card_label", "value": "Запуск в фокусе"},
            {"page": "home", "section": "hero", "key": "card_title", "value": "Структура + контент + визуал"},
            {
                "page": "home",
                "section": "hero",
                "key": "card_description",
                "value": (
                    "Готовим рабочую витрину с каталогом, блоком экспертизы и маршрутом до заявки, "
                    "чтобы сайт можно было показывать клиентам сразу после запуска."
                ),
            },
            {"page": "home", "section": "hero", "key": "card_notes", "value": "Без перегруза и воды"},
            {
                "page": "home",
                "section": "hero",
                "key": "card_footer",
                "value": "Подходит для экспертных и сервисных ниш",
            },
            {"page": "home", "section": "about_preview", "key": "greeting", "value": "О проекте"},
            {
                "page": "home",
                "section": "about_preview",
                "key": "title",
                "value": "{brand}: системный подход к росту",
            },
            {
                "page": "home",
                "section": "about_preview",
                "key": "description_1",
                "value": (
                    "Витрина построена вокруг доверия: короткий путь от первого экрана "
                    "к доказательствам, портфолио и действию."
                ),
            },
            {
                "page": "home",
                "section": "about_preview",
                "key": "description_2",
                "value": (
                    'Секция адаптируется под тематику "{topic}" и помогает объяснить ценность продукта простым языком.'
                ),
            },
            {
                "page": "home",
                "section": "about_preview",
                "key": "cta_consultation",
                "value": "Обсудить задачу",
            },
            {
                "page": "home",
                "section": "about_preview",
                "key": "cta_shop",
                "value": "Открыть каталог",
            },
            {"page": "about", "section": "hero", "key": "badge", "value": "Наша методика"},
            {
                "page": "about",
                "section": "hero",
                "key": "title",
                "value": "Почему клиенты выбирают {brand}",
            },
            {
                "page": "about",
                "section": "hero",
                "key": "description",
                "value": (
                    "Мы проектируем сайт как рабочий инструмент продаж: четкая упаковка оффера, "
                    "прозрачный путь пользователя и контент, который закрывает вопросы до звонка."
                ),
            },
            {
                "page": "about",
                "section": "hero",
                "key": "image_caption",
                "value": "Команда и процессы проекта",
            },
            {"page": "about", "section": "founder", "key": "name", "value": "{brand}"},
            {"page": "about", "section": "founder", "key": "title", "value": "Команда проекта"},
            {
                "page": "about",
                "section": "founder",
                "key": "bio",
                "value": (
                    "Мы объединяем стратегию, дизайн и контент, чтобы сайт выглядел премиально "
                    "и оставался понятным в ежедневной работе команды."
                ),
            },
            {
                "page": "about",
                "section": "founder",
                "key": "bullet1",
                "value": "Понятная архитектура: витрина, услуги, консультации, обучение",
            },
            {
                "page": "about",
                "section": "founder",
                "key": "bullet2",
                "value": "Редактирование через встроенную админку без внешних подрядчиков",
            },
            {
                "page": "about",
                "section": "founder",
                "key": "bullet3",
                "value": "Готовность к итерациям: блоки и акценты обновляются быстро",
            },
            {
                "page": "about",
                "section": "founder",
                "key": "cta_button",
                "value": "Запросить демонстрацию",
            },
            {"page": "home", "section": "value_block", "key": "badge", "value": "Как мы работаем"},
            {
                "page": "home",
                "section": "value_block",
                "key": "paragraph_1",
                "value": "Стартуем с диагностики: фиксируем аудиторию, оффер и критерии результата.",
            },
            {
                "page": "home",
                "section": "value_block",
                "key": "paragraph_2",
                "value": (
                    "Далее собираем контентный каркас и визуальную подачу, чтобы сайт выглядел цельно и убедительно."
                ),
            },
            {
                "page": "home",
                "section": "value_block",
                "key": "paragraph_3",
                "value": (
                    "После запуска доводим конверсию через точечные итерации и работу с обратной связью от клиентов."
                ),
            },
            {
                "page": "home",
                "section": "value_block",
                "key": "cta",
                "value": "Получить план запуска",
            },
            {
                "page": "about",
                "section": "cta_section",
                "key": "title",
                "value": "Готовы запустить {brand} в новом формате?",
            },
            {
                "page": "about",
                "section": "cta_section",
                "key": "description",
                "value": (
                    "Получите рабочую витрину и админку, где команда сможет обновлять контент без технических барьеров."
                ),
            },
            {
                "page": "about",
                "section": "cta_section",
                "key": "button_consultation",
                "value": "Записаться на консультацию",
            },
            {
                "page": "about",
                "section": "cta_section",
                "key": "button_shop",
                "value": "Посмотреть услуги",
            },
        ],
    }
}


def normalize_site_studio_template_key(value: str | None) -> str:
    return (value or DEFAULT_TEMPLATE_KEY).strip().lower() or DEFAULT_TEMPLATE_KEY


def is_supported_site_studio_template(value: str | None) -> bool:
    return normalize_site_studio_template_key(value) in SITE_STUDIO_TEMPLATE_ROOT_CANDIDATES


def resolve_site_studio_template_root(template_key: str | None, *, prefer_existing: bool = True) -> Path:
    normalized_key = normalize_site_studio_template_key(template_key)
    candidates = SITE_STUDIO_TEMPLATE_ROOT_CANDIDATES.get(normalized_key)
    if not candidates:
        raise ValueError(f"Unsupported Site Studio template key: {normalized_key}")

    env_candidates: list[str] = []
    specific_env = os.environ.get(f"USER_SITE_TEMPLATE_ROOT_{normalized_key.upper()}", "").strip()
    if specific_env:
        env_candidates.append(specific_env)
    if normalized_key == DEFAULT_TEMPLATE_KEY:
        global_env = os.environ.get("USER_SITE_TEMPLATE_ROOT", "").strip()
        if global_env:
            env_candidates.append(global_env)

    ordered_candidates = tuple(candidate for candidate in [*env_candidates, *candidates] if candidate)
    for candidate in ordered_candidates:
        path = Path(candidate).expanduser()
        if path.exists():
            return path.resolve()
    fallback = Path(ordered_candidates[0]).expanduser()
    if prefer_existing:
        return fallback
    return fallback.resolve()


DEFAULT_TEMPLATE_ROOT = resolve_site_studio_template_root(DEFAULT_TEMPLATE_KEY)
DEFAULT_RUNTIME_BASE_DIR = _resolve_path_from_candidates(
    env_var="USER_SITE_STUDIO_RUNTIME_BASE_DIR",
    candidates=tuple(
        candidate
        for candidate in (
            "/app/runtime/user_site_studio",
            f"{_CONTAINER_CHECKOUT}/host/runtime/user_site_studio",
            _checkout_path("host", "runtime", "user_site_studio"),
        )
        if candidate
    ),
    prefer_existing=False,
)

FRONTEND_PREVIEW_PORT = 4173
SITE_STUDIO_COMPOSE_RESTART_POLICY = "unless-stopped"
SITE_STUDIO_COMPOSE_RESTART_POLICY = "unless-stopped"
API_PORT = 3000


def _env_int(name: str, default: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("Invalid %s=%r, fallback to %s", name, raw, default)
        return default


def _env_float(name: str, default: float) -> float:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        logger.warning("Invalid %s=%r, fallback to %s", name, raw, default)
        return default


SITE_STUDIO_HEALTH_TIMEOUT_SECONDS = _env_int("USER_SITE_STUDIO_HEALTH_TIMEOUT", 420)
SITE_STUDIO_HEALTH_POLL_SECONDS = _env_float("USER_SITE_STUDIO_HEALTH_POLL", 3)
# Compose/CLI (podman/docker) must not hang the site-studio worker queue forever.
# Root-cause class: short-name image resolution without TTY waits indefinitely.
SITE_STUDIO_COMPOSE_TIMEOUT_SECONDS = _env_int("USER_SITE_STUDIO_COMPOSE_TIMEOUT", 600)
SITE_STUDIO_POSTGRES_IMAGE = (
    os.environ.get("USER_SITE_STUDIO_POSTGRES_IMAGE", "").strip() or "docker.io/library/postgres:16-alpine"
)
SITE_STUDIO_NODE_RUNTIME_IMAGE = (
    os.environ.get("USER_SITE_STUDIO_NODE_RUNTIME_IMAGE", "").strip() or "docker.io/library/node:20-alpine"
)
SITE_STUDIO_SUPPORTED_RUNTIMES: tuple[str, ...] = ("docker", "podman")
SITE_STUDIO_RUNTIME_ENV_VARS: tuple[str, ...] = (
    "USER_SITE_STUDIO_CONTAINER_RUNTIME",
    "ELITEEW_CONTAINER_RUNTIME",
)
SITE_STUDIO_RUNTIME_DEFAULT = "podman"
SITE_STUDIO_PODMAN_COMPOSE_PROVIDER = (
    os.environ.get("USER_SITE_STUDIO_PODMAN_COMPOSE_PROVIDER", "podman-compose").strip() or "podman-compose"
)
# Podman client config home — must be writable. Carrier SSH uses HOME=/home/owned + bind
# ~/.ssh; do not bind host ~/.config (sops/cdi). No /tmp fallback (world-writable).
# Canon: documentation/product/SITE-STUDIO.md
SITE_STUDIO_PODMAN_XDG_CONFIG_HOME_CANONICAL = "/var/lib/eliteew/xdg-config"


def ensure_podman_xdg_config_home(env: dict[str, str]) -> str:
    """Point the Podman CLI at a writable XDG dir; leave SSH HOME unchanged.

    Rootless Podman stats ``$XDG_CONFIG_HOME`` (else ``$HOME/.config``) and fails
    if that path is missing. Site Studio compose sets ``HOME=/home/owned`` for
    Carrier keys, but ``/home/owned/.config`` is not mounted and is not writable
    by uid 1000. Fail closed on the compose/image path only — never ``/tmp``.
    """
    candidates: list[str] = []
    configured = (env.get("XDG_CONFIG_HOME") or "").strip()
    if configured:
        candidates.append(configured)
    candidates.append(SITE_STUDIO_PODMAN_XDG_CONFIG_HOME_CANONICAL)
    seen: set[str] = set()
    errors: list[str] = []
    for raw in candidates:
        if raw in seen:
            continue
        seen.add(raw)
        path = Path(raw)
        try:
            path.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            errors.append(f"{path}: {exc}")
            continue
        if path.is_dir() and os.access(path, os.W_OK):
            resolved = str(path)
            env["XDG_CONFIG_HOME"] = resolved
            return resolved
        errors.append(f"{path}: not a writable directory")
    tried = "; ".join(errors) if errors else "(no candidates)"
    raise SiteStudioRuntimeError(
        "Podman XDG_CONFIG_HOME is missing or not writable. "
        "Set XDG_CONFIG_HOME to a writable directory "
        f"(canonical {SITE_STUDIO_PODMAN_XDG_CONFIG_HOME_CANONICAL}); "
        "do not bind host ~/.config and do not use /tmp. "
        f"Tried: {tried}"
    )


SITE_STUDIO_INTERNAL_HOST = os.environ.get("USER_SITE_STUDIO_INTERNAL_HOST", "127.0.0.1").strip() or "127.0.0.1"
SITE_STUDIO_ADMIN_APP_URL = (
    os.environ.get("USER_SITE_STUDIO_ADMIN_APP_URL", "https://app.eliteew.ru").strip() or "https://app.eliteew.ru"
)
SITE_STUDIO_RUNTIME_UID = (os.environ.get("USER_SITE_STUDIO_RUNTIME_UID") or "").strip() or str(os.getuid())
SITE_STUDIO_RUNTIME_GID = (os.environ.get("USER_SITE_STUDIO_RUNTIME_GID") or "").strip() or str(os.getgid())
SITE_STUDIO_DB_SCHEMA_STRATEGY = (
    os.environ.get("USER_SITE_STUDIO_DB_SCHEMA_STRATEGY") or ""
).strip().lower() or "db-push"
if SITE_STUDIO_DB_SCHEMA_STRATEGY not in {"db-push", "migrate-deploy"}:
    logger.warning(
        "Unsupported USER_SITE_STUDIO_DB_SCHEMA_STRATEGY=%r, fallback to db-push",
        SITE_STUDIO_DB_SCHEMA_STRATEGY,
    )
    SITE_STUDIO_DB_SCHEMA_STRATEGY = "db-push"
# Образы шаблона olenti: если заданы оба, provision не копирует исходники и не гоняет npm build на инстансе.
SITE_STUDIO_OLENTI_API_IMAGE = os.environ.get("SITE_STUDIO_OLENTI_API_IMAGE", "").strip()
SITE_STUDIO_OLENTI_FRONTEND_IMAGE = os.environ.get("SITE_STUDIO_OLENTI_FRONTEND_IMAGE", "").strip()
SITE_STUDIO_RUNTIME_MODE = (os.environ.get("USER_SITE_STUDIO_RUNTIME_MODE") or "auto").strip().lower() or "auto"
if SITE_STUDIO_RUNTIME_MODE not in {"auto", "source", "images"}:
    logger.warning("Unsupported USER_SITE_STUDIO_RUNTIME_MODE=%r, fallback to auto", SITE_STUDIO_RUNTIME_MODE)
    SITE_STUDIO_RUNTIME_MODE = "auto"


def _resolve_site_studio_container_runtime() -> str:
    for env_var in SITE_STUDIO_RUNTIME_ENV_VARS:
        raw_value = (os.environ.get(env_var) or "").strip().lower()
        if not raw_value:
            continue
        if raw_value in SITE_STUDIO_SUPPORTED_RUNTIMES:
            return raw_value
        logger.warning(
            "Unsupported %s=%r, fallback to %s",
            env_var,
            raw_value,
            SITE_STUDIO_RUNTIME_DEFAULT,
        )
    return SITE_STUDIO_RUNTIME_DEFAULT


def _site_studio_fallback_cipher():
    from cryptography.fernet import Fernet

    key_source = (
        unified_settings.encryption_master_key or unified_settings.secret_key or unified_settings.jwt_secret_key or ""
    ).strip()
    if not key_source:
        return None
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(f"site-studio::{key_source}".encode()).digest())
    return Fernet(derived_key)


def encrypt_site_studio_secret(value: str) -> str:
    if not value:
        return value
    try:
        encrypted = get_encryption_service().encrypt(value)
        return encrypted or value
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Falling back to Site Studio secret cipher for encryption: %s",
            exc,
        )
    cipher = _site_studio_fallback_cipher()
    if cipher is None:
        return value
    return base64.b64encode(cipher.encrypt(value.encode("utf-8"))).decode("utf-8")


def decrypt_site_studio_secret(value: str) -> str:
    if not value:
        return value
    try:
        decrypted = get_encryption_service().decrypt(value)
        if decrypted and decrypted != value:
            return decrypted
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Falling back to Site Studio secret cipher for decryption: %s",
            exc,
        )
    cipher = _site_studio_fallback_cipher()
    if cipher is None:
        return value
    try:
        encrypted = base64.b64decode(value.encode("utf-8"))
        return cipher.decrypt(encrypted).decode("utf-8")
    except Exception:  # noqa: BLE001
        return value


def rewrite_site_studio_internal_url(url: str | None) -> str | None:
    if not url:
        return url
    parsed = urlsplit(url)
    hostname = parsed.hostname or ""
    if hostname not in {"127.0.0.1", "localhost"}:
        return url
    port = f":{parsed.port}" if parsed.port else ""
    netloc = f"{SITE_STUDIO_INTERNAL_HOST}{port}"
    return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))


def resolve_site_studio_public_hostname(instance: SiteStudioRuntimeInstance) -> str:
    configured_hostname = normalize_site_studio_request_host(instance.public_hostname)
    if not configured_hostname or "." not in configured_hostname:
        return build_site_studio_public_hostname(instance.site_slug)
    if is_site_studio_public_host(configured_hostname):
        return configured_hostname
    for legacy_base in _SITE_STUDIO_LEGACY_PUBLIC_BASE_DOMAINS:
        legacy_suffix = f".{legacy_base}"
        if configured_hostname == legacy_base or configured_hostname.endswith(legacy_suffix):
            logger.info(
                "Site Studio hostname migrated slug=%s from=%s to_base=%s",
                getattr(instance, "site_slug", None),
                configured_hostname,
                SITE_STUDIO_PUBLIC_BASE_DOMAIN,
            )
            return build_site_studio_public_hostname(instance.site_slug)
    # Custom / operator-bound hostname outside the product wildcard.
    return configured_hostname


def build_site_studio_public_urls(instance: SiteStudioRuntimeInstance) -> tuple[str, str, str]:
    public_hostname = resolve_site_studio_public_hostname(instance)
    public_url = build_site_studio_public_origin(public_hostname)
    api_base_url = build_site_studio_public_api_base_url(public_hostname)
    return public_hostname, public_url, api_base_url


def build_site_studio_internal_api_base_url(compose_project_name: str | None) -> str | None:
    normalized = (compose_project_name or "").strip()
    if not normalized:
        return None
    return f"http://{normalized}-api-1:{API_PORT}/api"


def build_site_studio_internal_public_url(compose_project_name: str | None) -> str | None:
    normalized = (compose_project_name or "").strip()
    if not normalized:
        return None
    return f"http://{normalized}-frontend-1:{FRONTEND_PREVIEW_PORT}"


def resolve_site_studio_runtime_health_urls(
    instance: SiteStudioRuntimeInstance,
) -> tuple[str | None, str | None, str | None]:
    """Return (api_probe_url, public_probe_url, skip_reason).

    Runtime readiness must not probe public HTTPS product hosts: prefer compose-internal
    HTTP URLs so edge/TLS is not conflated with local runtime readiness.
    """
    compose_project_name = (getattr(instance, "compose_project_name", None) or "").strip()
    api_probe = build_site_studio_internal_api_base_url(compose_project_name)
    public_probe = build_site_studio_internal_public_url(compose_project_name)
    if api_probe and public_probe:
        return api_probe, public_probe, None

    api_candidate = rewrite_site_studio_internal_url(getattr(instance, "api_base_url", None))
    public_candidate = rewrite_site_studio_internal_url(getattr(instance, "public_url", None))
    if not api_probe and api_candidate and api_candidate.startswith("http://"):
        api_probe = api_candidate
    if not public_probe and public_candidate and public_candidate.startswith("http://"):
        public_probe = public_candidate

    if api_probe or public_probe:
        return api_probe, public_probe, None

    return (
        None,
        None,
        "Runtime compose metadata missing; public HTTPS probe skipped "
        "(edge TLS for *-site.eliteew.ru is separate from local runtime readiness)",
    )


def resolve_site_studio_template_profile(template_key: str | None) -> dict[str, Any] | None:
    normalized_key = normalize_site_studio_template_key(template_key)
    profile = _load_site_studio_template_profile_manifest(normalized_key)
    if not isinstance(profile, dict):
        profile = SITE_STUDIO_TEMPLATE_RUNTIME_PROFILES.get(normalized_key)
    if not isinstance(profile, dict) and normalized_key in {DEFAULT_TEMPLATE_KEY, "allenti"}:
        base = _load_site_studio_template_profile_manifest(SITE_STUDIO_AURELIA_TEMPLATE_KEY)
        if not isinstance(base, dict):
            base = SITE_STUDIO_TEMPLATE_RUNTIME_PROFILES.get(SITE_STUDIO_AURELIA_TEMPLATE_KEY)
        if isinstance(base, dict):
            profile_id = "olenti-v1" if normalized_key == DEFAULT_TEMPLATE_KEY else "allenti-v1"
            profile = {**base, "profile_id": profile_id}
    if not isinstance(profile, dict):
        return None
    return profile


def _template_profile_manifest_candidates(template_key: str) -> tuple[Path, ...]:
    candidates = [
        Path("/app/site-templates/runtime-profiles") / f"{template_key}.json",
        Path(_CONTAINER_CHECKOUT) / "site-templates" / "runtime-profiles" / f"{template_key}.json",
    ]
    host_profiles = _checkout_path("site-templates", "runtime-profiles")
    if host_profiles:
        candidates.append(Path(host_profiles) / f"{template_key}.json")
    return tuple(candidates)


def _validate_template_profile_manifest(profile: dict[str, Any], *, template_key: str) -> dict[str, Any] | None:
    profile_id = str(profile.get("profile_id") or "").strip()
    blocks = profile.get("blocks")
    site_settings = profile.get("site_settings")
    if not profile_id:
        logger.warning("Site Studio template profile manifest %s has empty profile_id", template_key)
        return None
    if not isinstance(blocks, list):
        logger.warning("Site Studio template profile manifest %s has invalid blocks", template_key)
        return None
    if site_settings is not None and not isinstance(site_settings, dict):
        logger.warning("Site Studio template profile manifest %s has invalid site_settings", template_key)
        return None
    return profile


def _load_site_studio_template_profile_manifest(template_key: str) -> dict[str, Any] | None:
    for candidate in _template_profile_manifest_candidates(template_key):
        if not candidate.is_file():
            continue
        try:
            raw = json.loads(candidate.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to read Site Studio template profile manifest %s: %s", candidate, exc)
            return None
        if not isinstance(raw, dict):
            logger.warning("Site Studio template profile manifest %s is not an object", candidate)
            return None
        return _validate_template_profile_manifest(raw, template_key=template_key)
    return None


def resolve_site_studio_template_profile_id(template_key: str | None) -> str | None:
    profile = resolve_site_studio_template_profile(template_key)
    if not profile:
        return None
    profile_id = str(profile.get("profile_id") or "").strip()
    return profile_id or None


def read_site_studio_applied_profile_id(instance: SiteStudioRuntimeInstance) -> str | None:
    raw = instance.brief_json if isinstance(instance.brief_json, dict) else {}
    marker = raw.get(SITE_STUDIO_TEMPLATE_PROFILE_STATE_KEY)
    if isinstance(marker, str):
        normalized_marker = marker.strip()
        if normalized_marker:
            return normalized_marker
    if isinstance(marker, dict):
        profile_id = str(marker.get("profile_id") or "").strip()
        if profile_id:
            return profile_id
    return None


def with_site_studio_applied_profile(
    instance: SiteStudioRuntimeInstance,
    profile_id: str,
) -> dict[str, Any]:
    raw = instance.brief_json if isinstance(instance.brief_json, dict) else {}
    next_state = dict(raw)
    next_state[SITE_STUDIO_TEMPLATE_PROFILE_STATE_KEY] = {
        "profile_id": profile_id,
        "applied_at": utc_now_naive().isoformat(),
    }
    return next_state


class SiteStudioRuntimeError(RuntimeError):
    """Raised when local site runtime provisioning fails."""


@dataclass(slots=True)
class SiteStudioRuntimeLayout:
    runtime_dir: Path
    source_dir: Path
    server_source_dir: Path
    env_dir: Path
    compose_file_path: Path
    uploads_dir: Path
    api_node_modules_dir: Path
    frontend_node_modules_dir: Path
    postgres_data_dir: Path


def slugify_site_title(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return normalized[:48] or "site"


def build_site_slug(user_id: UUID, site_title: str) -> str:
    return f"{slugify_site_title(site_title)}-{str(user_id).replace('-', '')[:8]}"


def build_kirs_site_slug(marketing_project_id: UUID, site_title: str) -> str:
    """Unique slug for project-scoped Site Studio (KIRS); prefix avoids collision with personal Site Studio slugs."""
    short = str(marketing_project_id).replace("-", "")[:8]
    return f"kirs-{short}-{slugify_site_title(site_title)}"


def _write_text_file(path: Path, content: str, *, mode: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    if mode is not None:
        path.chmod(mode)


def _quote_compose_path(path: Path) -> str:
    return str(path).replace("\\", "/")


def _read_env_map(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    env_map: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env_map[key.strip()] = value.strip()
    return env_map


def _extract_db_password_from_database_url(url: str | None) -> str | None:
    if not url:
        return None
    match = re.search(r"postgresql://[^:]+:([^@]+)@", url)
    if not match:
        return None
    password = match.group(1).strip()
    return password or None


# Include private package helpers used by manager_* modules (marks them as exported for pyright).
__all__ = [
    "API_PORT",
    "DEFAULT_RUNTIME_BASE_DIR",
    "DEFAULT_TEMPLATE_KEY",
    "DEFAULT_TEMPLATE_ROOT",
    "FRONTEND_PREVIEW_PORT",
    "SITE_STUDIO_ADMIN_APP_URL",
    "SITE_STUDIO_AURELIA_TEMPLATE_KEY",
    "SITE_STUDIO_COMPOSE_RESTART_POLICY",
    "SITE_STUDIO_COMPOSE_TIMEOUT_SECONDS",
    "SITE_STUDIO_DB_SCHEMA_STRATEGY",
    "SITE_STUDIO_HEALTH_POLL_SECONDS",
    "SITE_STUDIO_HEALTH_TIMEOUT_SECONDS",
    "SITE_STUDIO_INTERNAL_HOST",
    "SITE_STUDIO_NODE_RUNTIME_IMAGE",
    "SITE_STUDIO_OLENTI_API_IMAGE",
    "SITE_STUDIO_OLENTI_FRONTEND_IMAGE",
    "SITE_STUDIO_POSTGRES_IMAGE",
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
    "_extract_db_password_from_database_url",
    "_quote_compose_path",
    "_read_env_map",
    "_resolve_site_studio_container_runtime",
    "_write_text_file",
    "build_kirs_site_slug",
    "build_site_slug",
    "build_site_studio_internal_api_base_url",
    "build_site_studio_internal_public_url",
    "build_site_studio_public_urls",
    "resolve_site_studio_runtime_health_urls",
    "decrypt_site_studio_secret",
    "encrypt_site_studio_secret",
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
