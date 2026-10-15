#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# List/query catalogue paths for Unified Content (filters, search scope, batch reads, view history).
# Invariants:
# - Access SQL must match core ``get_content`` permission model; no caller-driven scope widening.
# - Page can_delete / multi-get ACL use ``content_acl_batch`` prefetch (no per-row share SELECTs).
# Related:
# - api/services/unified_content/content_storage_service.py
# - api/services/unified_content/content_acl_batch.py
# ---
"""List and catalogue query operations for Unified Content storage."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from api.gaf_chat.constants import CONTENT_SUBTYPE_GAF_CHAT_VOICE
from api.schemas.unified_content import Content, ContentType, Visibility
from api.services.unified_content.content_access_policy import build_sql_friend_shared_subset_clause
from api.services.unified_content.content_acl_batch import (
    content_accessible_with_prefetch,
    prefetch_acl_sets_for_rows,
)
from api.services.unified_content.content_storage_mixin_host import ContentStorageMixinHost
from api.services.unified_content.content_storage_shared import (
    LIBRARY_REMOVAL_FILTER_SQL,
    LIST_PUBLIC_FROM_OTHERS_EXCLUDES_PROFILE,
    SQL_INDEXED_BODY_CORPUS,
    SQL_LIST_EXCLUDE_GAF_CHAT_VOICE,
    SQL_UNIFIED_CONTENT_LIST_COLUMNS,
    SQL_UNIFIED_CONTENT_LIST_COLUMNS_COMPACT,
    SQL_UNIFIED_CONTENT_UC_LIST_SELECT,
    normalize_row_mime,
)
from api.utils.ewa_companion_folder import EWA_COMPANION_FOLDER_ITEM_ID
from api.utils.project_vault_lifecycle import resolve_owner_can_edit

logger = logging.getLogger(__name__)


class ContentStorageListMixin(ContentStorageMixinHost):
    def _build_order_by(self, sort_field: str, sort_order: str, group_by_type: bool = False) -> str:
        """
        Build ORDER BY clause for SQL query

        Args:
            sort_field: Field to sort by (name, date, modified, size, type)
            sort_order: Sort order (asc, desc)
            group_by_type: Whether to group by content type first

        Returns:
            ORDER BY clause string
        """
        # Map frontend sort fields to database columns
        field_map = {
            "name": "name",
            "date": "created_at",
            "modified": "updated_at",
            "size": "file_size",
            "type": "content_type",
        }

        # Validate sort_field
        if sort_field not in field_map:
            sort_field = "date"  # Default to date

        # Validate sort_order
        if sort_order not in ["asc", "desc"]:
            sort_order = "desc"  # Default to desc

        db_field = field_map[sort_field]
        order = sort_order.upper()

        # Build ORDER BY clause
        if group_by_type:
            # When grouping by type, always sort by type first
            return f"ORDER BY content_type, {db_field} {order}"
        return f"ORDER BY {db_field} {order}"

    async def list_content(
        self,
        user_id: str,
        content_type: ContentType | None = None,
        mime_type: str | None = None,
        tags: list[str] | None = None,
        search_query: str | None = None,
        visibility: Visibility | None = None,
        company_id: UUID | None = None,
        project_id: UUID | None = None,
        folder_item_id: str | None = None,
        folder_unassigned: bool = False,
        exclude_folder_item_id: str | None = None,
        sort_field: str | None = None,
        sort_order: str | None = None,
        offset: int = 0,
        limit: int = 50,
        cursor: str | None = None,
        group_by_type: bool = False,
        source_service: str | None = None,
        alternate_user_id: str | None = None,
        owner_only: bool = False,
        list_profile: str = "full",
        search_scope: str = "metadata",
        min_file_size: int | None = None,
        processing_status: str | None = None,
    ) -> tuple[list[Content], int]:
        """
        List user's content with filters and pagination

        Args:
            user_id: Primary user ID (DB users.id)
            alternate_user_id: Optional second id (e.g. Keycloak sub) so both old and new content show
            content_type: Filter by content type
            tags: Filter by tags (AND logic)
            search_query: Search needle; metadata scope checks name/title/description/original filename/tags
            search_scope: metadata (legacy), content (extracted_text), or hybrid
            visibility: Filter by visibility
            company_id: Filter by company (Plan 3: Content Manager Expansion)
            project_id: Filter by project (Plan 3: Content Manager Expansion)
            offset: Pagination offset
            limit: Max results (max 200)
            group_by_type: Group results by content type before sorting by date

        Returns:
            Tuple of (content list, total count)
        """
        limit = min(limit, 200)  # Cap at 200

        logger.debug("list_content called user_id_type=%s", type(user_id).__name__)

        # Include files user has access to, not just owned files
        # User has access if:
        # 1. user_id = owner (own files)
        # 2. visibility = 'public' (public files)
        # 3. visibility = 'shared' AND user_id in shared_with_user_ids (legacy shared)
        # 4. EXISTS in content_shares table (explicit shares)
        # 5. friend_visibility = true AND mutual friendship exists

        # unified_content.user_id is UUID; compare as text to avoid uuid=varchar operator error (param is string)
        user_id_str = str(user_id).strip()
        alt_id = (
            str(alternate_user_id).strip()
            if alternate_user_id and str(alternate_user_id).strip() != user_id_str
            else None
        )
        user_id_condition = "((user_id)::text = $1 OR (user_id)::text = $2)" if alt_id else "(user_id)::text = $1"
        params: list[Any] = [user_id_str]
        if alt_id:
            params.append(alt_id)
        param_count = len(params)
        project_param_idx: int | None = None
        if project_id is not None:
            param_count += 1
            project_param_idx = param_count
            params.append(project_id if isinstance(project_id, UUID) else UUID(str(project_id)))

        def _proj_access_or() -> str:
            if project_param_idx is None:
                return ""
            return (
                " OR (unified_content.project_id IS NOT NULL "
                f"AND unified_content.project_id = ${project_param_idx}::uuid)"
            )

        visibility_val = (
            visibility.value
            if visibility and hasattr(visibility, "value")
            else (visibility if isinstance(visibility, str) else None)
        )
        logger.debug("list_content filters alternate=%s visibility=%r", bool(alt_id), visibility_val)

        # owner_only is used by features that should only show the user's own content,
        # even when the general content manager exposes shared/public items too.
        if owner_only:
            conditions = [
                "deleted_at IS NULL",
                user_id_condition,
            ]
            if visibility_val:
                param_count += 1
                conditions.append(f"visibility = ${param_count}")
                params.append(visibility_val)
        # Build access conditions: по умолчанию показываем всё, к чему у юзера есть доступ
        # (свои + public + shared через content_shares или shared_with_user_ids)
        elif visibility_val == "private" or (visibility and visibility == Visibility.PRIVATE):
            po = _proj_access_or()
            if po:
                conditions = [
                    "deleted_at IS NULL",
                    f"({user_id_condition}{po})",
                    "visibility = 'private'",
                ]
            else:
                conditions = [
                    "deleted_at IS NULL",
                    user_id_condition,
                    "visibility = 'private'",
                ]
        elif visibility_val == "public" or (visibility and visibility == Visibility.PUBLIC):
            po = _proj_access_or()
            conditions = [
                "deleted_at IS NULL",
                f"""({user_id_condition} OR {LIST_PUBLIC_FROM_OTHERS_EXCLUDES_PROFILE}{po})""",
            ]
        elif visibility_val == "friends" or (visibility and visibility == Visibility.FRIENDS):
            # Только строки с visibility = 'friends': свои с такой видимостью или контент друзей с такой видимостью
            po = _proj_access_or()
            if alt_id:
                conditions = [
                    "deleted_at IS NULL",
                    "visibility = 'friends'",
                    f"""({user_id_condition} OR (check_mutual_friendship(unified_content.user_id, $1::uuid) OR check_mutual_friendship(unified_content.user_id, $2::uuid)){po})""",
                ]
            else:
                conditions = [
                    "deleted_at IS NULL",
                    "visibility = 'friends'",
                    f"""((user_id)::text = $1 OR check_mutual_friendship(unified_content.user_id, $1::uuid){po})""",
                ]
        elif visibility_val == "from_friends" or (visibility and visibility == Visibility.FROM_FRIENDS):
            # Только контент «от друзей»: visibility = 'friends' и не свой (расшарено мне друзьями)
            po = _proj_access_or()
            if alt_id:
                if po:
                    inner = (
                        "(unified_content.user_id)::text != $1 AND (unified_content.user_id)::text != $2 AND "
                        "(check_mutual_friendship(unified_content.user_id, $1::uuid) "
                        "OR check_mutual_friendship(unified_content.user_id, $2::uuid))"
                    )
                    conditions = [
                        "deleted_at IS NULL",
                        "visibility = 'friends'",
                        f"(({inner}){po})",
                    ]
                else:
                    conditions = [
                        "deleted_at IS NULL",
                        "visibility = 'friends'",
                        "(unified_content.user_id)::text != $1 AND (unified_content.user_id)::text != $2",
                        """(check_mutual_friendship(unified_content.user_id, $1::uuid) OR check_mutual_friendship(unified_content.user_id, $2::uuid))""",
                    ]
            elif po:
                inner = (
                    "(unified_content.user_id)::text != $1 AND "
                    "check_mutual_friendship(unified_content.user_id, $1::uuid)"
                )
                conditions = [
                    "deleted_at IS NULL",
                    "visibility = 'friends'",
                    f"(({inner}){po})",
                ]
            else:
                conditions = [
                    "deleted_at IS NULL",
                    "visibility = 'friends'",
                    "(unified_content.user_id)::text != $1",
                    "check_mutual_friendship(unified_content.user_id, $1::uuid)",
                ]
        elif visibility_val == "shared" or (visibility and visibility == Visibility.SHARED):
            # Только контент, доступный мне по shared (свой shared или расшаренный мне)
            po = _proj_access_or()
            if alt_id:
                conditions = [
                    "deleted_at IS NULL",
                    f"""( {user_id_condition} OR (visibility = 'shared' AND shared_with_user_ids IS NOT NULL AND ($1 = ANY(shared_with_user_ids) OR $2 = ANY(shared_with_user_ids)))
                        OR EXISTS (SELECT 1 FROM content_shares cs WHERE cs.content_id = unified_content.id
                        AND cs.shared_with_user_id IN ($1, $2) AND (cs.expires_at IS NULL OR cs.expires_at > NOW()))
                        {po})""",
                ]
            else:
                conditions = [
                    "deleted_at IS NULL",
                    f"""( (user_id)::text = $1 OR (visibility = 'shared' AND shared_with_user_ids IS NOT NULL AND $1 = ANY(shared_with_user_ids))
                        OR EXISTS (SELECT 1 FROM content_shares cs WHERE cs.content_id = unified_content.id
                        AND cs.shared_with_user_id = $1 AND (cs.expires_at IS NULL OR cs.expires_at > NOW()))
                        {po})""",
                ]
        else:
            # Без фильтра по visibility: показываем ВСЁ доступное (свои + public + shared)
            po = _proj_access_or()
            friend_shared_subset_clause = (
                build_sql_friend_shared_subset_clause(["$1", "$2"])
                if alt_id
                else build_sql_friend_shared_subset_clause(["$1"])
            )
            if alt_id:
                conditions = [
                    "deleted_at IS NULL",
                    f"""( {user_id_condition} OR {LIST_PUBLIC_FROM_OTHERS_EXCLUDES_PROFILE}
                        OR (visibility = 'friends' AND (check_mutual_friendship(unified_content.user_id, $1::uuid) OR check_mutual_friendship(unified_content.user_id, $2::uuid)))
                        OR (visibility = 'shared' AND shared_with_user_ids IS NOT NULL AND ($1 = ANY(shared_with_user_ids) OR $2 = ANY(shared_with_user_ids)))
                        OR EXISTS (SELECT 1 FROM content_shares cs WHERE cs.content_id = unified_content.id
                        AND cs.shared_with_user_id IN ($1, $2) AND (cs.expires_at IS NULL OR cs.expires_at > NOW()))
                        OR {friend_shared_subset_clause}
                        {po})""",
                ]
            else:
                conditions = [
                    "deleted_at IS NULL",
                    f"""( (user_id)::text = $1 OR {LIST_PUBLIC_FROM_OTHERS_EXCLUDES_PROFILE}
                        OR (visibility = 'friends' AND check_mutual_friendship(unified_content.user_id, $1::uuid))
                        OR (visibility = 'shared' AND shared_with_user_ids IS NOT NULL AND $1 = ANY(shared_with_user_ids))
                        OR EXISTS (SELECT 1 FROM content_shares cs WHERE cs.content_id = unified_content.id
                        AND cs.shared_with_user_id = $1 AND (cs.expires_at IS NULL OR cs.expires_at > NOW()))
                        OR {friend_shared_subset_clause}
                        {po})""",
                ]

        conditions.append(SQL_LIST_EXCLUDE_GAF_CHAT_VOICE)
        conditions.append(LIBRARY_REMOVAL_FILTER_SQL.strip())
        from api.services.unified_content.storage_integrity import (  # noqa: PLC0415
            SQL_EXCLUDE_BROKEN_QUARANTINED,
        )

        conditions.append(SQL_EXCLUDE_BROKEN_QUARANTINED)

        if content_type:
            param_count += 1
            conditions.append(f"content_type = ${param_count}")
            params.append(content_type.value)

        mime_value = (mime_type or "").strip()
        if mime_value:
            param_count += 1
            if mime_value.endswith("/"):
                conditions.append(f"mime_type LIKE ${param_count}")
                params.append(f"{mime_value}%")
            else:
                conditions.append(f"mime_type = ${param_count}")
                params.append(mime_value)

        if tags:
            param_count += 1
            conditions.append(f"tags @> ${param_count}")
            params.append(tags)  # asyncpg supports list[str] for array params

        search_param_idx: int | None = None
        search_scope_norm = self._normalize_search_scope(search_scope)
        search_value = (search_query or "").strip()
        if search_value:
            param_count += 1
            search_param_idx = param_count
            params.append(search_value)
            metadata_match = self._metadata_search_match_sql(search_param_idx)
            body_match = self._body_search_match_sql(search_param_idx)
            degraded_body_match = self._body_search_degraded_match_sql(search_param_idx)
            if search_scope_norm == "content":
                conditions.append(f"({body_match} OR {degraded_body_match})")
            elif search_scope_norm == "hybrid":
                conditions.append(f"({metadata_match} OR {body_match} OR {degraded_body_match})")
            else:
                conditions.append(metadata_match)

        # Add explicit visibility = $n only when not already in conditions (PRIVATE/FRIENDS/FROM_FRIENDS уже содержат)
        if visibility and visibility_val not in ("private", "friends", "from_friends"):
            param_count += 1
            conditions.append(f"visibility = ${param_count}")
            params.append(
                visibility_val if isinstance(visibility_val, str) else (visibility.value if visibility else "")
            )

        if company_id:
            param_count += 1
            # Column is uuid; compare with $n::uuid (str binds break on PG: uuid = text).
            conditions.append(f"company_id = ${param_count}::uuid")
            params.append(company_id)

        if project_param_idx is not None:
            conditions.append(f"project_id = ${project_param_idx}::uuid")

        if source_service:
            param_count += 1
            conditions.append(f"COALESCE(source_service, '') = ${param_count}")
            params.append(source_service)

        if folder_unassigned:
            conditions.append("folder_item_id IS NULL")
        elif folder_item_id is not None:
            # EwaFile browse includes nested companion task folders (ewa-task-*).
            if str(folder_item_id).strip() == EWA_COMPANION_FOLDER_ITEM_ID:
                from api.utils.ewa_task_folder import EWA_TASK_FOLDER_PREFIX

                param_count += 1
                root_idx = param_count
                params.append(folder_item_id)
                param_count += 1
                prefix_idx = param_count
                params.append(f"{EWA_TASK_FOLDER_PREFIX}%")
                conditions.append(f"(folder_item_id = ${root_idx} OR folder_item_id LIKE ${prefix_idx})")
            else:
                param_count += 1
                conditions.append(f"folder_item_id = ${param_count}")
                params.append(folder_item_id)

        exclude_folder = (exclude_folder_item_id or "").strip() or None
        if exclude_folder:
            param_count += 1
            conditions.append(f"(folder_item_id IS DISTINCT FROM ${param_count})")
            params.append(exclude_folder)

        if min_file_size is not None:
            param_count += 1
            conditions.append(f"COALESCE(file_size, 0) >= ${param_count}")
            params.append(int(min_file_size))

        if processing_status:
            param_count += 1
            conditions.append(f"LOWER(COALESCE(processing_status::text, '')) = ${param_count}")
            params.append(str(processing_status).strip().lower())

        search_active = search_param_idx is not None
        base_where_clause = " AND ".join(conditions)
        base_param_count = param_count
        use_keyset = False
        list_where_clause = base_where_clause
        list_params = list(params)
        if cursor:
            from api.services.unified_content.unified_content_list import (
                assert_cursor_sort_matches_request,
                bind_keyset_where_clause,
                content_list_keyset_where_sql,
                content_list_order_by_sql,
                content_list_supports_keyset,
                decode_content_list_cursor,
            )

            if content_list_supports_keyset(
                search_query=search_value,
                group_by_type=group_by_type,
            ):
                cursor_state = decode_content_list_cursor(cursor)
                assert_cursor_sort_matches_request(
                    cursor_state,
                    sort_field=sort_field,
                    sort_order=sort_order,
                )
                keyset_clause, keyset_params = content_list_keyset_where_sql(cursor_state)
                keyset_start = len(list_params) + 1
                keyset_sql = bind_keyset_where_clause(keyset_clause, keyset_start)
                list_params.extend(keyset_params)
                list_where_clause = f"{base_where_clause} AND {keyset_sql}"
                order_by = content_list_order_by_sql(
                    sort_field=sort_field,
                    sort_order=sort_order,
                    group_by_type=group_by_type,
                    search_active=search_active,
                )
                use_keyset = True
                offset = 0
                list_param_count = base_param_count + len(keyset_params)
        if not use_keyset:
            if group_by_type:
                if sort_field and sort_order:
                    order_by = self._build_order_by(sort_field, sort_order, group_by_type=True)
                else:
                    order_by = "ORDER BY content_type, created_at DESC"
            elif sort_field and sort_order:
                order_by = self._build_order_by(sort_field, sort_order, group_by_type=False)
            elif search_active:
                order_by = "ORDER BY search_score DESC NULLS LAST, created_at DESC"
            else:
                order_by = "ORDER BY created_at DESC"
            list_param_count = base_param_count

        list_cols = (
            SQL_UNIFIED_CONTENT_LIST_COLUMNS_COMPACT if list_profile == "compact" else SQL_UNIFIED_CONTENT_LIST_COLUMNS
        )
        search_cols = self._search_annotation_select_sql(search_param_idx)

        async with self.db_pool.acquire() as conn:
            # Get total count
            # Note: where_clause is built from validated inputs, params are passed separately
            total = await conn.fetchval(
                f"SELECT COUNT(*) FROM unified_content WHERE {base_where_clause}",
                *params,  # noqa: S608
            )

            # Get paginated results
            # PERFORMANCE: Select only needed columns instead of SELECT *
            # Note: where_clause and order_by are built from validated inputs, params are passed separately
            if use_keyset:
                rows = await conn.fetch(
                    f"""
                SELECT{list_cols}{search_cols}
                FROM unified_content
                WHERE {list_where_clause}
                {order_by}
                LIMIT ${list_param_count + 1}
                """,  # noqa: S608
                    *list_params,
                    limit,
                )
            else:
                rows = await conn.fetch(
                    f"""
                SELECT{list_cols}{search_cols}
                FROM unified_content
                WHERE {list_where_clause}
                {order_by}
                OFFSET ${list_param_count + 1} LIMIT ${list_param_count + 2}
                """,  # noqa: S608
                    *list_params,
                    offset,
                    limit,
                )

            if rows:
                unique_user_ids = {str(row["user_id"]) for row in rows}
                logger.debug("list_content rows=%s unique_owner_count=%s", len(rows), len(unique_user_ids))
                # Смешение владельцев в выдаче — норма для режима «всё доступное» (свои + public + shared +
                # content_shares + друзья). WARN только если явно запрошен owner_only — там не должно быть чужих.
                if len(unique_user_ids) > 1 and owner_only:
                    logger.warning(
                        "list_content owner_only returned multiple owners owner_count=%s",
                        len(unique_user_ids),
                    )
            else:
                logger.debug("list_content rows=0")

            content_list = []
            project_vault_cache: dict[UUID, bool] = {}
            row_dicts: list[dict[str, Any]] = []
            for row in rows:
                row_dict = dict(row)
                if list_profile != "compact" and isinstance(row_dict.get("metadata"), str):
                    row_dict["metadata"] = json.loads(row_dict["metadata"])
                normalize_row_mime(row_dict)
                row_dicts.append(row_dict)
            await self._apply_rows_delete_permissions(
                conn,
                row_dicts,
                user_id,
                project_vault_active_cache=project_vault_cache,
            )
            content_list = [Content(**row_dict) for row_dict in row_dicts]

            return content_list, total

    async def count_indexed_body_corpus(
        self,
        *,
        user_id: str,
        alternate_user_id: str | None = None,
        visibility: Visibility | None = None,
        owner_only: bool = False,
    ) -> int:
        """Count catalogue rows visible to the user that have indexed body text."""

        user_id_str = str(user_id).strip()
        alt_id = (
            str(alternate_user_id).strip()
            if alternate_user_id and str(alternate_user_id).strip() != user_id_str
            else None
        )
        user_id_condition = "((user_id)::text = $1 OR (user_id)::text = $2)" if alt_id else "(user_id)::text = $1"
        params: list[Any] = [user_id_str]
        if alt_id:
            params.append(alt_id)

        visibility_val = (
            visibility.value
            if visibility and hasattr(visibility, "value")
            else (visibility if isinstance(visibility, str) else None)
        )

        if owner_only:
            conditions = [
                "deleted_at IS NULL",
                user_id_condition,
            ]
            if visibility_val:
                params.append(visibility_val)
                conditions.append(f"visibility = ${len(params)}")
        else:
            po = ""
            friend_shared_subset_clause = (
                build_sql_friend_shared_subset_clause(["$1", "$2"])
                if alt_id
                else build_sql_friend_shared_subset_clause(["$1"])
            )
            if alt_id:
                conditions = [
                    "deleted_at IS NULL",
                    f"""( {user_id_condition} OR {LIST_PUBLIC_FROM_OTHERS_EXCLUDES_PROFILE}
                        OR (visibility = 'friends' AND (check_mutual_friendship(unified_content.user_id, $1::uuid) OR check_mutual_friendship(unified_content.user_id, $2::uuid)))
                        OR (visibility = 'shared' AND shared_with_user_ids IS NOT NULL AND ($1 = ANY(shared_with_user_ids) OR $2 = ANY(shared_with_user_ids)))
                        OR EXISTS (SELECT 1 FROM content_shares cs WHERE cs.content_id = unified_content.id
                        AND cs.shared_with_user_id IN ($1, $2) AND (cs.expires_at IS NULL OR cs.expires_at > NOW()))
                        OR {friend_shared_subset_clause}
                        {po})""",
                ]
            else:
                conditions = [
                    "deleted_at IS NULL",
                    f"""( (user_id)::text = $1 OR {LIST_PUBLIC_FROM_OTHERS_EXCLUDES_PROFILE}
                        OR (visibility = 'friends' AND check_mutual_friendship(unified_content.user_id, $1::uuid))
                        OR (visibility = 'shared' AND shared_with_user_ids IS NOT NULL AND $1 = ANY(shared_with_user_ids))
                        OR EXISTS (SELECT 1 FROM content_shares cs WHERE cs.content_id = unified_content.id
                        AND cs.shared_with_user_id = $1 AND (cs.expires_at IS NULL OR cs.expires_at > NOW()))
                        OR {friend_shared_subset_clause}
                        {po})""",
                ]
            if visibility_val and visibility_val not in ("private", "friends", "from_friends", "shared"):
                params.append(visibility_val)
                conditions.append(f"visibility = ${len(params)}")

        conditions.append(SQL_INDEXED_BODY_CORPUS)
        conditions.append(SQL_LIST_EXCLUDE_GAF_CHAT_VOICE)
        conditions.append(LIBRARY_REMOVAL_FILTER_SQL.strip())
        from api.services.unified_content.storage_integrity import (  # noqa: PLC0415
            SQL_EXCLUDE_BROKEN_QUARANTINED,
        )

        conditions.append(SQL_EXCLUDE_BROKEN_QUARANTINED)
        where_clause = " AND ".join(conditions)

        async with self.db_pool.acquire() as conn:
            total = await conn.fetchval(
                f"SELECT COUNT(*)::bigint FROM unified_content WHERE {where_clause}",
                *params,  # noqa: S608
            )
        return max(0, int(total or 0))

    async def list_content_multi_version(
        self,
        user_id: str,
        alternate_user_id: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Content], int]:
        """
        List the current user's own files that have more than one row in content_versions.
        """
        limit = min(limit, 200)
        user_id_str = str(user_id).strip()
        alt_id = (
            str(alternate_user_id).strip()
            if alternate_user_id and str(alternate_user_id).strip() != user_id_str
            else None
        )
        user_id_condition = (
            "((uc.user_id)::text = $1 OR (uc.user_id)::text = $2)" if alt_id else "(uc.user_id)::text = $1"
        )
        params: list[Any] = [user_id_str]
        if alt_id:
            params.append(alt_id)
        gaf_clause = f"(COALESCE(uc.sub_type, '') <> '{CONTENT_SUBTYPE_GAF_CHAT_VOICE}')"
        param_base = len(params)

        async with self.db_pool.acquire() as conn:
            total = await conn.fetchval(
                f"""
                WITH mv AS (
                    SELECT content_id
                    FROM content_versions
                    GROUP BY content_id
                    HAVING COUNT(*) > 1
                )
                SELECT COUNT(*)::bigint
                FROM unified_content uc
                INNER JOIN mv ON mv.content_id = uc.id
                WHERE uc.deleted_at IS NULL
                  AND coalesce(uc.storage_integrity_status, '') <> 'broken_quarantined'
                  AND {gaf_clause}
                  AND {user_id_condition}
                """,  # noqa: S608
                *params,
            )

            rows = await conn.fetch(
                f"""
                WITH mv AS (
                    SELECT content_id, COUNT(*)::int AS version_snapshot_count
                    FROM content_versions
                    GROUP BY content_id
                    HAVING COUNT(*) > 1
                )
                SELECT
{SQL_UNIFIED_CONTENT_UC_LIST_SELECT},
                       mv.version_snapshot_count
                FROM unified_content uc
                INNER JOIN mv ON mv.content_id = uc.id
                WHERE uc.deleted_at IS NULL
                  AND coalesce(uc.storage_integrity_status, '') <> 'broken_quarantined'
                  AND {gaf_clause}
                  AND {user_id_condition}
                ORDER BY uc.updated_at DESC
                OFFSET ${param_base + 1} LIMIT ${param_base + 2}
                """,  # noqa: S608
                *params,
                offset,
                limit,
            )

            content_list: list[Content] = []
            project_vault_cache: dict[UUID, bool] = {}
            for row in rows:
                row_dict = dict(row)
                if isinstance(row_dict.get("metadata"), str):
                    row_dict["metadata"] = json.loads(row_dict["metadata"])
                normalize_row_mime(row_dict)
                row_dict["is_owner"] = str(row["user_id"]) == str(user_id)
                row_dict["can_edit"] = await resolve_owner_can_edit(
                    conn,
                    owner_user_id=row["user_id"],
                    viewer_user_id=user_id,
                    project_id=row.get("project_id"),
                    project_vault_active_cache=project_vault_cache,
                )
                row_dict["can_delete"] = row_dict["is_owner"]
                content_list.append(Content(**row_dict))

        return content_list, int(total or 0)

    async def record_user_content_view(self, content_id: UUID, viewer_user_id: str) -> None:
        """Track a file open/preview for the current user (Content Manager view history)."""
        await self.get_content(content_id, viewer_user_id, check_permissions=True)
        uid = str(viewer_user_id).strip()
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO content_user_file_views (user_id, content_id, view_count, last_viewed_at, updated_at)
                VALUES ($1::uuid, $2::uuid, 1, NOW(), NOW())
                ON CONFLICT (user_id, content_id) DO UPDATE SET
                    view_count = content_user_file_views.view_count + 1,
                    last_viewed_at = NOW(),
                    updated_at = NOW()
                """,
                uid,
                content_id,
            )

    async def list_user_view_history(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        """Recent file views for the user with unified_content metadata."""
        limit = min(limit, 200)
        uid = str(user_id).strip()
        gaf_clause = f"(COALESCE(uc.sub_type, '') <> '{CONTENT_SUBTYPE_GAF_CHAT_VOICE}')"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT
{SQL_UNIFIED_CONTENT_UC_LIST_SELECT},
                       v.view_count, v.last_viewed_at
                FROM content_user_file_views v
                INNER JOIN unified_content uc ON uc.id = v.content_id
                WHERE (v.user_id)::text = $1
                  AND uc.deleted_at IS NULL
                  AND coalesce(uc.storage_integrity_status, '') <> 'broken_quarantined'
                  AND {gaf_clause}
                ORDER BY v.last_viewed_at DESC
                LIMIT $2
                """,  # noqa: S608
                uid,
                limit,
            )

        out: list[dict[str, Any]] = []
        for row in rows:
            row_dict = dict(row)
            view_count = int(row_dict.pop("view_count", 0) or 0)
            last_viewed = row_dict.pop("last_viewed_at", None)
            if isinstance(row_dict.get("metadata"), str):
                row_dict["metadata"] = json.loads(row_dict["metadata"])
            normalize_row_mime(row_dict)
            is_owner = str(row_dict.get("user_id")) == str(user_id)
            row_dict["is_owner"] = is_owner
            row_dict["can_edit"] = is_owner
            row_dict["can_delete"] = is_owner
            content = Content(**row_dict)
            last_iso = last_viewed.isoformat() if last_viewed is not None else None
            out.append(
                {
                    "content": content,
                    "view_count": view_count,
                    "last_viewed_at": last_iso,
                }
            )
        return out

    async def clear_user_view_history(self, user_id: str) -> None:
        uid = str(user_id).strip()
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM content_user_file_views WHERE (user_id)::text = $1",
                uid,
            )

    async def list_manager_activity(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        return await self.audit_logger.list_activity_feed(user_id, limit)

    async def get_content_batch(
        self, content_ids: list[UUID], user_id: str, check_permissions: bool = True
    ) -> dict[str, Content]:
        """
        Get multiple content items by IDs with permission check

        Batch version of get_content for efficient multi-file retrieval.
        Returns a dict mapping content_id -> Content object.

        Args:
            content_ids: List of content UUIDs
            user_id: User ID (from auth)
            check_permissions: Whether to check access permissions

        Returns:
            (dict[str, Any]) mapping content_id (as string) to Content object
            Only includes items user has access to

        Example:
            >>> ids = [uuid1, uuid2, uuid3]
            >>> result = await service.get_content_batch(ids, user.id)
            >>> {
            >>>     "uuid1": Content(...),
            >>>     "uuid2": Content(...),
            >>>     # uuid3 not included (access denied)
            >>> }
        """
        if not content_ids:
            return {}

        async with self.db_pool.acquire() as conn:
            # Fetch all requested content items
            rows = await conn.fetch(
                f"""
                SELECT
{SQL_UNIFIED_CONTENT_LIST_COLUMNS}
                FROM unified_content
                WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
                  AND coalesce(storage_integrity_status, '') <> 'broken_quarantined'
                """,
                content_ids,
            )

            if not rows:
                return {}

            shared_ids, friend_ids = await prefetch_acl_sets_for_rows(conn, rows, user_id)
            result: dict[str, Content] = {}
            project_vault_cache: dict[UUID, bool] = {}
            allowed_dicts: list[dict[str, Any]] = []

            for row in rows:
                if check_permissions and not content_accessible_with_prefetch(
                    row,
                    user_id,
                    shared_content_ids=shared_ids,
                    mutual_friend_owner_ids=friend_ids,
                ):
                    continue
                row_dict = dict(row)
                if isinstance(row_dict.get("metadata"), str):
                    row_dict["metadata"] = json.loads(row_dict["metadata"])
                normalize_row_mime(row_dict)
                allowed_dicts.append(row_dict)

            await self._apply_rows_delete_permissions(
                conn,
                allowed_dicts,
                user_id,
                project_vault_active_cache=project_vault_cache,
                shared_content_ids=shared_ids,
                mutual_friend_owner_ids=friend_ids,
            )
            for row_dict in allowed_dicts:
                result[str(row_dict["id"])] = Content(**row_dict)

            return result
