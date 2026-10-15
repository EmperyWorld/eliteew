#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build streamed ZIP archives for Unified Content download flows without retaining the final archive in memory.
# Invariants:
# - File fetch concurrency is bounded and ZIP compression is offloaded from the request event loop.
# - Temporary archive files are removed after the response stream closes or when archive creation fails.
# Related:
# - api/routers/unified_content.py
# - api/services/unified_content/content_storage_service.py
# ---
"""Archive service for Unified Content batch/owned ZIP downloads."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import tempfile
import zipfile
from collections.abc import Iterator
from typing import cast
from uuid import UUID

from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]

from api.schemas.unified_content import Content
from api.services.unified_content.content_storage_service import ContentStorageService
from api.utils.blocking import run_blocking_work
from api.utils.content_download_filename import (
    build_content_disposition_filename,
    display_name_for_content_download,
)

logger = logging.getLogger(__name__)


class ContentArchiveService:
    """Memory-safe archive builder that streams from a temporary file."""

    def __init__(self, storage_service: ContentStorageService, *, concurrency: int = 4):
        self._storage = storage_service
        self._concurrency = max(1, concurrency)

    async def _fetch_archive_payload(self, content: Content) -> tuple[Content, bytes | None]:
        if content.storage_backend is None:
            return content, None

        backend = self._storage.storage_factory.get_backend_by_name(content.storage_backend.value)
        try:
            file_data = await backend.retrieve(
                content.file_path or "",
                cast(UUID, content.id),
                fail_fast=True,
            )
        except Exception as exc:
            logger.debug(
                "[STEP] content_archive_retrieve_skip content_id=%s err=%s",
                content.id,
                exc,
            )
            return content, None
        if not file_data:
            return content, None
        return content, file_data

    async def create_archive_response(
        self,
        *,
        contents: list[Content],
        archive_name: str,
        user_id: str,
        audit_action: str,
        skipped_count: int = 0,
    ) -> tuple[StreamingResponse, int, int]:
        added_count = 0
        skipped_total = skipped_count
        existing_names: set[str] = set()
        pending_contents = iter(contents)
        active_tasks: set[asyncio.Task[tuple[Content, bytes | None]]] = set()

        def schedule_next() -> None:
            try:
                next_content = next(pending_contents)
            except StopIteration:
                return
            active_tasks.add(asyncio.create_task(self._fetch_archive_payload(next_content)))

        with tempfile.NamedTemporaryFile(
            mode="w+b",
            suffix=".zip",
            prefix="content-archive-",
            delete=False,
        ) as zip_tmp:
            zip_tmp_path = zip_tmp.name
            with zipfile.ZipFile(zip_tmp, "w", zipfile.ZIP_DEFLATED) as zip_file:
                for _ in range(min(self._concurrency, len(contents))):
                    schedule_next()

                while active_tasks:
                    done, active_tasks = await asyncio.wait(
                        active_tasks,
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    for task in done:
                        schedule_next()
                        content, file_data = await task
                        if not file_data:
                            skipped_total += 1
                            continue

                        filename = build_content_disposition_filename(
                            display_name_for_content_download(content.title, content.name),
                            content.original_filename,
                        )
                        if not filename or filename == "download":
                            filename = str(content.id)
                        if filename in existing_names:
                            name_parts = filename.rsplit(".", 1)
                            duplicate_index = max(1, added_count)
                            candidate = (
                                f"{name_parts[0]}_{duplicate_index}.{name_parts[1]}"
                                if len(name_parts) == 2
                                else f"{filename}_{duplicate_index}"
                            )
                            while candidate in existing_names:
                                duplicate_index += 1
                                candidate = (
                                    f"{name_parts[0]}_{duplicate_index}.{name_parts[1]}"
                                    if len(name_parts) == 2
                                    else f"{filename}_{duplicate_index}"
                                )
                            filename = candidate

                        existing_names.add(filename)
                        await run_blocking_work(zip_file.writestr, filename, file_data, blocking_timeout=30.0)
                        added_count += 1

                        await self._storage.audit_logger.log(
                            content_id=cast(UUID, content.id),
                            user_id=user_id,
                            action=audit_action,
                            details={"file_size": len(file_data), "archive_name": archive_name},
                        )

        if added_count == 0:
            with contextlib.suppress(OSError):
                os.remove(zip_tmp_path)
            raise ValueError("No accessible files found")

        total_size = os.path.getsize(zip_tmp_path)

        def zip_file_stream(path: str, chunk_size: int = 64 * 1024) -> Iterator[bytes]:
            try:
                with open(path, "rb") as source:
                    while True:
                        chunk = source.read(chunk_size)
                        if not chunk:
                            break
                        yield chunk
            finally:
                with contextlib.suppress(OSError):
                    os.remove(path)

        return (
            StreamingResponse(
                zip_file_stream(zip_tmp_path),
                media_type="application/zip",
                headers={
                    "Content-Disposition": f'attachment; filename="{archive_name}"',
                    "Content-Length": str(total_size),
                },
            ),
            added_count,
            skipped_total,
        )
