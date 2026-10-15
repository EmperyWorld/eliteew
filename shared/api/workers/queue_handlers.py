#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# RabbitMQ task handlers invoked by `api/workers/queue_worker.py` (UGS, EWRP, BI, site runtime, etc.).
# Invariants:
# - `ugs_generation` requires a non-empty `request_id` (see ``ugs_queue_validation.parse_ugs_generation_request_id``).
# - Optional diagnostic logging for UGS is env-gated (`QUEUE_WORKER_LOG_UGS_HANDLER`).
# - `unified_content_process` with processor `processing_status=failed` acks (no raise/retry/DLQ).
# Related:
# - api/workers/ugs_queue_validation.py
# - api/services/ugs/unified_generation_service.py (process_queued_request)
# - api/core/async_utils.py (indexing visibility A-08)
# ---
"""Queue task handlers used by RabbitMQ worker processes."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any
from uuid import UUID

import aiohttp  # type: ignore[import-untyped]
from sqlalchemy import text  # type: ignore[import-not-found]

from api.core.async_utils import (
    await_tracked_background_task,
    correlation_id_from_queue_payload,
)
from api.core.database_manager import (
    get_asyncpg_pool,
    get_database_manager,
    get_elasticsearch_client,
)
from api.core.http_clients import init_http_clients
from api.models.database_models import TelegramNotification
from api.models.transcription import Transcription
from api.schemas.notifications import NotificationCreate
from api.services.notification_service import get_notification_service
from api.services.queue_features import merge_metadata, utcnow_naive
from api.services.site_studio_lifecycle_jobs import (
    mark_lifecycle_job_failed,
    mark_lifecycle_job_running,
    mark_lifecycle_job_succeeded,
    record_worker_heartbeat,
)
from api.services.site_studio_runtime_service import (
    execute_site_studio_runtime_task,
    get_site_studio_runtime_manager,
)
from api.workers.ugs_queue_validation import parse_ugs_generation_request_id

logger = logging.getLogger(__name__)


async def _get_ugs_service(db: Any) -> Any:  # noqa: ANN401
    from api.services.ugs.unified_generation_service import UnifiedGenerationService

    content_service = None
    try:
        from api.routers.unified_content import get_content_service

        content_service = await get_content_service()
    except Exception:
        content_service = None
    return UnifiedGenerationService(db, content_service=content_service)


async def handle_ugs_generation(payload: dict[str, Any]) -> None:
    request_id = parse_ugs_generation_request_id(payload)
    if os.environ.get("QUEUE_WORKER_LOG_UGS_HANDLER", "").strip().lower() in {"1", "true", "yes", "on"}:
        logger.info(
            "ugs_generation handler entered request_id=%s attempt=%s",
            request_id,
            payload.get("attempt"),
        )
    manager = await get_database_manager()
    async with manager.get_postgres_session() as db, await _get_ugs_service(db) as service:
        await service.process_queued_request(request_id)


async def handle_music_batch_approach(payload: dict[str, Any]) -> None:
    from api.services.music_batch_tests import MusicBatchTestService, enqueue_music_batch_approach

    approach_id = str(payload["approach_id"])
    user_id = str(payload["user_id"])
    manager = await get_database_manager()
    async with manager.get_postgres_session() as db, await _get_ugs_service(db) as ugs:
        content_service = getattr(ugs, "_content_service", None)
        if content_service is None:
            from api.routers.unified_content import get_content_service

            content_service = await get_content_service()
        service = MusicBatchTestService(db)
        should_requeue = await service.process_next_row(
            approach_id=approach_id,
            user_id=user_id,
            content_service=content_service,
            ugs=ugs,
        )
    if should_requeue:
        await enqueue_music_batch_approach(approach_id, user_id)


async def handle_ewrp_generation(payload: dict[str, Any]) -> None:
    from api.routers.ewrp import _run_ewrp_pipeline

    await _run_ewrp_pipeline(str(payload["job_id"]), str(payload["user_id"]))


async def handle_bi_generation(payload: dict[str, Any]) -> None:
    from api.routers.business_intelligence import _run_generation, get_services

    services = await get_services()
    await _run_generation(
        session_id=str(payload["session_id"]),
        user_id=str(payload["user_id"]),
        documents=list(payload.get("documents") or []),
        analysis_types=list(payload.get("analysis_types") or []),
        output_formats=list(payload.get("output_formats") or []),
        settings=dict(payload.get("settings") or {}),
        context=payload.get("context"),
        services=services,
    )


async def _load_unified_content_blob(content_id: UUID) -> tuple[str, bytes, str, str]:
    from api.services.unified_content.storage_backends.minio_storage import SeaweedFSStorage

    manager = await get_database_manager()
    async with manager.get_postgres_session() as db:
        row = (
            (
                await db.execute(
                    text(
                        """
                    SELECT content_type, mime_type, name, file_path, storage_backend, file_data
                    FROM unified_content
                    WHERE id = :content_id
                    """
                    ),
                    {"content_id": str(content_id)},
                )
            )
            .mappings()
            .first()
        )
        if not row:
            raise ValueError(f"Content {content_id} not found")

        storage_backend = (row["storage_backend"] or "postgresql").lower()
        file_data = row["file_data"]
        if storage_backend in {"minio", "seaweedfs"}:
            storage = SeaweedFSStorage()
            file_data = await storage.retrieve(row["file_path"] or "", content_id)
        if not file_data:
            raise ValueError(f"Content {content_id} has no stored file data")
        return (
            str(row["content_type"] or "other"),
            bytes(file_data),
            str(row["name"] or content_id),
            str(row["mime_type"] or "application/octet-stream"),
        )


async def _index_unified_content_elasticsearch(content_id: UUID, db_pool: Any) -> None:  # noqa: ANN401
    from api.services.unified_content.content_search_service import ContentSearchService

    es_client = get_elasticsearch_client()
    search_service = ContentSearchService(es_client, db_pool)
    async with db_pool.acquire() as conn:
        user_id = await conn.fetchval(
            "SELECT user_id FROM unified_content WHERE id = $1",
            content_id,
        )
    if user_id:
        await search_service.index_content(content_id, user_id)


async def _index_unified_content_marketing_rag(content_id: UUID, db_pool: Any) -> None:  # noqa: ANN401
    from api.services.marketing_project_rag_service import index_unified_content_marketing_rag

    await index_unified_content_marketing_rag(db_pool, content_id)


async def _index_unified_content_qdrant(content_id: UUID, db_pool: Any) -> None:  # noqa: ANN401
    from api.services.unified_content.unified_content_qdrant_service import (
        index_unified_content_qdrant,
        reindex_desktop_chat_attachments_for_content,
    )

    await index_unified_content_qdrant(db_pool, content_id)
    await reindex_desktop_chat_attachments_for_content(db_pool, content_id)


async def handle_unified_content_processing(payload: dict[str, Any]) -> None:
    from api.services.unified_content.processors.factory import ProcessorFactory

    content_id = UUID(str(payload["content_id"]))
    correlation_id = correlation_id_from_queue_payload(payload)
    track_meta = {
        "content_id": str(content_id),
        "queue_task": "unified_content_process",
    }
    content_type, file_data, filename, mime_type = await _load_unified_content_blob(content_id)
    db_pool = await get_asyncpg_pool()
    processor_factory = ProcessorFactory(db_pool)
    result = await processor_factory.process_content(
        content_id=content_id,
        content_type=content_type,
        file_data=file_data,
        filename=filename,
        mime_type=mime_type,
        use_ocr=bool(payload.get("use_ocr", False)),
    )

    # Permanent processor failure is already persisted on unified_content —
    # ack the message; do not raise (avoids retry → documents.*.dlq poison).
    if result and result.get("processing_status") == "failed":
        logger.warning(
            "[STEP] unified_content_process_failed_ack content_id=%s error=%s",
            content_id,
            str(result.get("processing_error") or result)[:400],
        )
        return

    await await_tracked_background_task(
        _index_unified_content_elasticsearch(content_id, db_pool),
        name="unified_content_es_index",
        correlation_id=correlation_id,
        metadata={**track_meta, "index_target": "elasticsearch"},
        swallow_errors=True,
    )

    await await_tracked_background_task(
        _index_unified_content_marketing_rag(content_id, db_pool),
        name="unified_content_marketing_rag_index",
        correlation_id=correlation_id,
        metadata={**track_meta, "index_target": "marketing_rag"},
        swallow_errors=True,
    )

    await await_tracked_background_task(
        _index_unified_content_qdrant(content_id, db_pool),
        name="unified_content_qdrant_index",
        correlation_id=correlation_id,
        metadata={**track_meta, "index_target": "qdrant"},
        swallow_errors=True,
    )


async def handle_chat_session_document_index(payload: dict[str, Any]) -> None:
    from api.services.chat_knowledge_base_service import run_indexing

    await run_indexing(
        str(payload["session_id"]),
        str(payload["document_id"]),
        str(payload["user_id"]),
    )


async def handle_voice_transcription(payload: dict[str, Any]) -> None:
    from api.services.voice_gateway_service import transcribe_audio as gateway_transcribe_audio

    transcription_id = UUID(str(payload["transcription_id"]))
    manager = await get_database_manager()
    async with manager.get_postgres_session() as db:
        transcription = await db.get(Transcription, transcription_id)
        if transcription is None:
            raise ValueError(f"Transcription {transcription_id} not found")

        trans_row: Any = transcription
        raw_meta = trans_row.meta_data
        metadata = dict(raw_meta) if isinstance(raw_meta, dict) else {}
        source_path = metadata.get("source_file_path")
        if not source_path:
            raise ValueError("source_file_path not found in transcription metadata")

        audio_bytes = Path(str(source_path)).read_bytes()
        trans_row.meta_data = merge_metadata(
            trans_row.meta_data,
            queue_status="processing",
            worker_started_at=utcnow_naive().isoformat(),
        )
        await db.commit()

        try:
            result = await gateway_transcribe_audio(
                audio_bytes,
                language=payload.get("language"),
                model=payload.get("model"),
            )
            completed_at = utcnow_naive()
            trans_row.transcription_text = str(result.get("text") or "")
            trans_row.language = str(result.get("language") or payload.get("language") or "unknown")
            trans_row.confidence_score = float(result.get("confidence") or 0.0)
            trans_row.segments = result.get("segments") or []
            trans_row.processing_time_ms = int(result.get("duration_ms") or 0)
            trans_row.status = "completed"
            trans_row.error_message = None
            trans_row.completed_at = completed_at
            trans_row.word_count = len((trans_row.transcription_text or "").split())
            trans_row.character_count = len(trans_row.transcription_text or "")
            trans_row.meta_data = merge_metadata(
                trans_row.meta_data,
                queue_status="completed",
                processing_completed_at=completed_at.isoformat(),
                task_id=str(transcription_id),
            )
            await db.commit()
        except Exception as exc:
            trans_row.status = "failed"
            trans_row.error_message = str(exc)[:2000]
            trans_row.meta_data = merge_metadata(
                trans_row.meta_data,
                queue_status="failed",
                processing_completed_at=utcnow_naive().isoformat(),
            )
            await db.commit()
            raise


async def handle_notification_delivery(payload: dict[str, Any]) -> None:
    channel = str(payload.get("channel") or "in_app").lower()
    user_id = payload.get("user_id")
    if channel == "in_app":
        notification_data = payload.get("notification") or {}
        await get_notification_service().send_to_user(
            str(user_id),
            NotificationCreate(**notification_data),
        )
        return

    if channel != "telegram":
        raise ValueError(f"Unsupported notification channel: {channel}")

    manager = await get_database_manager()
    async with manager.get_postgres_session() as db:
        record = TelegramNotification(
            user_id=user_id,
            telegram_user_id=payload.get("telegram_user_id"),
            chat_id=payload.get("chat_id"),
            message_text=str(payload.get("message_text") or payload.get("text") or ""),
            message_type=str(payload.get("message_type") or "text"),
            media_url=payload.get("media_url"),
            priority=int(payload.get("priority") or 5),
            status="pending",
            retry_count=int(payload.get("attempt") or 0),
        )
        db.add(record)
        await db.flush()

        token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        if not token or not record.chat_id:
            record.status = "failed"  # type: ignore[assignment]
            record.error_message = "Telegram is not configured"  # type: ignore[assignment]
            await db.commit()
            return

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload_data = {"chat_id": record.chat_id, "text": record.message_text}
        try:
            async with (
                aiohttp.ClientSession() as session,
                session.post(url, json=payload_data, timeout=aiohttp.ClientTimeout(total=20)) as response,
            ):
                response.raise_for_status()
                record.status = "sent"  # type: ignore[assignment]
                record.sent_at = utcnow_naive()  # type: ignore[assignment]
                await db.commit()
        except Exception as exc:
            record.status = "failed"  # type: ignore[assignment]
            record.error_message = str(exc)[:2000]  # type: ignore[assignment]
            await db.commit()
            raise


async def handle_site_studio_runtime(payload: dict[str, Any]) -> None:
    instance_id = UUID(str(payload["instance_id"]))
    task_type = str(payload["task_type"])
    await execute_site_studio_runtime_task(
        instance_id,
        task_type,
        instance_scope=str(payload.get("instance_scope") or "user"),
        job_id=payload.get("job_id"),
    )


async def handle_site_studio_destroy(payload: dict[str, Any]) -> None:
    instance_id = UUID(str(payload["instance_id"]))
    instance_scope = str(payload.get("instance_scope") or "user")
    preserve = bool(payload.get("preserve_runtime_data", False))
    job_id = payload.get("job_id")

    from api.models.desktop import ProjectSiteInstance, UserSiteInstance

    await init_http_clients()
    runtime_manager = get_site_studio_runtime_manager()
    db_manager = await get_database_manager()

    async with db_manager.get_postgres_session() as db:
        instance: UserSiteInstance | ProjectSiteInstance | None
        if instance_scope == "project":
            instance = await db.get(ProjectSiteInstance, instance_id)
        else:
            instance = await db.get(UserSiteInstance, instance_id)
        if instance is None:
            return
        worker_id = await record_worker_heartbeat(
            db,
            metadata={
                "task_type": "site_studio_destroy",
                "instance_scope": instance_scope,
            },
        )
        await mark_lifecycle_job_running(db, job_id, worker_id=worker_id, stage="destroy_started")
        await db.commit()
        logger.info(
            "Site Studio destroy task started slug=%s instance_id=%s scope=%s preserve_runtime_data=%s",
            instance.site_slug,
            instance.id,
            instance_scope,
            preserve,
        )
        try:
            async with runtime_manager.runtime_operation_lock(instance):
                runtime_manager.invalidate_admin_token(instance)
                await runtime_manager.destroy(instance, preserve_runtime_data=preserve)
            await mark_lifecycle_job_succeeded(db, job_id, stage="destroyed")
            await db.delete(instance)
            await db.commit()
            logger.info(
                "Site Studio destroy task succeeded slug=%s instance_id=%s scope=%s",
                instance.site_slug,
                instance.id,
                instance_scope,
            )
        except Exception:
            await db.rollback()
            await mark_lifecycle_job_failed(
                db,
                job_id,
                stage="destroy_failed",
                error="Site Studio destroy task failed",
            )
            await db.commit()
            logger.exception(
                "Site Studio destroy task failed slug=%s instance_id=%s scope=%s preserve_runtime_data=%s",
                instance.site_slug,
                instance.id,
                instance_scope,
                preserve,
            )
            raise


async def handle_site_studio_edge(payload: dict[str, Any]) -> None:
    from api.services.site_studio_edge_carrier import execute_site_studio_edge_task

    instance_id = UUID(str(payload["instance_id"]))
    task_type = str(payload["task_type"])
    await execute_site_studio_edge_task(
        instance_id,
        task_type,
        instance_scope=str(payload.get("instance_scope") or "user"),
        job_id=payload.get("job_id"),
    )


TASK_HANDLERS: dict[str, Any] = {
    "ugs_generation": handle_ugs_generation,
    "music_batch_approach": handle_music_batch_approach,
    "ewrp_generate": handle_ewrp_generation,
    "bi_generation": handle_bi_generation,
    "unified_content_process": handle_unified_content_processing,
    "chat_session_document_index": handle_chat_session_document_index,
    "voice_transcription": handle_voice_transcription,
    "notification_delivery": handle_notification_delivery,
    "site_studio_provision": handle_site_studio_runtime,
    "site_studio_start": handle_site_studio_runtime,
    "site_studio_stop": handle_site_studio_runtime,
    "site_studio_redeploy": handle_site_studio_runtime,
    "site_studio_destroy": handle_site_studio_destroy,
    "site_studio_edge_publish": handle_site_studio_edge,
    "site_studio_edge_unpublish": handle_site_studio_edge,
}
