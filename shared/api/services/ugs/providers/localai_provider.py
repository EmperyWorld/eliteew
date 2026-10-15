#!/usr/bin/env python3
"""
LocalAI Provider Integration
Phase 2 - Provider Integration
Supports multimodal generation (text, vision, embeddings)
"""

import logging
from typing import Any

import aiohttp  # type: ignore[import-not-found]

# HTTP status codes
HTTP_STATUS_OK = 200

logger = logging.getLogger(__name__)


class LocalAIProvider:
    """LocalAI multimodal provider integration"""

    def __init__(self, base_url: str = "http://stack2-localai:31005"):
        self.base_url = base_url.rstrip("/")
        self.session: aiohttp.ClientSession | None = None

    async def initialize(self) -> None:
        """Initialize the provider"""
        self.session = aiohttp.ClientSession()
        logger.info("LocalAIProvider initialized with base_url: %s", self.base_url)

    async def close(self) -> None:
        """Close connections"""
        if self.session:
            await self.session.close()

    async def health_check(self) -> bool:
        """Check if LocalAI is healthy"""
        if not self.session:
            return False

        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with self.session.get(f"{self.base_url}/readyz", timeout=timeout) as response:
                return response.status == HTTP_STATUS_OK
        except (aiohttp.ClientError, aiohttp.ServerTimeoutError, OSError) as e:
            logger.warning("LocalAI health check failed: %s", e)
            return False

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = 1000,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Generate chat completion"""
        if not self.session:
            msg = "LocalAIProvider not initialized"
            raise RuntimeError(msg)

        endpoint = f"{self.base_url}/v1/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            **kwargs,
        }

        timeout = aiohttp.ClientTimeout(total=60)
        async with self.session.post(endpoint, json=payload, timeout=timeout) as response:
            if response.status != HTTP_STATUS_OK:
                error_text = await response.text()
                msg = f"LocalAI API error: {response.status} - {error_text}"
                raise RuntimeError(msg)

            result = await response.json()

            return {
                "content": result["choices"][0]["message"]["content"],
                "model": result.get("model", model),
                "usage": result.get("usage", {}),
                "finish_reason": result["choices"][0].get("finish_reason"),
            }

    async def text_generation(
        self,
        prompt: str,
        system_prompt: str = "",
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = 1000,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Generate text from prompt"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        return await self.chat_completion(
            messages=messages, model=model, temperature=temperature, max_tokens=max_tokens, **kwargs
        )

    async def vision_analysis(
        self,
        image_url: str,
        prompt: str = "Describe this image in detail",
        model: str = "gpt-4-vision-preview",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Analyze image with vision capabilities"""
        if not self.session:
            msg = "LocalAIProvider not initialized"
            raise RuntimeError(msg)

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ]

        return await self.chat_completion(messages=messages, model=model, **kwargs)

    async def embeddings(self, input_text: str, model: str = "text-embedding-ada-002", **kwargs: Any) -> dict[str, Any]:
        """Generate embeddings for text"""
        if not self.session:
            msg = "LocalAIProvider not initialized"
            raise RuntimeError(msg)

        endpoint = f"{self.base_url}/v1/embeddings"
        payload = {"model": model, "input": input_text, **kwargs}

        timeout = aiohttp.ClientTimeout(total=30)
        async with self.session.post(endpoint, json=payload, timeout=timeout) as response:
            if response.status != HTTP_STATUS_OK:
                error_text = await response.text()
                msg = f"LocalAI embeddings error: {response.status} - {error_text}"
                raise RuntimeError(msg)

            result = await response.json()

            return {
                "embeddings": [data["embedding"] for data in result["data"]],
                "model": result.get("model", model),
                "usage": result.get("usage", {}),
            }

    async def multimodal_generation(
        self,
        prompt: str,
        image_url: str | None = None,
        model: str = "gpt-4-vision-preview",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Generate content with multimodal input"""
        if image_url:
            return await self.vision_analysis(image_url=image_url, prompt=prompt, model=model, **kwargs)
        return await self.text_generation(prompt=prompt, model=model, **kwargs)
