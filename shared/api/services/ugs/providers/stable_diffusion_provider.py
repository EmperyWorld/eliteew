#!/usr/bin/env python3
"""
Stable Diffusion WebUI Provider Integration
Phase 2 - Provider Integration
"""

import json
import logging
from typing import Any

import aiohttp  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class StableDiffusionProvider:
    """Stable Diffusion WebUI integration"""

    def __init__(self, base_url: str = "http://stack2-stable-diffusion:7860"):
        self.base_url = base_url.rstrip("/")
        self.session: aiohttp.ClientSession | None = None

    async def initialize(self) -> None:
        """Initialize the provider"""
        self.session = aiohttp.ClientSession()
        logger.info("StableDiffusionProvider initialized with base_url: %s", self.base_url)

    async def close(self) -> None:
        """Close connections"""
        if self.session:
            await self.session.close()

    async def health_check(self) -> bool:
        """Check if Stable Diffusion WebUI is healthy"""
        if not self.session:
            return False

        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with self.session.get(f"{self.base_url}/sdapi/v1/memory", timeout=timeout) as response:
                return response.status == 200
        except Exception as e:
            logger.warning("Stable Diffusion health check failed: %s", e)
            return False

    async def text_to_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 512,
        height: int = 512,
        steps: int = 20,
        cfg_scale: float = 7.0,
        sampler: str = "Euler a",
        model: str = "sd-v1-5",
        **kwargs,
    ) -> dict[str, Any]:
        """
        Generate image from text prompt

        Returns:
            {
                "images": ["base64_encoded_image"],
                "parameters": {...},
                "info": "json_string_with_generation_info"
            }
        """
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "width": width,
            "height": height,
            "steps": steps,
            "cfg_scale": cfg_scale,
            "sampler_name": sampler,
            "model": model,
            **kwargs,
        }

        try:
            logger.info("Generating image with Stable Diffusion: %s...", prompt[:50])

            async with self.session.post(
                f"{self.base_url}/sdapi/v1/txt2img",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=300),  # 5 minutes timeout
            ) as response:
                response.raise_for_status()
                result = await response.json()

                # Parse generation info
                info = json.loads(result.get("info", "{}"))

                return {
                    "provider": "stable_diffusion",
                    "images": result.get("images", []),
                    "parameters": payload,
                    "info": info,
                    "generation_time": info.get("generation_time"),
                    "seed": info.get("seed"),
                }

        except Exception:
            logger.exception("Stable Diffusion text-to-image failed: ")
            raise

    async def image_to_image(
        self,
        init_images: list[str],  # base64 encoded images
        prompt: str = "",
        negative_prompt: str = "",
        denoising_strength: float = 0.75,
        steps: int = 20,
        cfg_scale: float = 7.0,
        **kwargs,
    ) -> dict[str, Any]:
        """
        Generate image from image (img2img)

        Args:
            init_images: List of base64 encoded images
            denoising_strength: How much to change the image (0-1)
        """
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        payload = {
            "init_images": init_images,
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "denoising_strength": denoising_strength,
            "steps": steps,
            "cfg_scale": cfg_scale,
            **kwargs,
        }

        try:
            logger.info("Generating img2img with Stable Diffusion")

            async with self.session.post(
                f"{self.base_url}/sdapi/v1/img2img",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=300),
            ) as response:
                response.raise_for_status()
                result = await response.json()

                info = json.loads(result.get("info", "{}"))

                return {
                    "provider": "stable_diffusion",
                    "images": result.get("images", []),
                    "parameters": payload,
                    "info": info,
                    "generation_time": info.get("generation_time"),
                    "seed": info.get("seed"),
                }

        except Exception:
            logger.exception("Stable Diffusion img2img failed: ")
            raise

    async def controlnet_generation(
        self,
        prompt: str,
        controlnet_image: str,  # base64 encoded
        controlnet_model: str = "canny",
        controlnet_module: str = "canny",
        weight: float = 1.0,
        **kwargs,
    ) -> dict[str, Any]:
        """
        Generate image with ControlNet guidance
        """
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        payload = {
            "prompt": prompt,
            "alwayson_scripts": {
                "controlnet": {
                    "args": [
                        {
                            "input_image": controlnet_image,
                            "model": controlnet_model,
                            "module": controlnet_module,
                            "weight": weight,
                            "guidance_start": 0.0,
                            "guidance_end": 1.0,
                        }
                    ]
                }
            },
            **kwargs,
        }

        try:
            logger.info("Generating ControlNet image with Stable Diffusion")

            async with self.session.post(
                f"{self.base_url}/sdapi/v1/txt2img",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=300),
            ) as response:
                response.raise_for_status()
                result = await response.json()

                info = json.loads(result.get("info", "{}"))

                return {
                    "provider": "stable_diffusion",
                    "images": result.get("images", []),
                    "parameters": payload,
                    "info": info,
                    "controlnet_model": controlnet_model,
                    "generation_time": info.get("generation_time"),
                    "seed": info.get("seed"),
                }

        except Exception:
            logger.exception("Stable Diffusion ControlNet failed: ")
            raise

    async def inpainting(
        self,
        prompt: str,
        init_images: list[str],
        mask: str,  # base64 encoded mask
        inpainting_fill: int = 1,  # 0: fill, 1: original, 2: latent noise, 3: latent nothing
        **kwargs,
    ) -> dict[str, Any]:
        """
        Inpaint regions of an image
        """
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        payload = {
            "prompt": prompt,
            "init_images": init_images,
            "mask": mask,
            "inpainting_fill": inpainting_fill,
            "inpainting_mask_invert": 0,
            **kwargs,
        }

        try:
            logger.info("Generating inpainting with Stable Diffusion")

            async with self.session.post(
                f"{self.base_url}/sdapi/v1/img2img",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=300),
            ) as response:
                response.raise_for_status()
                result = await response.json()

                info = json.loads(result.get("info", "{}"))

                return {
                    "provider": "stable_diffusion",
                    "images": result.get("images", []),
                    "parameters": payload,
                    "info": info,
                    "generation_time": info.get("generation_time"),
                    "seed": info.get("seed"),
                }

        except Exception:
            logger.exception("Stable Diffusion inpainting failed: ")
            raise

    async def get_models(self) -> list[dict[str, Any]]:
        """Get available models"""
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        try:
            async with self.session.get(f"{self.base_url}/sdapi/v1/sd-models") as response:
                response.raise_for_status()
                models_data = await response.json()
                return list(models_data) if isinstance(models_data, list) else []
        except Exception:
            logger.exception("Failed to get Stable Diffusion models: ")
            return []

    async def get_samplers(self) -> list[dict[str, Any]]:
        """Get available samplers"""
        if not self.session:
            msg = "Provider not initialized"
            raise RuntimeError(msg)

        try:
            async with self.session.get(f"{self.base_url}/sdapi/v1/samplers") as response:
                response.raise_for_status()
                samplers_data = await response.json()
                return list(samplers_data) if isinstance(samplers_data, list) else []
        except Exception:
            logger.exception("Failed to get Stable Diffusion samplers: ")
            return []
