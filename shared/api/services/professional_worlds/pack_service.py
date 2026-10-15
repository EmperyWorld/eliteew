# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Vertical pack v2 validation, diffing, import jobs, releases, rollouts and runtime epoch bumps for Professional Worlds.
# Invariants:
# - Dry-run import jobs never mutate configuration tables; confirm applies all manifest writes in one transaction.
# - Published releases store a manifest snapshot for audit; live DB remains the runtime source of truth.
# - Pack manifest `schema_version`, when present, must be one of a small supported set (see `_SUPPORTED_PACK_SCHEMA_VERSIONS`).
# Related:
# - api/services/professional_worlds/admin_service.py
# - api/services/professional_worlds/service.py
# ---

from __future__ import annotations

import hashlib
import json
import random
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.admin_service import ProfessionalWorldsAdminService

_SUPPORTED_PACK_SCHEMA_VERSIONS = frozenset({"1", "1.0"})


def _json(value: Any) -> str:
    """Serialize JSON payloads for SQL text queries."""
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Any | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _rows(rows: list[Any]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


class ProfessionalWorldsPackService:
    """Pack import, release and rollout orchestration."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _bump_runtime_epoch_no_commit(self, vertical_slug: str) -> int:
        """Increment runtime epoch inside the caller's transaction."""
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_vertical_runtime_epoch (vertical_slug, epoch, updated_at)
                VALUES (:slug, 1, now())
                ON CONFLICT (vertical_slug)
                DO UPDATE SET epoch = professional_vertical_runtime_epoch.epoch + 1,
                              updated_at = now()
                RETURNING epoch
                """
            ),
            {"slug": vertical_slug},
        )
        row = result.mappings().one()
        return int(row["epoch"])

    async def bump_runtime_epoch(self, vertical_slug: str) -> int:
        """Increment runtime epoch for cache busting."""
        epoch = await self._bump_runtime_epoch_no_commit(vertical_slug)
        await self.db.commit()
        return epoch

    def validate_manifest(self, pack: dict[str, Any], *, vertical_slug: str | None = None) -> list[str]:
        """Structural validation for a vertical pack manifest."""
        messages: list[str] = []
        if not isinstance(pack, dict):
            return ["pack root must be an object"]
        vert = pack.get("vertical")
        if not isinstance(vert, dict):
            messages.append("missing or invalid vertical object")
        else:
            slug = vert.get("slug")
            if not slug or not isinstance(slug, str):
                messages.append("vertical.slug is required")
            elif vertical_slug and slug.strip() != vertical_slug.strip():
                messages.append(f"vertical.slug {slug!r} does not match route {vertical_slug!r}")
        raw_sv = pack.get("schema_version")
        if raw_sv is not None:
            if not isinstance(raw_sv, str):
                messages.append("schema_version must be a string when present")
            elif raw_sv.strip() not in _SUPPORTED_PACK_SCHEMA_VERSIONS:
                messages.append(
                    f"unsupported schema_version {raw_sv!r}; supported: {sorted(_SUPPORTED_PACK_SCHEMA_VERSIONS)!r}"
                )
        if "module_catalog" in pack and not isinstance(pack["module_catalog"], list):
            messages.append("module_catalog must be an array when present")
        for key in ("modules", "schemas", "ai_actions", "photo_presets", "integrations"):
            if key in pack and not isinstance(pack[key], list):
                messages.append(f"{key} must be an array when present")
        # Duplicate keys inside arrays
        seen_actions: set[str] = set()
        for item in pack.get("ai_actions") or []:
            if not isinstance(item, dict):
                continue
            ak = item.get("action_key")
            if isinstance(ak, str):
                if ak in seen_actions:
                    messages.append(f"duplicate ai_actions.action_key {ak!r}")
                seen_actions.add(ak)
        seen_presets: set[str] = set()
        for item in pack.get("photo_presets") or []:
            if not isinstance(item, dict):
                continue
            pk = item.get("preset_key")
            if isinstance(pk, str):
                if pk in seen_presets:
                    messages.append(f"duplicate photo_presets.preset_key {pk!r}")
                seen_presets.add(pk)
        return messages

    def semantic_validation(self, pack: dict[str, Any]) -> list[str]:
        """Warn-only validation: catalog consistency and non-empty binding keys (offline, no live UGS catalog)."""
        msgs: list[str] = []
        modules_assign = pack.get("modules") or []
        keys_in_vertical: set[str] = set()
        for row in modules_assign:
            if isinstance(row, dict) and row.get("module_key"):
                keys_in_vertical.add(str(row["module_key"]))
        catalog = pack.get("module_catalog") or []
        catalog_keys = {str(m.get("module_key")) for m in catalog if isinstance(m, dict) and m.get("module_key")}
        for mk in keys_in_vertical:
            if catalog_keys and mk not in catalog_keys:
                msgs.append(f"vertical module {mk!r} missing from module_catalog — import may still rely on DB rows")
        # depends_on on catalog entries
        for m in catalog:
            if not isinstance(m, dict):
                continue
            dep = m.get("depends_on") or m.get("dependsOn")
            if isinstance(dep, list):
                mk = m.get("module_key")
                for d in dep:
                    if d not in catalog_keys and catalog_keys:
                        msgs.append(
                            f"module {mk!r} depends_on {d!r} not found in module_catalog (may exist only in DB)"
                        )
        for item in pack.get("ai_actions") or []:
            if not isinstance(item, dict):
                continue
            ak = item.get("action_key")
            ugs = item.get("ugs_type_key")
            if ugs is not None and (not isinstance(ugs, str) or not str(ugs).strip()):
                msgs.append(f"ai_actions {ak!r}: ugs_type_key must be a non-empty string when set")
        for item in pack.get("photo_presets") or []:
            if not isinstance(item, dict):
                continue
            pk = item.get("preset_key")
            for label, key in (
                ("ugs_type_key", "ugs_type_key"),
                ("action_type", "action_type"),
            ):
                val = item.get(key)
                if val is not None and (not isinstance(val, str) or not str(val).strip()):
                    msgs.append(f"photo_presets {pk!r}: {label} must be a non-empty string when set")
        for item in pack.get("integrations") or []:
            if not isinstance(item, dict):
                continue
            ik = item.get("integration_key")
            if ik is not None and (not isinstance(ik, str) or not str(ik).strip()):
                msgs.append("integrations entry: integration_key must be a non-empty string when set")
        return msgs

    def diff_against_live(self, live: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
        """Lightweight diff summary between exported live pack and candidate manifest."""
        sections: dict[str, Any] = {}
        for key in ("module_catalog", "modules", "schemas", "ai_actions", "photo_presets", "integrations"):
            left = live.get(key) if isinstance(live.get(key), list) else []
            right = incoming.get(key) if isinstance(incoming.get(key), list) else []
            sections[key] = {"live_count": len(left), "incoming_count": len(right)}
        risks = []
        if sections["schemas"]["incoming_count"] != sections["schemas"]["live_count"]:
            risks.append("schema_change")
        if sections["ai_actions"]["incoming_count"] != sections["ai_actions"]["live_count"]:
            risks.append("ai_action_catalog_change")
        return {"sections": sections, "risks": risks}

    async def resolve_active_release_id(self, user_id: UUID, vertical_slug: str) -> UUID | None:
        """Pick rollout release for user (published + rollout rules)."""
        result = await self.db.execute(
            text(
                """
                SELECT r.id AS rollout_id, r.mode, r.percentage, r.release_id
                FROM professional_vertical_rollouts r
                JOIN professional_vertical_pack_releases rel ON rel.id = r.release_id
                WHERE r.vertical_slug = :v
                  AND rel.vertical_slug = :v
                  AND rel.status = 'published'
                  AND r.is_paused = false
                ORDER BY rel.published_at DESC NULLS LAST, r.updated_at DESC
                LIMIT 5
                """
            ),
            {"v": vertical_slug},
        )
        rows = _rows(list(result.mappings().all()))
        for row in rows:
            mode = (row.get("mode") or "all").lower()
            release_id = row.get("release_id")
            if mode in ("disabled", "off"):
                continue
            if mode == "all":
                return UUID(str(release_id))
            if mode == "allowlist":
                allow = await self.db.execute(
                    text(
                        """
                        SELECT 1 FROM professional_vertical_rollout_allowlist
                        WHERE rollout_id = :rid AND user_id = :uid LIMIT 1
                        """
                    ),
                    {"rid": row["rollout_id"], "uid": user_id},
                )
                if allow.first():
                    return UUID(str(release_id))
            if mode == "percentage":
                pct = int(row.get("percentage") or 0)
                bucket = random.Random(f"{user_id}:{vertical_slug}").randint(0, 99)
                if bucket < pct:
                    return UUID(str(release_id))
        return None

    async def list_pack_versions(self, vertical_slug: str) -> list[dict[str, Any]]:
        result = await self.db.execute(
            text(
                """
                SELECT id, vertical_slug, version_label, changelog_md, created_by_admin_id, created_at
                FROM professional_vertical_pack_versions
                WHERE vertical_slug = :v
                ORDER BY created_at DESC
                """
            ),
            {"v": vertical_slug},
        )
        return _rows(list(result.mappings().all()))

    async def create_pack_version(
        self,
        admin_user_id: UUID | None,
        vertical_slug: str,
        version_label: str,
        manifest: dict[str, Any],
        changelog_md: str | None = None,
    ) -> dict[str, Any]:
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_vertical_pack_versions (
                    vertical_slug, version_label, changelog_md, manifest, created_by_admin_id
                )
                VALUES (:v, :label, :changelog, CAST(:manifest AS jsonb), :aid)
                RETURNING id, vertical_slug, version_label, changelog_md, created_by_admin_id, created_at
                """
            ),
            {
                "v": vertical_slug,
                "label": version_label,
                "changelog": changelog_md,
                "manifest": _json(manifest),
                "aid": admin_user_id,
            },
        )
        row = _row(result.mappings().one())
        await self.db.commit()
        return row or {}

    async def create_import_job(
        self,
        admin_user_id: UUID | None,
        vertical_slug: str,
        manifest: dict[str, Any],
        *,
        dry_run: bool,
        admin: ProfessionalWorldsAdminService,
    ) -> dict[str, Any]:
        messages = self.validate_manifest(manifest, vertical_slug=vertical_slug)
        messages.extend(self.semantic_validation(manifest))
        live = await admin.export_vertical_pack(vertical_slug)
        diff = self.diff_against_live(live, manifest)
        status = "ready" if not messages else "invalid"
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_pack_import_jobs (
                    admin_user_id, vertical_slug, status, dry_run, manifest, validation_messages, diff_summary
                )
                VALUES (
                    :aid, :v, :status, :dry_run, CAST(:manifest AS jsonb),
                    CAST(:val AS jsonb), CAST(:diff AS jsonb)
                )
                RETURNING id, status, dry_run, created_at
                """
            ),
            {
                "aid": admin_user_id,
                "v": vertical_slug,
                "status": status,
                "dry_run": dry_run,
                "manifest": _json(manifest),
                "val": _json(messages),
                "diff": _json(diff),
            },
        )
        row = _row(result.mappings().one())
        await self.db.commit()
        return {"job": row, "messages": messages, "diff": diff, "valid": not messages}

    async def get_import_job(self, job_id: UUID) -> dict[str, Any] | None:
        result = await self.db.execute(
            text(
                """
                SELECT id, admin_user_id, vertical_slug, status, dry_run, manifest, validation_messages,
                       diff_summary, error, created_at, updated_at
                FROM professional_pack_import_jobs
                WHERE id = :id
                """
            ),
            {"id": job_id},
        )
        return _row(result.mappings().one_or_none())

    async def _fetch_one(self, sql: str, params: dict[str, Any]) -> dict[str, Any] | None:
        """Fetch one row inside the current transaction."""
        result = await self.db.execute(text(sql), params)
        return _row(result.mappings().one_or_none())

    async def confirm_import_job(
        self,
        job_id: UUID,
        admin_user_id: UUID | None,
        admin: ProfessionalWorldsAdminService,
    ) -> dict[str, Any]:
        job = await self.get_import_job(job_id)
        if job is None:
            return {"ok": False, "error": "job not found"}
        msgs = job.get("validation_messages") or []
        if msgs:
            return {"ok": False, "error": "import job did not pass validation", "messages": msgs}
        manifest = job.get("manifest") or {}
        vertical = manifest.get("vertical") or {}
        vertical_slug = str(vertical.get("slug") or job["vertical_slug"])
        try:
            await self._apply_manifest(admin_user_id, admin, manifest, vertical_slug)
            await self.db.execute(
                text(
                    """
                    UPDATE professional_pack_import_jobs
                    SET status = 'applied', dry_run = false, updated_at = now()
                    WHERE id = :id
                    """
                ),
                {"id": job_id},
            )
            epoch = await self._bump_runtime_epoch_no_commit(vertical_slug)
            await admin._audit(
                admin_user_id=admin_user_id,
                action="pack_import_apply",
                entity_type="pack_import_job",
                entity_key=str(job_id),
                before_data={"status": job.get("status")},
                after_data={"status": "applied", "epoch": epoch},
                risk_level="high",
            )
            await self.db.commit()
            return {"ok": True, "epoch": epoch}
        except Exception as exc:  # noqa: BLE001
            await self.db.rollback()
            await self.db.execute(
                text(
                    """
                    UPDATE professional_pack_import_jobs
                    SET status = 'error', error = :err, updated_at = now()
                    WHERE id = :id
                    """
                ),
                {"id": job_id, "err": str(exc)[:2000]},
            )
            await self.db.commit()
            return {"ok": False, "error": str(exc)}

    async def _apply_manifest(
        self,
        admin_user_id: UUID | None,
        admin: ProfessionalWorldsAdminService,
        manifest: dict[str, Any],
        vertical_slug: str,
    ) -> None:
        """Apply manifest rows without committing; caller owns the transaction."""
        vertical = manifest.get("vertical") if isinstance(manifest.get("vertical"), dict) else {}
        if vertical:
            before = await self._fetch_one(
                """
                SELECT id, slug, name, description, icon_key, is_active, profile_schema, workspace_template,
                       created_at, updated_at
                FROM profession_verticals
                WHERE slug = :slug
                """,
                {"slug": vertical_slug},
            )
            result = await self.db.execute(
                text(
                    """
                    INSERT INTO profession_verticals (
                        slug, name, description, icon_key, is_active, profile_schema, workspace_template
                    )
                    VALUES (
                        :slug, :name, :description, :icon_key, :is_active,
                        CAST(:profile_schema AS jsonb), CAST(:workspace_template AS jsonb)
                    )
                    ON CONFLICT (slug) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        icon_key = EXCLUDED.icon_key,
                        is_active = EXCLUDED.is_active,
                        profile_schema = EXCLUDED.profile_schema,
                        workspace_template = EXCLUDED.workspace_template,
                        updated_at = now()
                    RETURNING id, slug, name, description, icon_key, is_active, profile_schema, workspace_template,
                              created_at, updated_at
                    """
                ),
                {
                    "slug": vertical_slug,
                    "name": str(vertical.get("name") or vertical_slug),
                    "description": vertical.get("description"),
                    "icon_key": str(vertical.get("icon_key") or "briefcase"),
                    "is_active": bool(vertical.get("is_active", True)),
                    "profile_schema": _json(
                        vertical.get("profile_schema") if isinstance(vertical.get("profile_schema"), dict) else {}
                    ),
                    "workspace_template": _json(
                        vertical.get("workspace_template")
                        if isinstance(vertical.get("workspace_template"), dict)
                        else {}
                    ),
                },
            )
            row = dict(result.mappings().one())
            await admin._audit(
                admin_user_id=admin_user_id,
                action="upsert",
                entity_type="vertical",
                entity_key=vertical_slug,
                before_data=before,
                after_data=row,
            )
        for mod in manifest.get("module_catalog") or []:
            if not isinstance(mod, dict) or not mod.get("module_key"):
                continue
            module_key = str(mod["module_key"])
            before = await self._fetch_one(
                """
                SELECT id, module_key, name, description, category, icon_key, default_config, is_active,
                       created_at, updated_at
                FROM professional_modules
                WHERE module_key = :module_key
                """,
                {"module_key": module_key},
            )
            result = await self.db.execute(
                text(
                    """
                    INSERT INTO professional_modules (
                        module_key, name, description, category, icon_key, default_config, is_active
                    )
                    VALUES (
                        :module_key, :name, :description, :category, :icon_key,
                        CAST(:default_config AS jsonb), :is_active
                    )
                    ON CONFLICT (module_key) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        category = EXCLUDED.category,
                        icon_key = EXCLUDED.icon_key,
                        default_config = EXCLUDED.default_config,
                        is_active = EXCLUDED.is_active,
                        updated_at = now()
                    RETURNING id, module_key, name, description, category, icon_key, default_config, is_active,
                              created_at, updated_at
                    """
                ),
                {
                    "module_key": module_key,
                    "name": str(mod.get("name") or module_key),
                    "description": mod.get("description"),
                    "category": str(mod.get("category") or "workspace"),
                    "icon_key": str(mod.get("icon_key") or "squares"),
                    "default_config": _json(
                        mod.get("default_config") if isinstance(mod.get("default_config"), dict) else {}
                    ),
                    "is_active": bool(mod.get("is_active", True)),
                },
            )
            row = dict(result.mappings().one())
            await admin._audit(
                admin_user_id=admin_user_id,
                action="upsert",
                entity_type="module",
                entity_key=module_key,
                before_data=before,
                after_data=row,
            )
        for vm in manifest.get("modules") or []:
            if not isinstance(vm, dict) or not vm.get("module_key"):
                continue
            module_key = str(vm["module_key"])
            before = await self._fetch_one(
                """
                SELECT id, vertical_slug, module_key, config, sort_order, is_enabled, created_at, updated_at
                FROM professional_vertical_modules
                WHERE vertical_slug = :vertical_slug AND module_key = :module_key
                """,
                {"vertical_slug": vertical_slug, "module_key": module_key},
            )
            result = await self.db.execute(
                text(
                    """
                    INSERT INTO professional_vertical_modules (vertical_slug, module_key, config, sort_order, is_enabled)
                    VALUES (:vertical_slug, :module_key, CAST(:config AS jsonb), :sort_order, :is_enabled)
                    ON CONFLICT (vertical_slug, module_key) DO UPDATE SET
                        config = EXCLUDED.config,
                        sort_order = EXCLUDED.sort_order,
                        is_enabled = EXCLUDED.is_enabled,
                        updated_at = now()
                    RETURNING id, vertical_slug, module_key, config, sort_order, is_enabled, created_at, updated_at
                    """
                ),
                {
                    "vertical_slug": vertical_slug,
                    "module_key": module_key,
                    "config": _json(vm.get("config") if isinstance(vm.get("config"), dict) else {}),
                    "sort_order": int(vm.get("sort_order") or 0),
                    "is_enabled": bool(vm.get("is_enabled", True)),
                },
            )
            row = dict(result.mappings().one())
            await admin._audit(
                admin_user_id=admin_user_id,
                action="assign",
                entity_type="vertical_module",
                entity_key=f"{vertical_slug}:{module_key}",
                before_data=before,
                after_data=row,
            )
        for sch in manifest.get("schemas") or []:
            if not isinstance(sch, dict) or not sch.get("schema_key"):
                continue
            schema_key = str(sch["schema_key"])
            version = int(sch.get("version") or 1)
            before = await self._fetch_one(
                """
                SELECT id, vertical_slug, schema_key, version, title, schema_json, ui_schema,
                       is_active, created_at, updated_at
                FROM professional_vertical_schemas
                WHERE vertical_slug = :vertical_slug AND schema_key = :schema_key AND version = :version
                """,
                {"vertical_slug": vertical_slug, "schema_key": schema_key, "version": version},
            )
            if bool(sch.get("is_active", False)):
                await self.db.execute(
                    text(
                        """
                        UPDATE professional_vertical_schemas
                        SET is_active = false, updated_at = now()
                        WHERE vertical_slug = :vertical_slug AND schema_key = :schema_key
                        """
                    ),
                    {"vertical_slug": vertical_slug, "schema_key": schema_key},
                )
            result = await self.db.execute(
                text(
                    """
                    INSERT INTO professional_vertical_schemas (
                        vertical_slug, schema_key, version, title, schema_json, ui_schema, is_active
                    )
                    VALUES (
                        :vertical_slug, :schema_key, :version, :title,
                        CAST(:schema_json AS jsonb), CAST(:ui_schema AS jsonb), :is_active
                    )
                    ON CONFLICT (vertical_slug, schema_key, version) DO UPDATE SET
                        title = EXCLUDED.title,
                        schema_json = EXCLUDED.schema_json,
                        ui_schema = EXCLUDED.ui_schema,
                        is_active = EXCLUDED.is_active,
                        updated_at = now()
                    RETURNING id, vertical_slug, schema_key, version, title, schema_json, ui_schema,
                              is_active, created_at, updated_at
                    """
                ),
                {
                    "vertical_slug": vertical_slug,
                    "schema_key": schema_key,
                    "version": version,
                    "title": str(sch.get("title") or schema_key),
                    "schema_json": _json(sch.get("schema_json") if isinstance(sch.get("schema_json"), dict) else {}),
                    "ui_schema": _json(sch.get("ui_schema") if isinstance(sch.get("ui_schema"), dict) else {}),
                    "is_active": bool(sch.get("is_active", False)),
                },
            )
            row = dict(result.mappings().one())
            await admin._audit(
                admin_user_id=admin_user_id,
                action="upsert",
                entity_type="schema",
                entity_key=f"{vertical_slug}:{schema_key}:{version}",
                before_data=before,
                after_data=row,
            )
        for action in manifest.get("ai_actions") or []:
            if not isinstance(action, dict) or not action.get("action_key"):
                continue
            action_key = str(action["action_key"])
            before = await self._fetch_one(
                """
                SELECT id, vertical_slug, module_key, action_key, display_name, description, ugs_type_key,
                       workflow_slug, prompt_template, input_schema, output_schema, safety_rules, artifact_kind,
                       billing_hint, is_active, sort_order, created_at, updated_at
                FROM professional_ai_actions
                WHERE vertical_slug = :vertical_slug AND action_key = :action_key
                """,
                {"vertical_slug": vertical_slug, "action_key": action_key},
            )
            result = await self.db.execute(
                text(
                    """
                    INSERT INTO professional_ai_actions (
                        vertical_slug, module_key, action_key, display_name, description, ugs_type_key, workflow_slug,
                        prompt_template, input_schema, output_schema, safety_rules, artifact_kind, billing_hint,
                        is_active, sort_order
                    )
                    VALUES (
                        :vertical_slug, :module_key, :action_key, :display_name, :description, :ugs_type_key,
                        :workflow_slug, :prompt_template, CAST(:input_schema AS jsonb), CAST(:output_schema AS jsonb),
                        CAST(:safety_rules AS jsonb), :artifact_kind, CAST(:billing_hint AS jsonb), :is_active,
                        :sort_order
                    )
                    ON CONFLICT (vertical_slug, action_key) DO UPDATE SET
                        module_key = EXCLUDED.module_key,
                        display_name = EXCLUDED.display_name,
                        description = EXCLUDED.description,
                        ugs_type_key = EXCLUDED.ugs_type_key,
                        workflow_slug = EXCLUDED.workflow_slug,
                        prompt_template = EXCLUDED.prompt_template,
                        input_schema = EXCLUDED.input_schema,
                        output_schema = EXCLUDED.output_schema,
                        safety_rules = EXCLUDED.safety_rules,
                        artifact_kind = EXCLUDED.artifact_kind,
                        billing_hint = EXCLUDED.billing_hint,
                        is_active = EXCLUDED.is_active,
                        sort_order = EXCLUDED.sort_order,
                        updated_at = now()
                    RETURNING id, vertical_slug, module_key, action_key, display_name, description, ugs_type_key,
                              workflow_slug, prompt_template, input_schema, output_schema, safety_rules, artifact_kind,
                              billing_hint, is_active, sort_order, created_at, updated_at
                    """
                ),
                {
                    "vertical_slug": vertical_slug,
                    "module_key": str(action.get("module_key") or "workspace"),
                    "action_key": action_key,
                    "display_name": str(action.get("display_name") or action_key),
                    "description": action.get("description"),
                    "ugs_type_key": str(
                        action.get("ugs_type_key") or f"professional_worlds_{vertical_slug}_{action_key}"
                    ),
                    "workflow_slug": action.get("workflow_slug"),
                    "prompt_template": str(action.get("prompt_template") or "runtime:noop"),
                    "input_schema": _json(
                        action.get("input_schema") if isinstance(action.get("input_schema"), dict) else {}
                    ),
                    "output_schema": _json(
                        action.get("output_schema") if isinstance(action.get("output_schema"), dict) else {}
                    ),
                    "safety_rules": _json(
                        action.get("safety_rules") if isinstance(action.get("safety_rules"), list) else []
                    ),
                    "artifact_kind": str(action.get("artifact_kind") or "text"),
                    "billing_hint": _json(
                        action.get("billing_hint") if isinstance(action.get("billing_hint"), dict) else {}
                    ),
                    "sort_order": int(action.get("sort_order") or 0),
                    "is_active": bool(action.get("is_active", True)),
                },
            )
            row = dict(result.mappings().one())
            await admin._audit(
                admin_user_id=admin_user_id,
                action="upsert",
                entity_type="ai_action",
                entity_key=f"{vertical_slug}:{action_key}",
                before_data=before,
                after_data=row,
            )
        for preset in manifest.get("photo_presets") or []:
            if not isinstance(preset, dict) or not preset.get("preset_key"):
                continue
            preset_key = str(preset["preset_key"])
            before = await self._fetch_one(
                """
                SELECT id, vertical_slug, preset_key, display_name, description, category, action_type,
                       ugs_type_key, prompt_template, parameters, is_active, sort_order, created_at, updated_at
                FROM professional_photo_presets
                WHERE vertical_slug = :vertical_slug AND preset_key = :preset_key
                """,
                {"vertical_slug": vertical_slug, "preset_key": preset_key},
            )
            result = await self.db.execute(
                text(
                    """
                    INSERT INTO professional_photo_presets (
                        vertical_slug, preset_key, display_name, description, category, action_type,
                        ugs_type_key, prompt_template, parameters, is_active, sort_order
                    )
                    VALUES (
                        :vertical_slug, :preset_key, :display_name, :description, :category, :action_type,
                        :ugs_type_key, :prompt_template, CAST(:parameters AS jsonb), :is_active, :sort_order
                    )
                    ON CONFLICT (vertical_slug, preset_key) DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        description = EXCLUDED.description,
                        category = EXCLUDED.category,
                        action_type = EXCLUDED.action_type,
                        ugs_type_key = EXCLUDED.ugs_type_key,
                        prompt_template = EXCLUDED.prompt_template,
                        parameters = EXCLUDED.parameters,
                        is_active = EXCLUDED.is_active,
                        sort_order = EXCLUDED.sort_order,
                        updated_at = now()
                    RETURNING id, vertical_slug, preset_key, display_name, description, category, action_type,
                              ugs_type_key, prompt_template, parameters, is_active, sort_order, created_at, updated_at
                    """
                ),
                {
                    "vertical_slug": vertical_slug,
                    "preset_key": preset_key,
                    "display_name": str(preset.get("display_name") or preset_key),
                    "description": preset.get("description"),
                    "category": str(preset.get("category") or "enhance"),
                    "action_type": str(preset.get("action_type") or "image_edit"),
                    "ugs_type_key": str(preset.get("ugs_type_key") or "image_studio_image_edit"),
                    "prompt_template": str(preset.get("prompt_template") or "enhance photo"),
                    "parameters": _json(preset.get("parameters") if isinstance(preset.get("parameters"), dict) else {}),
                    "sort_order": int(preset.get("sort_order") or 0),
                    "is_active": bool(preset.get("is_active", True)),
                },
            )
            row = dict(result.mappings().one())
            await admin._audit(
                admin_user_id=admin_user_id,
                action="upsert",
                entity_type="photo_preset",
                entity_key=f"{vertical_slug}:{preset_key}",
                before_data=before,
                after_data=row,
            )
        for binding in manifest.get("integrations") or []:
            if not isinstance(binding, dict) or not binding.get("integration_key"):
                continue
            integration_key = str(binding["integration_key"])
            before = await self._fetch_one(
                """
                SELECT id, vertical_slug, integration_key, display_name, config, is_enabled, created_at, updated_at
                FROM professional_integration_bindings
                WHERE vertical_slug = :vertical_slug AND integration_key = :integration_key
                """,
                {"vertical_slug": vertical_slug, "integration_key": integration_key},
            )
            result = await self.db.execute(
                text(
                    """
                    INSERT INTO professional_integration_bindings (
                        vertical_slug, integration_key, display_name, config, is_enabled
                    )
                    VALUES (
                        :vertical_slug, :integration_key, :display_name, CAST(:config AS jsonb), :is_enabled
                    )
                    ON CONFLICT (vertical_slug, integration_key) DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        config = EXCLUDED.config,
                        is_enabled = EXCLUDED.is_enabled,
                        updated_at = now()
                    RETURNING id, vertical_slug, integration_key, display_name, config, is_enabled, created_at, updated_at
                    """
                ),
                {
                    "vertical_slug": vertical_slug,
                    "integration_key": integration_key,
                    "display_name": str(binding.get("display_name") or integration_key),
                    "config": _json(binding.get("config") if isinstance(binding.get("config"), dict) else {}),
                    "is_enabled": bool(binding.get("is_enabled", True)),
                },
            )
            row = dict(result.mappings().one())
            await admin._audit(
                admin_user_id=admin_user_id,
                action="upsert",
                entity_type="integration",
                entity_key=f"{vertical_slug}:{integration_key}",
                before_data=before,
                after_data=row,
            )

    async def diff_manifest_vs_live(
        self, admin: ProfessionalWorldsAdminService, vertical_slug: str, manifest: dict[str, Any]
    ) -> dict[str, Any]:
        live = await admin.export_vertical_pack(vertical_slug)
        return self.diff_against_live(live, manifest)

    async def create_release(
        self, admin_user_id: UUID | None, vertical_slug: str, pack_version_id: UUID | None, notes: str | None = None
    ) -> dict[str, Any]:
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_vertical_pack_releases (
                    vertical_slug, pack_version_id, status, notes, manifest_snapshot
                )
                VALUES (:v, :pvid, 'draft', :notes, '{}'::jsonb)
                RETURNING id, vertical_slug, status, created_at
                """
            ),
            {"v": vertical_slug, "pvid": pack_version_id, "notes": notes},
        )
        row = _row(result.mappings().one())
        await self.db.commit()
        return row or {}

    async def approve_release(
        self,
        admin_user_id: UUID | None,
        release_id: UUID,
        *,
        comment: str | None = None,
    ) -> dict[str, Any] | None:
        extra = ""
        if comment and str(comment).strip():
            stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%MZ")
            extra = f"\n[approve {stamp}] {str(comment).strip()}"
        result = await self.db.execute(
            text(
                """
                UPDATE professional_vertical_pack_releases
                SET status = 'approved',
                    approved_by_admin_id = :aid,
                    approved_at = now(),
                    updated_at = now(),
                    notes = CASE
                        WHEN :extra = '' THEN notes
                        ELSE coalesce(notes, '') || :extra
                    END
                WHERE id = :rid AND status IN ('draft', 'pending')
                RETURNING id, status
                """
            ),
            {"rid": release_id, "aid": admin_user_id, "extra": extra},
        )
        row = _row(result.mappings().one_or_none())
        await self.db.commit()
        return row

    async def publish_release(
        self, admin_user_id: UUID | None, admin: ProfessionalWorldsAdminService, release_id: UUID
    ) -> dict[str, Any] | None:
        rel_result = await self.db.execute(
            text(
                """
                SELECT id, vertical_slug, status FROM professional_vertical_pack_releases WHERE id = :id
                """
            ),
            {"id": release_id},
        )
        rel = _row(rel_result.mappings().one_or_none())
        if rel is None:
            return None
        vertical_slug = str(rel["vertical_slug"])
        snap = await admin.export_vertical_pack(vertical_slug)
        raw = _json(snap)
        digest = hashlib.sha256(raw.encode()).hexdigest()
        result = await self.db.execute(
            text(
                """
                UPDATE professional_vertical_pack_releases
                SET status = 'published',
                    manifest_snapshot = CAST(:snap AS jsonb),
                    snapshot_hash = :hash,
                    published_at = now(),
                    updated_at = now()
                WHERE id = :rid AND status = 'approved'
                RETURNING id, vertical_slug, status, published_at
                """
            ),
            {"rid": release_id, "snap": raw, "hash": digest},
        )
        row = _row(result.mappings().one_or_none())
        await self.db.commit()
        if row:
            await self.bump_runtime_epoch(vertical_slug)
        return row

    async def rollback_release(
        self, admin_user_id: UUID | None, admin: ProfessionalWorldsAdminService, release_id: UUID
    ) -> dict[str, Any] | None:
        try:
            result = await self.db.execute(
                text(
                    """
                    UPDATE professional_vertical_pack_releases
                    SET status = 'rolled_back', updated_at = now(), notes = coalesce(notes,'') || ' [rolled back]'
                    WHERE id = :rid
                    RETURNING vertical_slug, id
                    """
                ),
                {"rid": release_id},
            )
            row = _row(result.mappings().one_or_none())
            if row is None:
                await self.db.commit()
                return None
            slug = str(row["vertical_slug"])
            epoch = await self._bump_runtime_epoch_no_commit(slug)
            await admin._audit(
                admin_user_id=admin_user_id,
                action="release_rollback",
                entity_type="pack_release",
                entity_key=str(release_id),
                before_data={"status": "published", "release_id": str(release_id)},
                after_data={"status": "rolled_back", "epoch": epoch},
                risk_level="high",
            )
            await self.db.commit()
            return {**row, "epoch": epoch}
        except Exception:
            await self.db.rollback()
            raise

    async def list_rollouts(self, vertical_slug: str | None = None) -> list[dict[str, Any]]:
        where = "WHERE vertical_slug = :v" if vertical_slug else ""
        result = await self.db.execute(
            text(
                f"""
                SELECT id, vertical_slug, release_id, mode, percentage, is_paused, created_at, updated_at
                FROM professional_vertical_rollouts
                {where}
                ORDER BY updated_at DESC
                """
            ),
            {"v": vertical_slug} if vertical_slug else {},
        )
        return _rows(list(result.mappings().all()))

    async def create_rollout(
        self,
        vertical_slug: str,
        release_id: UUID,
        mode: str,
        percentage: int,
    ) -> dict[str, Any]:
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_vertical_rollouts (vertical_slug, release_id, mode, percentage, is_paused)
                VALUES (:v, :rid, :mode, :pct, false)
                RETURNING id, vertical_slug, release_id, mode, percentage, is_paused, created_at
                """
            ),
            {"v": vertical_slug, "rid": release_id, "mode": mode, "pct": percentage},
        )
        row = _row(result.mappings().one())
        if row is None:
            msg = "rollout insert returned no row"
            raise RuntimeError(msg)
        await self.db.commit()
        epoch = await self.bump_runtime_epoch(vertical_slug)
        row["epoch"] = epoch
        return row

    async def patch_rollout(
        self, rollout_id: UUID, *, mode: str | None, percentage: int | None
    ) -> dict[str, Any] | None:
        sets: list[str] = ["updated_at = now()"]
        params: dict[str, Any] = {"id": rollout_id}
        if mode is not None:
            sets.append("mode = :mode")
            params["mode"] = mode
        if percentage is not None:
            sets.append("percentage = :pct")
            params["pct"] = percentage
        result = await self.db.execute(
            text(
                f"""
                UPDATE professional_vertical_rollouts
                SET {", ".join(sets)}
                WHERE id = :id
                RETURNING id, vertical_slug, release_id, mode, percentage, is_paused
                """
            ),
            params,
        )
        row = _row(result.mappings().one_or_none())
        await self.db.commit()
        if row:
            await self.bump_runtime_epoch(str(row["vertical_slug"]))
        return row

    async def set_rollout_paused(self, rollout_id: UUID, paused: bool) -> dict[str, Any] | None:
        result = await self.db.execute(
            text(
                """
                UPDATE professional_vertical_rollouts
                SET is_paused = :paused, updated_at = now()
                WHERE id = :id
                RETURNING id, vertical_slug, is_paused
                """
            ),
            {"id": rollout_id, "paused": paused},
        )
        row = _row(result.mappings().one_or_none())
        await self.db.commit()
        if row:
            await self.bump_runtime_epoch(str(row["vertical_slug"]))
        return row


def runtime_config_hash_blob(blob: dict[str, Any]) -> str:
    """Stable short hash for frontend caching."""
    raw = json.dumps(blob, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:40]
