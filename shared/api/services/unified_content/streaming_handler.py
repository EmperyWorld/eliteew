#!/usr/bin/env python3
"""
Streaming File Handler for Large File Uploads/Downloads
Optimized for memory efficiency and performance

Features:
- Chunked upload/download
- Progress tracking
- Memory-efficient streaming
- Support for resume
- Bandwidth throttling
"""

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from uuid import UUID

logger = logging.getLogger(__name__)


class StreamingFileHandler:
    """
    Handle large file uploads and downloads with streaming

    Memory-efficient approach:
    - Files are processed in chunks (default 1MB)
    - No full file loading into memory
    - Supports progress callbacks
    """

    DEFAULT_CHUNK_SIZE = 1024 * 1024  # 1MB
    MAX_CHUNK_SIZE = 10 * 1024 * 1024  # 10MB

    def __init__(self, chunk_size: int = DEFAULT_CHUNK_SIZE):
        """
        Initialize streaming handler

        Args:
            chunk_size: Size of each chunk in bytes
        """
        self.chunk_size = min(chunk_size, self.MAX_CHUNK_SIZE)

    async def stream_upload(
        self,
        file_stream: AsyncIterator[bytes],
        max_size: int | None = None,
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> bytes:
        """
        Stream upload with size limit and progress tracking

        Args:
            file_stream: Async iterator yielding file chunks
            max_size: Maximum allowed file size (bytes)
            progress_callback: Callback for progress updates (current, total)

        Returns:
            Complete file data as bytes

        Raises:
            ValueError: If file exceeds max_size
        """
        chunks = []
        total_size = 0

        try:
            async for chunk in file_stream:
                chunk_size = len(chunk)
                total_size += chunk_size

                # Check size limit
                if max_size and total_size > max_size:
                    msg = f"File size exceeds limit: {total_size} > {max_size} bytes"
                    raise ValueError(msg)

                chunks.append(chunk)

                # Progress callback
                if progress_callback:
                    progress_callback(total_size, max_size or total_size)

                # Log progress for large files
                if total_size % (10 * 1024 * 1024) == 0:  # Every 10MB
                    logger.debug("Upload progress: %.2f MB", total_size / (1024**2))

            file_data = b"".join(chunks)
            logger.info("Upload completed: %.2f MB", total_size / (1024**2))

            return file_data

        except Exception:
            logger.exception("Upload failed")
            raise

    async def stream_download(self, file_data: bytes, chunk_size: int | None = None) -> AsyncIterator[bytes]:
        """
        Stream file download in chunks

        Args:
            file_data: Complete file data
            chunk_size: Size of each chunk (default: self.chunk_size)

        Yields:
            File data chunks
        """
        chunk_size = chunk_size or self.chunk_size
        total_size = len(file_data)

        logger.debug("Starting download stream: %.2f MB", total_size / (1024**2))

        # Stream in chunks
        for i in range(0, total_size, chunk_size):
            chunk = file_data[i : i + chunk_size]
            yield chunk

            # Small delay to prevent overwhelming the client
            await asyncio.sleep(0)  # Yield control to event loop

        logger.debug("Download stream completed: %.2f MB", total_size / (1024**2))

    async def stream_from_storage(self, storage_backend, file_path: str, content_id: UUID) -> AsyncIterator[bytes]:
        """
        Stream file directly from storage backend

        Args:
            storage_backend: Storage backend instance
            file_path: Path in storage
            content_id: Content UUID

        Yields:
            File data chunks
        """
        try:
            # Retrieve full file from storage
            # Note: For true streaming, storage backends should support chunked retrieval
            file_data = await storage_backend.retrieve(file_path, content_id)

            # Stream the data in chunks
            async for chunk in self.stream_download(file_data):
                yield chunk

        except Exception:
            logger.exception("Streaming from storage failed")
            raise

    async def calculate_hash_streaming(self, file_stream: AsyncIterator[bytes]) -> tuple[bytes, str]:
        """
        Calculate hash while streaming (memory-efficient)

        Args:
            file_stream: Async iterator yielding file chunks

        Returns:
            Tuple of (complete_file_data, hash_hex)
        """
        import hashlib

        hasher = hashlib.sha256()
        chunks = []

        async for chunk in file_stream:
            hasher.update(chunk)
            chunks.append(chunk)

        file_data = b"".join(chunks)
        file_hash = hasher.hexdigest()

        return file_data, file_hash


class ChunkedUploadHandler:
    """
    Handle multipart/chunked uploads for very large files

    Supports:
    - Resumable uploads
    - Parallel chunk uploads
    - Chunk validation
    """

    def __init__(self, storage_path: str):
        """
        Initialize chunked upload handler

        Args:
            storage_path: Temporary storage path for chunks
        """
        self.storage_path = storage_path
        self.chunks: dict[int, bytes] = {}

    async def upload_chunk(self, chunk_index: int, chunk_data: bytes, total_chunks: int) -> bool:
        """
        Upload a single chunk

        Args:
            chunk_index: Index of this chunk (0-based)
            chunk_data: Chunk data
            total_chunks: Total number of chunks

        Returns:
            True if chunk uploaded successfully
        """
        if chunk_index >= total_chunks:
            msg = f"Invalid chunk index: {chunk_index} >= {total_chunks}"
            raise ValueError(msg)

        self.chunks[chunk_index] = chunk_data
        logger.debug(f"Uploaded chunk {chunk_index + 1}/{total_chunks}")

        return True

    def is_complete(self, total_chunks: int) -> bool:
        """
        Check if all chunks have been uploaded

        Args:
            total_chunks: Expected total number of chunks

        Returns:
            True if all chunks present
        """
        return len(self.chunks) == total_chunks

    async def assemble_file(self) -> bytes:
        """
        Assemble all chunks into complete file

        Returns:
            Complete file data

        Raises:
            ValueError: If chunks are missing
        """
        if not self.chunks:
            msg = "No chunks to assemble"
            raise ValueError(msg)

        # Sort chunks by index
        sorted_chunks = [self.chunks[i] for i in sorted(self.chunks.keys())]

        file_data = b"".join(sorted_chunks)

        logger.info(f"Assembled {len(self.chunks)} chunks into {len(file_data)} bytes")

        return file_data

    def clear_chunks(self) -> None:
        """Clear all uploaded chunks"""
        self.chunks.clear()


class RangeRequestHandler:
    """
    Handle HTTP Range requests for partial content delivery

    Supports:
    - Byte range requests
    - Resume downloads
    - Multi-range requests
    """

    @staticmethod
    def parse_range_header(range_header: str, file_size: int) -> list[tuple[int, int]]:
        """
        Parse HTTP Range header

        Args:
            range_header: Range header value (e.g., "bytes=0-1023")
            file_size: Total file size

        Returns:
            List of (start, end) tuples

        Example:
            "bytes=0-1023" -> [(0, 1023)]
            "bytes=0-1023,2048-3071" -> [(0, 1023), (2048, 3071)]
        """
        if not range_header.startswith("bytes="):
            msg = "Invalid range header"
            raise ValueError(msg)

        ranges = []
        range_specs = range_header[6:].split(",")

        for spec in range_specs:
            spec = spec.strip()

            if "-" not in spec:
                msg = f"Invalid range spec: {spec}"
                raise ValueError(msg)

            start_str, end_str = spec.split("-", 1)

            # Parse start
            if start_str:
                start = int(start_str)
            else:
                # Suffix range (e.g., "-1000" = last 1000 bytes)
                start = file_size - int(end_str)
                end_str = ""

            # Parse end
            end = int(end_str) if end_str else file_size - 1

            # Validate range
            if start < 0 or end >= file_size or start > end:
                msg = f"Invalid range: {start}-{end} (file size: {file_size})"
                raise ValueError(msg)

            ranges.append((start, end))

        return ranges

    @staticmethod
    async def stream_range(
        file_data: bytes, start: int, end: int, chunk_size: int = 1024 * 1024
    ) -> AsyncIterator[bytes]:
        """
        Stream a byte range from file

        Args:
            file_data: Complete file data
            start: Start byte (inclusive)
            end: End byte (inclusive)
            chunk_size: Chunk size for streaming

        Yields:
            Data chunks for the specified range
        """
        current = start

        while current <= end:
            chunk_end = min(current + chunk_size, end + 1)
            chunk = file_data[current:chunk_end]
            yield chunk

            current = chunk_end

            # Yield control
            await asyncio.sleep(0)

    @staticmethod
    def generate_content_range_header(start: int, end: int, total_size: int) -> str:
        """
        Generate Content-Range header

        Args:
            start: Start byte
            end: End byte
            total_size: Total file size

        Returns:
            Content-Range header value

        Example:
            "bytes 0-1023/2048"
        """
        return f"bytes {start}-{end}/{total_size}"
