# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin UGS facade for marketing cabinet AI text/stream calls.
# Invariants:
# - Structured JSON flows pass json_format in input_data; type_key selects UGS generation_types.
# Related:
# - api/services/ugs/unified_generation_service.py
# - documentation/product/marketing/MARKETING-PROJECT-RAG.md
# ---
from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.ugs.unified_generation_service import UnifiedGenerationService


class MarketingCabinetAIService:
    def __init__(self, db: AsyncSession) -> None:
        self.ugs_service = UnifiedGenerationService(db)

    async def close(self) -> None:
        await self.ugs_service.close()

    @staticmethod
    def _flatten_messages(messages: list[dict[str, str]]) -> str:
        lines: list[str] = []
        for item in messages:
            role = str(item.get("role") or "user").upper()
            content = str(item.get("content") or "").strip()
            if content:
                lines.append(f"{role}: {content}")
        return "\n".join(lines).strip()

    @staticmethod
    def _extract_text(payload: Any) -> str:
        if isinstance(payload, dict):
            for key in ("text", "content", "response", "result_text"):
                value = payload.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
            nested = payload.get("result")
            if nested is not None:
                return MarketingCabinetAIService._extract_text(nested)
            preview = payload.get("result_preview")
            if preview is not None:
                return MarketingCabinetAIService._extract_text(preview)
        if isinstance(payload, str):
            return payload.strip()
        return ""

    async def generate_text(
        self,
        *,
        user_id: str,
        prompt: str | None = None,
        messages: list[dict[str, str]] | None = None,
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 3000,
        type_key: str = "text_chat",
        project_id: str | None = None,
        company_id: str | None = None,
        priority: int = 5,
        timeout_seconds: float = 120.0,
        json_format: bool = False,
    ) -> dict[str, Any]:
        input_prompt = prompt or self._flatten_messages(messages or [])
        input_data: dict[str, Any] = {
            "prompt": input_prompt,
            "options": {
                "temperature": max(0.0, min(float(temperature), 2.0)),
                "num_predict": max(256, int(max_tokens)),
            },
        }
        if json_format:
            input_data["json_format"] = True
        if model:
            input_data["model"] = model

        generation = await self.ugs_service.generate_and_wait(
            user_id=user_id,
            type_key=type_key,
            input_data=input_data,
            project_id=project_id,
            company_id=company_id,
            priority=priority,
            timeout_seconds=timeout_seconds,
            poll_interval=1.0,
        )
        text = self._extract_text(generation)
        return {
            "text": text,
            "request_id": generation.get("request_id"),
            "raw": generation,
        }

    async def stream_text(
        self,
        *,
        user_id: str,
        prompt: str | None = None,
        messages: list[dict[str, str]] | None = None,
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 3000,
        type_key: str = "text_chat",
        project_id: str | None = None,
        company_id: str | None = None,
        priority: int = 5,
    ) -> AsyncGenerator[dict[str, Any]]:
        input_prompt = prompt or self._flatten_messages(messages or [])
        input_data = {
            "prompt": input_prompt,
            "options": {
                "temperature": max(0.0, min(float(temperature), 2.0)),
                "num_predict": max(256, int(max_tokens)),
            },
        }
        if model:
            input_data["model"] = model

        start_payload = await self.ugs_service.start_generation_for_stream(
            user_id=user_id,
            type_key=type_key,
            input_data=input_data,
            project_id=project_id,
            company_id=company_id,
            priority=priority,
        )
        request_id = start_payload.get("request_id")
        if start_payload.get("cached") and start_payload.get("status") == "completed":
            yield {
                "event": "result",
                "request_id": request_id,
                "text": self._extract_text(start_payload),
                "payload": start_payload,
            }
            return
        if not request_id:
            yield {"event": "error", "error": "UGS did not return request_id"}
            return

        yield {"event": "started", "request_id": request_id, "status": start_payload.get("status", "processing")}
        async for event in self.ugs_service.stream_generation_events(
            request_id,
            user_id,
            poll_interval=2.0,
            keep_alive_interval=2.0,
        ):
            event_type = str(event.get("event") or "message")
            if event_type == "result":
                event = {**event, "text": self._extract_text(event.get("data") or event)}
            yield event
