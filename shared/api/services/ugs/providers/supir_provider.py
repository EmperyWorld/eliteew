#!/usr/bin/env python3
"""
SUPIR Provider Integration
Phase 2 - Provider Integration
SUPIR: SUrrogate Priors for Image Restoration
"""

import logging
from datetime import UTC, datetime
from typing import Any

import aiohttp  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class SUPIRProvider:
    """SUPIR upscaling and image enhancement integration"""

    def __init__(self, base_url: str = "http://stack2-supir:31011"):
        self.base_url = base_url.rstrip("/")
        self.session: aiohttp.ClientSession | None = None

    async def initialize(self) -> None:
        """Initialize the provider"""
        self.session = aiohttp.ClientSession()
        logger.info("SUPIRProvider initialized with base_url: %s", self.base_url)

    async def close(self) -> None:
        """Close connections"""
        if self.session:
            await self.session.close()

    async def health_check(self) -> bool:
        """Check if SUPIR is healthy"""
        if not self.session:
            return False

        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with self.session.get(f"{self.base_url}/health", timeout=timeout) as response:
                return response.status == 200
        except Exception as e:
            logger.warning("SUPIR health check failed: %s", e)
            return False

    async def upscale_4k(
        self,
        image: str,  # base64 encoded image
        scale: int = 4,
        model: str = "supir-v0f32",
        **kwargs,
    ) -> dict[str, Any]:
        """
        Upscale image to 4K resolution using SUPIR

        Args:
            image: Base64 encoded input image
            scale: Upscaling factor (2, 3, 4)
            model: SUPIR model to use
        """
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        payload = {"image": image, "scale": scale, "model": model, "task": "upscale", **kwargs}

        try:
            logger.info("Upscaling image with SUPIR to %sx resolution", scale)

            timeout = aiohttp.ClientTimeout(total=600)  # 10 minutes for 4K upscaling
            async with self.session.post(f"{self.base_url}/upscale", json=payload, timeout=timeout) as response:
                response.raise_for_status()
                result = await response.json()

                return {
                    "provider": "supir",
                    "operation": "upscale_4k",
                    "input_scale": scale,
                    "output_image": result.get("image"),
                    "processing_time": result.get("processing_time"),
                    "model_used": model,
                    "timestamp": datetime.now(UTC).isoformat(),
                }

        except Exception:
            logger.exception("SUPIR upscaling failed: ")
            raise

    async def enhance_image(
        self,
        image: str,  # base64 encoded image
        enhancement_type: str = "general",
        **kwargs,
    ) -> dict[str, Any]:
        """
        Enhance image quality using SUPIR

        Args:
            image: Base64 encoded input image
            enhancement_type: Type of enhancement (general, face, etc.)
        """
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        payload = {
            "image": image,
            "enhancement_type": enhancement_type,
            "task": "enhance",
            **kwargs,
        }

        try:
            logger.info("Enhancing image with SUPIR: %s", enhancement_type)

            timeout = aiohttp.ClientTimeout(total=300)
            async with self.session.post(f"{self.base_url}/enhance", json=payload, timeout=timeout) as response:
                response.raise_for_status()
                result = await response.json()

                return {
                    "provider": "supir",
                    "operation": "enhance",
                    "enhancement_type": enhancement_type,
                    "output_image": result.get("image"),
                    "processing_time": result.get("processing_time"),
                    "timestamp": datetime.now(UTC).isoformat(),
                }

        except Exception:
            logger.exception("SUPIR enhancement failed: ")
            raise

    async def restore_image(
        self,
        image: str,  # base64 encoded image
        restoration_type: str = "general",
        **kwargs,
    ) -> dict[str, Any]:
        """
        Restore damaged or low-quality images

        Args:
            image: Base64 encoded input image
            restoration_type: Type of restoration needed
        """
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        payload = {
            "image": image,
            "restoration_type": restoration_type,
            "task": "restore",
            **kwargs,
        }

        try:
            logger.info("Restoring image with SUPIR: %s", restoration_type)

            timeout = aiohttp.ClientTimeout(total=300)
            async with self.session.post(f"{self.base_url}/restore", json=payload, timeout=timeout) as response:
                response.raise_for_status()
                result = await response.json()

                return {
                    "provider": "supir",
                    "operation": "restore",
                    "restoration_type": restoration_type,
                    "output_image": result.get("image"),
                    "processing_time": result.get("processing_time"),
                    "timestamp": datetime.now(UTC).isoformat(),
                }

        except Exception:
            logger.exception("SUPIR restoration failed: ")
            raise

    async def get_models(self) -> list[dict[str, Any]]:
        """Get available SUPIR models"""
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        try:
            async with self.session.get(f"{self.base_url}/models") as response:
                response.raise_for_status()
                models_data = await response.json()
                return list(models_data) if isinstance(models_data, list) else []
        except Exception:
            logger.exception("Failed to get SUPIR models: ")
            return []

    async def get_capabilities(self) -> dict[str, Any]:
        """Get SUPIR capabilities and supported operations"""
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        try:
            async with self.session.get(f"{self.base_url}/capabilities") as response:
                response.raise_for_status()
                capabilities_data = await response.json()
                return dict(capabilities_data) if isinstance(capabilities_data, dict) else {}
        except Exception:
            logger.exception("Failed to get SUPIR capabilities: ")
            return {
                "supported_tasks": ["upscale", "enhance", "restore"],
                "max_scale": 4,
                "supported_formats": ["png", "jpg", "webp"],
            }
