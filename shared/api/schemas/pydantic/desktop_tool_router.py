# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Pydantic contract for Desktop AI Chat Tool Router sidecar (desktop_route_turn FC).
# Invariants:
#   - tool enum matches execute_desktop_tool whitelist mapping.
# Related:
#   - api/services/desktop_chat/sidecar/tool_router.py
# ---

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DesktopRouterTool = Literal["chat_only", "generate_image", "fetch_url", "web_search", "knowledge_base_search"]

ROUTER_PARTIAL_TOOLS: frozenset[str] = frozenset({"generate_image", "web_search"})
ROUTER_FULL_TOOLS: frozenset[str] = frozenset({"generate_image", "fetch_url", "web_search", "knowledge_base_search"})

DESKTOP_EXECUTE_TOOL_IMAGE = "desktop_generate_image"
DESKTOP_EXECUTE_TOOL_FETCH = "desktop_fetch_url"
DESKTOP_EXECUTE_TOOL_WEB = "desktop_web_search"
DESKTOP_EXECUTE_TOOL_KB = "knowledge_base_search"


class DesktopToolRouterResultV1(BaseModel):
    model_config = ConfigDict(extra="ignore")

    tool: DesktopRouterTool = "chat_only"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    prompt: str | None = None
    aspect_ratio: str | None = None
    url: str | None = None
    query: str | None = None
    barrel_id: str | None = None
    reason: str | None = None
