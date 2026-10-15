"""
🔥 UGS STREAMING SERVICE - Real-time Generation Streaming 🔥

WebSocket-based streaming for long-running AI generations:
1. Progress updates
2. Content chunks streaming
3. Error handling
4. Cancellation support

Created: 2025-11-13
Version: 1.0.0
"""

import logging
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)


class StreamEventType(StrEnum):
    """Types of streaming events"""

    PROGRESS = "progress"
    CHUNK = "chunk"
    COMPLETE = "complete"
    ERROR = "error"
    CANCELLED = "cancelled"


class StreamEvent:
    """Streaming event"""

    def __init__(self, event_type: StreamEventType, data: dict[str, Any]):
        self.type = event_type
        self.data = data
        self.timestamp = datetime.now(UTC)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {"type": self.type.value, "data": self.data, "timestamp": self.timestamp.isoformat()}


class UGSStreamingService:
    """
    🔥 UGS STREAMING SERVICE 🔥

    Manages real-time streaming for UGS generations
    """

    def __init__(self) -> None:
        """Initialize streaming service"""
        self.active_streams: dict[str, dict[str, bool]] = {}  # task_id -> cancellation_token

    async def stream_generation(
        self, task_id: str, generation_func: AsyncGenerator[dict[str, Any]]
    ) -> AsyncGenerator[StreamEvent]:
        """
        Stream generation results in real-time

        Args:
            task_id: Task UUID
            generation_func: Async generator that yields generation updates

        Yields:
            StreamEvent objects with progress/chunks/completion
        """

        # Register stream
        cancellation_token = {"cancelled": False}
        self.active_streams[task_id] = cancellation_token

        try:
            logger.info("🌊 Starting stream for task %s", task_id)

            # Initialize
            yield StreamEvent(
                StreamEventType.PROGRESS,
                {"status": "initializing", "percent": 0, "message": "Preparing generation..."},
            )

            # Stream generation
            chunk_count = 0

            async for update in generation_func:
                # Check cancellation
                if cancellation_token.get("cancelled"):
                    logger.info("Stream %s cancelled by user", task_id)
                    yield StreamEvent(StreamEventType.CANCELLED, {"message": "Generation cancelled by user"})
                    break

                # Determine event type from update
                if "error" in update:
                    yield StreamEvent(StreamEventType.ERROR, {"error": update["error"]})
                    break

                elif "content" in update or "chunk" in update:
                    chunk_count += 1
                    yield StreamEvent(
                        StreamEventType.CHUNK,
                        {
                            "content": update.get("content") or update.get("chunk"),
                            "tokens": update.get("tokens", 0),
                            "chunk_number": chunk_count,
                        },
                    )

                elif "progress" in update or "percent" in update:
                    yield StreamEvent(
                        StreamEventType.PROGRESS,
                        {
                            "status": update.get("status", "processing"),
                            "percent": update.get("percent") or update.get("progress", 0),
                            "message": update.get("message", ""),
                        },
                    )

                elif update.get("done") or update.get("completed"):
                    yield StreamEvent(
                        StreamEventType.COMPLETE,
                        {
                            "result": update.get("result", {}),
                            "total_chunks": chunk_count,
                            "message": "Generation completed successfully",
                        },
                    )
                    break

            logger.info("Stream %s completed with %s chunks", task_id, chunk_count)

        except Exception as e:
            logger.exception("Stream %s error", task_id)
            yield StreamEvent(StreamEventType.ERROR, {"error": str(e)})

        finally:
            # Cleanup
            if task_id in self.active_streams:
                del self.active_streams[task_id]

    async def cancel_stream(self, task_id: str) -> bool:
        """
        Cancel an active stream

        Args:
            task_id: Task UUID to cancel

        Returns:
            True if cancelled, False if not found
        """

        if task_id in self.active_streams:
            self.active_streams[task_id]["cancelled"] = True
            logger.info("Cancelled stream %s", task_id)
            return True

        logger.warning("Stream %s not found for cancellation", task_id)
        return False

    def is_streaming(self, task_id: str) -> bool:
        """Check if task is currently streaming"""
        return task_id in self.active_streams

    def get_active_streams(self) -> list[str]:
        """Get list of active stream task IDs"""
        return list(self.active_streams.keys())


# Global instance - using class to avoid PLW0603
class _StreamingServiceState:
    """State holder for streaming service singleton."""

    instance: UGSStreamingService | None = None


_streaming_service_state = _StreamingServiceState()


def get_streaming_service() -> UGSStreamingService:
    """Get or create global streaming service instance"""
    if _streaming_service_state.instance is None:
        _streaming_service_state.instance = UGSStreamingService()

    return _streaming_service_state.instance
