# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Draft tool/function schemas for orchestration LLM (desktop intents as structured output).
# Invariants:
# - Return only JSON-serializable dict/list structures; no vendor-specific SDK types.
# Related:
# - api/ewa_platform/schemas/json/desktop_intent_v1.json
# - api/ewa_platform/llm/client.py
# ---
"""Draft JSON tool/function specs appended to orch LLM prompts (see ``HttpOrchestrationLlmClient``)."""

from __future__ import annotations

from typing import Any


def planned_tool_schemas() -> list[dict[str, Any]]:
    """Return OpenAI-style tool blobs embedded in orch system prompts (single ``propose_desktop_intent`` today)."""

    return [
        {
            "type": "function",
            "function": {
                "name": "propose_desktop_intent",
                "description": "Propose exactly one desktop intent wire object (intent_kind discriminator).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "intent": {
                            "type": "object",
                            "description": "Shape aligned with desktop_intent_v1.json",
                        },
                    },
                    "required": ["intent"],
                },
            },
        },
    ]
