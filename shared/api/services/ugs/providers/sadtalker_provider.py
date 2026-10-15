#!/usr/bin/env python3
"""
SadTalker Provider Integration
Phase 2 - Provider Integration
SadTalker: Audio-driven talking head animation
"""

import logging
from datetime import UTC, datetime
from typing import Any

import aiohttp  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class SadTalkerProvider:
    """SadTalker talking head animation integration"""

    def __init__(self, base_url: str = "http://stack2-sadtalker:31008"):
        self.base_url = base_url.rstrip("/")
        self.session: aiohttp.ClientSession | None = None

    async def initialize(self) -> None:
        """Initialize the provider"""
        self.session = aiohttp.ClientSession()
        logger.info("SadTalkerProvider initialized with base_url: %s", self.base_url)

    async def close(self) -> None:
        """Close connections"""
        if self.session:
            await self.session.close()

    async def health_check(self) -> bool:
        """Check if SadTalker is healthy"""
        if not self.session:
            return False

        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with self.session.get(f"{self.base_url}/health", timeout=timeout) as response:
                return response.status == 200
        except Exception as e:
            logger.warning("SadTalker health check failed: %s", e)
            return False

    async def animate_avatar(
        self,
        source_image: str,  # base64 encoded face image
        audio: str,  # base64 encoded audio
        pose_style: int = 0,  # 0-46 pose styles
        expression_scale: float = 1.0,
        **kwargs,
    ) -> dict[str, Any]:
        """
        Create talking head animation from image and audio

        Args:
            source_image: Base64 encoded face image
            audio: Base64 encoded audio file
            pose_style: Predefined pose style (0-46)
            expression_scale: Expression intensity (0-1)
        """
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        payload = {
            "source_image": source_image,
            "audio": audio,
            "pose_style": pose_style,
            "expression_scale": expression_scale,
            "task": "animate",
            **kwargs,
        }

        try:
            logger.info("Creating avatar animation with SadTalker (pose_style: %s)", pose_style)

            async with self.session.post(
                f"{self.base_url}/animate",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=600),  # 10 minutes for video generation
            ) as response:
                response.raise_for_status()
                result = await response.json()

                return {
                    "provider": "sadtalker",
                    "operation": "avatar_animation",
                    "output_video": result.get("video"),
                    "pose_style": pose_style,
                    "expression_scale": expression_scale,
                    "processing_time": result.get("processing_time"),
                    "timestamp": datetime.now(UTC).isoformat(),
                }

        except Exception:
            logger.exception("SadTalker animation failed: ")
            raise

    async def lip_sync_only(
        self,
        source_image: str,  # base64 encoded face image
        audio: str,  # base64 encoded audio
        **kwargs,
    ) -> dict[str, Any]:
        """
        Perform lip sync without full head animation

        Args:
            source_image: Base64 encoded face image
            audio: Base64 encoded audio file
        """
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        payload = {"source_image": source_image, "audio": audio, "task": "lip_sync", **kwargs}

        try:
            logger.info("Creating lip sync animation with SadTalker")

            async with self.session.post(
                f"{self.base_url}/lip_sync", json=payload, timeout=aiohttp.ClientTimeout(total=300)
            ) as response:
                response.raise_for_status()
                result = await response.json()

                return {
                    "provider": "sadtalker",
                    "operation": "lip_sync",
                    "output_video": result.get("video"),
                    "processing_time": result.get("processing_time"),
                    "timestamp": datetime.now(UTC).isoformat(),
                }

        except Exception:
            logger.exception("SadTalker lip sync failed: ")
            raise

    async def get_pose_styles(self) -> list[dict[str, Any]]:
        """Get available pose styles"""
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        try:
            async with self.session.get(f"{self.base_url}/pose_styles") as response:
                response.raise_for_status()
                styles_data = await response.json()
                return (
                    list(styles_data)
                    if isinstance(styles_data, list)
                    else [{"id": i, "name": f"Style {i}"} for i in range(47)]
                )
        except Exception:
            logger.exception("Failed to get SadTalker pose styles: ")
            return [{"id": i, "name": f"Style {i}"} for i in range(47)]

    async def preprocess_face(self, image: str) -> dict[str, Any]:
        """Preprocess face image for better animation results"""
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        payload = {"image": image, "task": "preprocess"}

        try:
            logger.info("Preprocessing face image for SadTalker")

            async with self.session.post(
                f"{self.base_url}/preprocess", json=payload, timeout=aiohttp.ClientTimeout(total=60)
            ) as response:
                response.raise_for_status()
                result = await response.json()

                return {
                    "provider": "sadtalker",
                    "operation": "preprocess",
                    "processed_image": result.get("image"),
                    "face_detected": result.get("face_detected", False),
                    "landmarks": result.get("landmarks"),
                    "timestamp": datetime.now(UTC).isoformat(),
                }

        except Exception:
            logger.exception("SadTalker preprocessing failed: ")
            raise
