# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Compose/prepare mixins for SiteStudioRuntimeManager.
# Invariants:
# - Public imports remain via api.services.site_studio_runtime_service.
# Related:
# - api/services/site_studio_runtime/manager.py
# ---
from __future__ import annotations

import asyncio
import fcntl
import json
import logging
import os
import re
import secrets
import shutil
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from api.models.desktop import SiteStudioStatus
from api.services.site_studio_runtime.helpers import (
    API_PORT,
    DEFAULT_TEMPLATE_KEY,
    FRONTEND_PREVIEW_PORT,
    SITE_STUDIO_ADMIN_APP_URL,
    SITE_STUDIO_AURELIA_TEMPLATE_KEY,
    SITE_STUDIO_COMPOSE_RESTART_POLICY,
    SITE_STUDIO_COMPOSE_TIMEOUT_SECONDS,
    SITE_STUDIO_DB_SCHEMA_STRATEGY,
    SITE_STUDIO_NODE_RUNTIME_IMAGE,
    SITE_STUDIO_OLENTI_API_IMAGE,
    SITE_STUDIO_OLENTI_FRONTEND_IMAGE,
    SITE_STUDIO_PODMAN_COMPOSE_PROVIDER,
    SITE_STUDIO_POSTGRES_IMAGE,
    SITE_STUDIO_RUNTIME_GID,
    SITE_STUDIO_RUNTIME_MODE,
    SITE_STUDIO_RUNTIME_UID,
    SITE_STUDIO_SUPPORTED_RUNTIMES,
    SiteStudioRuntimeError,
    SiteStudioRuntimeInstance,
    SiteStudioRuntimeLayout,
    _extract_db_password_from_database_url,
    _quote_compose_path,
    _read_env_map,
    _write_text_file,
    build_site_studio_public_urls,
    decrypt_site_studio_secret,
    encrypt_site_studio_secret,
    ensure_podman_xdg_config_home,
    normalize_site_studio_template_key,
    resolve_site_studio_template_root,
)
from api.utils.site_studio_runtime_identity import (
    BINDING_FILE,
    inspect_owned_resources,
    ownership_labels,
    runtime_identity,
    validate_binding,
)

logger = logging.getLogger(__name__)


class SiteStudioRuntimeComposeMixin:
    """Compose/prepare helpers. Instance attrs are set on SiteStudioRuntimeManager.__init__."""

    container_runtime: str
    default_template_root: Path
    runtime_base_dir: Path
    _resolved_runtime_cli: str | None
    _resolved_runtime_env: dict[str, str] | None
    _admin_token_cache: dict[str, tuple[str, float]]

    def _runtime_cli_candidates(self) -> tuple[str, ...]:
        return (self.container_runtime,)

    def _autodetect_podman_docker_host(self) -> str | None:
        configured_socket = (os.environ.get("USER_SITE_STUDIO_PODMAN_SOCKET_PATH") or "").strip()
        candidate_paths: tuple[Path, ...] = tuple(
            path
            for path in (
                Path(configured_socket).expanduser() if configured_socket else None,
                Path(f"/run/user/{os.getuid()}/podman/podman.sock"),
            )
            if path is not None
        )
        for socket_path in candidate_paths:
            if socket_path.exists():
                return f"unix://{socket_path}"
        return None

    def _resolve_runtime_cli(self) -> tuple[str, dict[str, str] | None]:
        if self._resolved_runtime_cli is not None:
            return self._resolved_runtime_cli, self._resolved_runtime_env

        candidate = self.container_runtime
        if shutil.which(candidate) is None:
            supported = ", ".join(SITE_STUDIO_SUPPORTED_RUNTIMES)
            raise SiteStudioRuntimeError(
                (
                    "No container runtime CLI found for Site Studio. "
                    f"Requested runtime={self.container_runtime}; supported={supported}; "
                    f"missing binary: {candidate}"
                ),
            )

        runtime_env: dict[str, str] | None = None
        if candidate == "podman":
            runtime_env = os.environ.copy()
            xdg_home = ensure_podman_xdg_config_home(runtime_env)
            podman_host = (runtime_env.get("CONTAINER_HOST") or "").strip()
            if not podman_host:
                auto_host = self._autodetect_podman_docker_host()
                if auto_host:
                    runtime_env["CONTAINER_HOST"] = auto_host
                    podman_host = auto_host
            runtime_env.setdefault("PODMAN_COMPOSE_PROVIDER", SITE_STUDIO_PODMAN_COMPOSE_PROVIDER)
            logger.info(
                "Site Studio runtime=podman compose_provider=%s container_host=%s xdg_config_home=%s",
                runtime_env.get("PODMAN_COMPOSE_PROVIDER", ""),
                podman_host or "-",
                xdg_home,
            )

        self._resolved_runtime_cli = candidate
        self._resolved_runtime_env = runtime_env
        return candidate, runtime_env

    def _run_container_cli(self, *args: str) -> subprocess.CompletedProcess[str]:
        runtime_cli, runtime_env = self._resolve_runtime_cli()
        command = [runtime_cli, *args]
        timeout = SITE_STUDIO_COMPOSE_TIMEOUT_SECONDS if SITE_STUDIO_COMPOSE_TIMEOUT_SECONDS > 0 else None
        try:
            return subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
                env=runtime_env,
                timeout=timeout,
            )
        except FileNotFoundError as exc:
            raise SiteStudioRuntimeError(f"Container runtime CLI not found: {runtime_cli}") from exc
        except subprocess.TimeoutExpired as exc:
            raise SiteStudioRuntimeError(
                f"Container CLI timed out after {SITE_STUDIO_COMPOSE_TIMEOUT_SECONDS}s: {' '.join(command[:6])}"
            ) from exc

    def _podman_uses_remote_client(self) -> bool:
        """True when podman CLI talks to a socket/remote host (``podman unshare`` is unavailable)."""
        if self.container_runtime != "podman":
            return False
        _, runtime_env = self._resolve_runtime_cli()
        return bool(((runtime_env or {}).get("CONTAINER_HOST") or "").strip())

    def _remove_tree_with_runtime_helper(self, path: Path) -> subprocess.CompletedProcess[str]:
        parent = path.parent
        target_name = path.name.replace('"', '\\"')
        quoted_parent = _quote_compose_path(parent)
        shell_cmd = f'rm -rf -- "/runtime-parent/{target_name}"'

        if self.container_runtime == "podman":
            # Rootless shifted uids (postgres-data) are visible on the host namespace; remote podman
            # cannot run ``podman unshare``, so prefer host-userns cleanup before generic helper.
            host_result = self._run_container_cli(
                "run",
                "--rm",
                "--userns=host",
                "-v",
                f"{quoted_parent}:/runtime-parent",
                "docker.io/alpine:3.20",
                "sh",
                "-lc",
                shell_cmd,
            )
            if host_result.returncode == 0 and not path.exists():
                return host_result

        return self._run_container_cli(
            "run",
            "--rm",
            "-v",
            f"{quoted_parent}:/runtime-parent",
            SITE_STUDIO_NODE_RUNTIME_IMAGE,
            "sh",
            "-lc",
            shell_cmd,
        )

    def _template_root_for(self, template_key: str | None) -> Path:
        normalized_key = normalize_site_studio_template_key(template_key)
        if normalized_key == DEFAULT_TEMPLATE_KEY:
            return self.default_template_root
        return resolve_site_studio_template_root(normalized_key)

    @asynccontextmanager
    async def runtime_operation_lock(self, instance: SiteStudioRuntimeInstance):
        layout = self._layout(instance)
        lock_path = self.runtime_base_dir / ".locks" / f"{layout.runtime_dir.name}.lock"
        await asyncio.to_thread(lock_path.parent.mkdir, parents=True, exist_ok=True)
        lock_file = await asyncio.to_thread(lock_path.open, "w", encoding="utf-8")
        try:
            await asyncio.to_thread(fcntl.flock, lock_file.fileno(), fcntl.LOCK_EX)
            yield
        finally:
            try:
                await asyncio.to_thread(fcntl.flock, lock_file.fileno(), fcntl.LOCK_UN)
            finally:
                await asyncio.to_thread(lock_file.close)

    def _admin_token_cache_key(self, instance: SiteStudioRuntimeInstance) -> str:
        return str(instance.id or instance.site_slug)

    def invalidate_admin_token(self, instance: SiteStudioRuntimeInstance) -> None:
        self._admin_token_cache.pop(self._admin_token_cache_key(instance), None)

    def _layout(self, instance: SiteStudioRuntimeInstance) -> SiteStudioRuntimeLayout:
        runtime_dir = self.runtime_base_dir / self._compose_project_name(instance)
        for attr, expected in (
            ("runtime_dir", runtime_dir),
            ("compose_file_path", runtime_dir / "compose" / "docker-compose.yml"),
        ):
            saved = getattr(instance, attr, None)
            if saved and Path(saved).absolute() != expected.absolute():
                raise SiteStudioRuntimeError("Legacy or foreign runtime path requires operator migration")
        if runtime_dir.is_symlink():
            raise SiteStudioRuntimeError("Runtime directory is a symlink")
        source_dir = runtime_dir / "source"
        return SiteStudioRuntimeLayout(
            runtime_dir=runtime_dir,
            source_dir=source_dir,
            server_source_dir=source_dir / "server",
            env_dir=runtime_dir / "env",
            compose_file_path=runtime_dir / "compose" / "docker-compose.yml",
            uploads_dir=runtime_dir / "uploads",
            api_node_modules_dir=runtime_dir / "node_modules" / "api",
            frontend_node_modules_dir=runtime_dir / "node_modules" / "frontend",
            postgres_data_dir=runtime_dir / "postgres-data",
        )

    def _ensure_runtime_dirs(
        self,
        layout: SiteStudioRuntimeLayout,
        *,
        use_prebuilt_template_images: bool = False,
    ) -> None:
        paths: list[Path] = [
            layout.runtime_dir,
            layout.env_dir,
            layout.compose_file_path.parent,
            layout.uploads_dir,
            layout.postgres_data_dir,
        ]
        if not use_prebuilt_template_images:
            paths.extend(
                (
                    layout.api_node_modules_dir,
                    layout.frontend_node_modules_dir,
                )
            )
        for path in paths:
            path.mkdir(parents=True, exist_ok=True)

    def _resolve_template_images(self, template_key: str | None) -> tuple[str, str] | None:
        """Если заданы оба образа для шаблона — рантайм без копии исходников и без сборки на инстансе."""
        normalized = normalize_site_studio_template_key(template_key)
        if normalized not in {DEFAULT_TEMPLATE_KEY, "allenti", SITE_STUDIO_AURELIA_TEMPLATE_KEY}:
            return None
        if SITE_STUDIO_RUNTIME_MODE == "source":
            return None
        api_img = SITE_STUDIO_OLENTI_API_IMAGE
        fe_img = SITE_STUDIO_OLENTI_FRONTEND_IMAGE
        if SITE_STUDIO_RUNTIME_MODE == "images" and (not api_img or not fe_img):
            raise SiteStudioRuntimeError(
                "USER_SITE_STUDIO_RUNTIME_MODE=images requires SITE_STUDIO_OLENTI_API_IMAGE "
                "and SITE_STUDIO_OLENTI_FRONTEND_IMAGE"
            )
        if not api_img or not fe_img:
            return None
        return (api_img, fe_img)

    def validate_runtime_preflight(self, template_key: str | None) -> None:
        self._resolve_template_images(template_key)

    def _source_layout_is_valid(self, layout: SiteStudioRuntimeLayout) -> bool:
        required_paths = (
            layout.source_dir / "package.json",
            layout.source_dir / "package-lock.json",
            layout.source_dir / "src",
            layout.server_source_dir / "package.json",
            layout.server_source_dir / "package-lock.json",
            layout.server_source_dir / "src",
        )
        return all(path.exists() for path in required_paths)

    def _remove_tree(self, path: Path) -> None:
        if not path.exists():
            return
        try:
            shutil.rmtree(path)
            return
        except FileNotFoundError:
            return
        except PermissionError as exc:
            logger.warning(
                "Permission denied removing Site Studio path %s, using runtime helper: %s",
                path,
                exc,
            )

        if self.container_runtime == "podman" and not self._podman_uses_remote_client():
            # Rootless podman stores some bind-mounted files with shifted uid/gid (userns private).
            # Local podman: `podman unshare` can remove paths where host uid has no direct permissions.
            unshare_result = self._run_container_cli(
                "unshare",
                "rm",
                "-rf",
                "--",
                str(path),
            )
            if unshare_result.returncode == 0:
                if not path.exists():
                    return
            else:
                logger.warning(
                    "podman unshare cleanup failed for %s: %s",
                    path,
                    unshare_result.stderr.strip() or unshare_result.stdout.strip(),
                )

        result = self._remove_tree_with_runtime_helper(path)
        if result.returncode != 0:
            raise SiteStudioRuntimeError(result.stderr.strip() or result.stdout.strip())
        if path.exists():
            raise SiteStudioRuntimeError(f"Failed to remove runtime path: {path}")

    def _copy_template_source(
        self,
        layout: SiteStudioRuntimeLayout,
        *,
        template_key: str,
        force_refresh_source: bool = False,
    ) -> None:
        template_root = self._template_root_for(template_key)
        if not template_root.exists():
            raise SiteStudioRuntimeError(f"Template root does not exist: {template_root}")

        if force_refresh_source and layout.source_dir.exists():
            self._remove_tree(layout.source_dir)

        if layout.source_dir.exists():
            if self._source_layout_is_valid(layout):
                return
            logger.warning(
                "Site Studio source dir is incomplete, refreshing template copy: %s",
                layout.source_dir,
            )
            self._remove_tree(layout.source_dir)

        ignore = shutil.ignore_patterns(
            ".git",
            ".cursor",
            ".vscode",
            "node_modules",
            "dist",
            "dist-build",
            "coverage",
            ".DS_Store",
            ".env",
            ".env.example",
            ".cursorrules",
            "Olenti.code-workspace",
            "docs",
            "server/node_modules",
            "server/dist",
            "server/uploads",
        )
        shutil.copytree(
            template_root,
            layout.source_dir,
            ignore=ignore,
            dirs_exist_ok=False,
        )

    def _resolve_ports(self, instance: SiteStudioRuntimeInstance) -> dict[str, int]:
        return {
            "frontend": FRONTEND_PREVIEW_PORT,
            "api": API_PORT,
            "postgres": 5432,
        }

    def _resolve_admin_credentials(
        self,
        instance: SiteStudioRuntimeInstance,
    ) -> tuple[str, str]:
        email = (instance.admin_email or "").strip() or f"admin+{instance.site_slug}@site-studio.local"
        encrypted_password = (instance.admin_password_encrypted or "").strip()

        if encrypted_password:
            decrypted = decrypt_site_studio_secret(encrypted_password) or ""
            if decrypted.strip():
                return email, decrypted

        return email, secrets.token_urlsafe(24)

    def _resolve_db_password(self, layout: SiteStudioRuntimeLayout) -> str:
        server_env_path = layout.env_dir / "server.env"
        env_map = _read_env_map(server_env_path)

        existing_password = env_map.get("SITE_STUDIO_DB_PASSWORD")
        if existing_password:
            return existing_password

        password_from_url = _extract_db_password_from_database_url(env_map.get("DATABASE_URL"))
        if password_from_url:
            return password_from_url

        return secrets.token_urlsafe(18)

    def _compose_project_name(self, instance: SiteStudioRuntimeInstance) -> str:
        try:
            project = runtime_identity(instance)["project"]
        except (ValueError, AttributeError) as exc:
            raise SiteStudioRuntimeError("Runtime requires immutable instance and tenant UUIDs") from exc
        saved = getattr(instance, "compose_project_name", None)
        if saved and saved != project:
            raise SiteStudioRuntimeError("Legacy or foreign Compose project requires operator migration")
        return project

    def _owned_runtime_resources(self, instance: SiteStudioRuntimeInstance, *, create: bool = False):
        layout = self._layout(instance)
        identity = runtime_identity(instance)
        try:
            bound = validate_binding(layout.runtime_dir, identity)
            if not bound:
                if any(
                    getattr(instance, attr, None)
                    for attr in ("runtime_dir", "compose_file_path", "compose_project_name")
                ):
                    raise ValueError("Persisted runtime has no ownership binding")
                if layout.runtime_dir.exists() and any(layout.runtime_dir.iterdir()):
                    raise ValueError("Unbound runtime data requires operator review")
                if not create:
                    return [], None
            resources = inspect_owned_resources(self._run_runtime, identity)
            if not bound:
                if resources != ([], None):
                    raise ValueError("Cannot adopt existing resources without persisted binding")
                layout.runtime_dir.mkdir(parents=True, exist_ok=True)
                with (layout.runtime_dir / BINDING_FILE).open("x") as marker:
                    json.dump(identity, marker, sort_keys=True)
            return resources
        except (ValueError, OSError) as exc:
            raise SiteStudioRuntimeError(str(exc)) from exc

    def _remove_owned_runtime_resources(self, instance: SiteStudioRuntimeInstance) -> None:
        container_ids, network_id = self._owned_runtime_resources(instance)
        if container_ids:
            result = self._run_runtime("rm", "-f", *container_ids)
            if result.returncode:
                raise SiteStudioRuntimeError("Failed to remove owned runtime containers")
        if network_id:
            result = self._run_runtime("network", "rm", network_id)
            if result.returncode:
                raise SiteStudioRuntimeError("Failed to remove owned runtime network")

    def _db_name(self, instance: SiteStudioRuntimeInstance) -> str:
        inst: Any = instance
        base = re.sub(r"[^a-z0-9_]+", "_", instance.site_slug.lower()).strip("_") or "site"
        return (inst.db_name or f"site_{base}")[:63]

    def _server_env(
        self,
        instance: SiteStudioRuntimeInstance,
        *,
        db_password: str,
        admin_email: str,
        admin_password: str,
        public_url: str,
    ) -> str:
        allowed_origins = [public_url]
        if SITE_STUDIO_ADMIN_APP_URL and SITE_STUDIO_ADMIN_APP_URL not in allowed_origins:
            allowed_origins.append(SITE_STUDIO_ADMIN_APP_URL)
        env_map = {
            "NODE_ENV": "production",
            "PORT": str(API_PORT),
            "JWT_SECRET": secrets.token_urlsafe(48),
            "DATABASE_URL": (f"postgresql://site_user:{db_password}@db:5432/{self._db_name(instance)}"),
            "SITE_STUDIO_DB_PASSWORD": db_password,
            "SITE_STUDIO_DB_SCHEMA_STRATEGY": SITE_STUDIO_DB_SCHEMA_STRATEGY,
            "ADMIN_EMAIL": admin_email,
            "ADMIN_PASSWORD": admin_password,
            "PUBLIC_SITE_URL": public_url,
            "ADMIN_APP_URL": SITE_STUDIO_ADMIN_APP_URL,
            "FRONTEND_URL": public_url,
            "CORS_ALLOWED_ORIGINS": ",".join(allowed_origins),
            "UPLOADS_DIR": "/app/uploads",
        }
        return "\n".join(f"{key}={value}" for key, value in env_map.items()) + "\n"

    def _frontend_env(self) -> str:
        env_map = {
            "VITE_API_URL": "/api",
        }
        return "\n".join(f"{key}={value}" for key, value in env_map.items()) + "\n"

    def _compose_yaml(
        self,
        layout: SiteStudioRuntimeLayout,
        instance: SiteStudioRuntimeInstance,
        *,
        db_password: str,
        template_images: tuple[str, str] | None = None,
    ) -> str:
        uploads_dir = _quote_compose_path(layout.uploads_dir)
        env_dir = _quote_compose_path(layout.env_dir)
        postgres_data_dir = _quote_compose_path(layout.postgres_data_dir)
        db_name = self._db_name(instance)
        labels = ownership_labels(runtime_identity(instance))
        service_labels = "    labels:\n" + "".join(f'      {key}: "{value}"\n' for key, value in labels.items())
        network_labels = "    labels:\n" + "".join(f'      {key}: "{value}"\n' for key, value in labels.items())

        db_only = f"""services:
  db:
{service_labels}    image: {SITE_STUDIO_POSTGRES_IMAGE}
    restart: {SITE_STUDIO_COMPOSE_RESTART_POLICY}
    environment:
      POSTGRES_DB: {db_name}
      POSTGRES_USER: site_user
      POSTGRES_PASSWORD: {db_password}
    volumes:
      - "{postgres_data_dir}:/var/lib/postgresql/data"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U site_user -d {db_name}"]
      interval: 5s
      timeout: 5s
      retries: 20
"""

        networks = f"""networks:
  # podman-compose (1.5.x) requires explicit declaration when services reference `default`.
  default:
{network_labels}  eliteew-shared:
    external: true
    name: ew_net_6211
"""
        # podman-compose (1.5.x) keeps private userns and ignores keep-id hints here.
        # Running Node containers as 0:0 under rootless Podman maps to host uid and keeps
        # runtime bind mounts writable (node_modules, generated bundles, prisma client).
        runtime_node_user = (
            "0:0" if self.container_runtime == "podman" else f"{SITE_STUDIO_RUNTIME_UID}:{SITE_STUDIO_RUNTIME_GID}"
        )
        compose_project_name = self._compose_project_name(instance)
        api_shared_alias = f"{compose_project_name}-api-1"
        frontend_shared_alias = f"{compose_project_name}-frontend-1"

        if template_images:
            api_image, fe_image = template_images
            api_fe = f"""
  api:
{service_labels}    image: {api_image}
    restart: {SITE_STUDIO_COMPOSE_RESTART_POLICY}
    user: "{runtime_node_user}"
    working_dir: /app
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - "{env_dir}/server.env"
    volumes:
      - "{uploads_dir}:/app/uploads"
    networks:
      default: {{}}
      eliteew-shared:
        aliases:
          - "{api_shared_alias}"

  frontend:
{service_labels}    image: {fe_image}
    restart: {SITE_STUDIO_COMPOSE_RESTART_POLICY}
    user: "{runtime_node_user}"
    working_dir: /app
    depends_on:
      - api
    env_file:
      - "{env_dir}/frontend.env"
    environment:
      HOST: "0.0.0.0"
      PORT: "{FRONTEND_PREVIEW_PORT}"
    volumes:
      - "{uploads_dir}:/app/shared-uploads"
    networks:
      default: {{}}
      eliteew-shared:
        aliases:
          - "{frontend_shared_alias}"
"""
            return db_only + api_fe + networks

        source_dir = _quote_compose_path(layout.source_dir)
        server_source_dir = _quote_compose_path(layout.server_source_dir)
        api_node_modules_dir = _quote_compose_path(layout.api_node_modules_dir)
        frontend_node_modules_dir = _quote_compose_path(layout.frontend_node_modules_dir)

        api_fe = f"""
  api:
{service_labels}    image: {SITE_STUDIO_NODE_RUNTIME_IMAGE}
    restart: {SITE_STUDIO_COMPOSE_RESTART_POLICY}
    user: "{runtime_node_user}"
    working_dir: /app
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - "{env_dir}/server.env"
    volumes:
      - "{server_source_dir}:/app"
      - "{uploads_dir}:/app/uploads"
      - "{api_node_modules_dir}:/app/node_modules"
    command:
      - /bin/sh
      - -lc
      - |
        set -e
        [ -f /app/node_modules/.package-lock.json ] || npm ci --include=dev
        npm run tsc:build:api
        npm run prisma:push
        if [ ! -f /app/uploads/.seeded ]; then
          npm run tsx:seed:template
          touch /app/uploads/.seeded
        fi
        npm run node:start:api
    networks:
      default: {{}}
      eliteew-shared:
        aliases:
          - "{api_shared_alias}"

  frontend:
{service_labels}    image: {SITE_STUDIO_NODE_RUNTIME_IMAGE}
    restart: {SITE_STUDIO_COMPOSE_RESTART_POLICY}
    user: "{runtime_node_user}"
    working_dir: /app
    depends_on:
      - api
    env_file:
      - "{env_dir}/frontend.env"
    volumes:
      - "{source_dir}:/app"
      - "{frontend_node_modules_dir}:/app/node_modules"
      - "{uploads_dir}:/app/shared-uploads"
    command:
      - /bin/sh
      - -lc
      - |
        set -e
        [ -f /app/node_modules/.package-lock.json ] || npm ci --include=dev
        npm run bundle:storefront
        HOST=0.0.0.0 PORT={FRONTEND_PREVIEW_PORT} npm run vite:serve:public
    networks:
      default: {{}}
      eliteew-shared:
        aliases:
          - "{frontend_shared_alias}"
"""
        return db_only + api_fe + networks

    def _prepare_runtime_files(
        self,
        instance: SiteStudioRuntimeInstance,
        *,
        force_refresh_source: bool = False,
    ) -> tuple[dict[str, Any], str]:
        self._owned_runtime_resources(instance, create=True)
        layout = self._layout(instance)
        template_images = self._resolve_template_images(instance.template_key)
        use_images = template_images is not None

        if use_images:
            if force_refresh_source:
                logger.info(
                    "Site Studio provision uses prebuilt images; skipping source/node_modules refresh for %s",
                    instance.site_slug,
                )
        else:
            if force_refresh_source:
                self._remove_tree(layout.api_node_modules_dir)
                self._remove_tree(layout.frontend_node_modules_dir)
        self._ensure_runtime_dirs(layout, use_prebuilt_template_images=use_images)
        if not use_images:
            self._copy_template_source(
                layout,
                template_key=instance.template_key,
                force_refresh_source=force_refresh_source,
            )

        ports = self._resolve_ports(instance)
        admin_email, admin_password = self._resolve_admin_credentials(instance)
        db_password = self._resolve_db_password(layout)
        public_hostname, public_url, api_base_url = build_site_studio_public_urls(instance)

        _write_text_file(
            layout.env_dir / "server.env",
            self._server_env(
                instance,
                db_password=db_password,
                admin_email=admin_email,
                admin_password=admin_password,
                public_url=public_url,
            ),
            mode=0o600,
        )
        _write_text_file(
            layout.env_dir / "frontend.env",
            self._frontend_env(),
            mode=0o600,
        )
        _write_text_file(
            layout.compose_file_path,
            self._compose_yaml(
                layout,
                instance,
                db_password=db_password,
                template_images=template_images,
            ),
        )

        metadata: dict[str, Any] = {
            "status": SiteStudioStatus.PROVISIONING.value,
            "public_hostname": public_hostname,
            "public_url": public_url,
            "api_base_url": api_base_url,
            "admin_email": admin_email,
            "admin_password_encrypted": encrypt_site_studio_secret(admin_password),
            "runtime_dir": str(layout.runtime_dir),
            "source_dir": str(layout.source_dir),
            "env_dir": str(layout.env_dir),
            "compose_file_path": str(layout.compose_file_path),
            "compose_project_name": self._compose_project_name(instance),
            "ports_json": ports,
            "db_name": self._db_name(instance),
            "runtime_mode": "prebuilt" if use_images else "legacy",
            "container_runtime": self.container_runtime,
            "template_api_image": template_images[0] if template_images else None,
            "template_frontend_image": template_images[1] if template_images else None,
            "db_schema_strategy": SITE_STUDIO_DB_SCHEMA_STRATEGY,
            "last_error": None,
        }
        return metadata, admin_password

    def _run_compose(
        self,
        compose_file_path: str,
        project_name: str,
        *args: str,
    ) -> subprocess.CompletedProcess[str]:
        return self._run_container_cli(
            "compose",
            "-f",
            compose_file_path,
            "-p",
            project_name,
            *args,
        )

    def _run_runtime(self, *args: str) -> subprocess.CompletedProcess[str]:
        return self._run_container_cli(*args)

    def _list_compose_container_ids(self, project_name: str) -> list[str]:
        if not project_name:
            return []
        compose_label_keys = (
            "com.docker.compose.project",
            "io.podman.compose.project",
        )
        container_ids: set[str] = set()
        errors: list[str] = []
        for label_key in compose_label_keys:
            result = self._run_runtime(
                "ps",
                "-aq",
                "--filter",
                f"label={label_key}={project_name}",
            )
            if result.returncode != 0:
                errors.append(result.stderr.strip() or result.stdout.strip())
                continue
            for line in result.stdout.splitlines():
                normalized = line.strip()
                if normalized:
                    container_ids.add(normalized)
        if not container_ids and errors and len(errors) == len(compose_label_keys):
            raise SiteStudioRuntimeError("; ".join(errors))
        return sorted(container_ids)

    def _remove_compose_network(self, project_name: str) -> None:
        if not project_name:
            return
        result = self._run_runtime("network", "rm", f"{project_name}_default")
        if result.returncode == 0:
            return
        message = (result.stderr.strip() or result.stdout.strip()).lower()
        if "no such network" in message or "not found" in message:
            return
        raise SiteStudioRuntimeError(result.stderr.strip() or result.stdout.strip())
