# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Remove **llama-server / GGUF** debug lines that sometimes leak into user-visible chat and then into
# ``ewa_companion_episodes`` bodies, so episodic recall and Qdrant payloads stay readable for the companion LLM.
# Invariants:
# - Best-effort heuristics only — never raises; empty input → empty output.
# - Applied on **write** (``episodic.record_user_turn``) and again on **read** into prompts (``memory_retrieval``)
#   so legacy rows still get cleaned at injection time.
# Related:
# - api/services/ewa_companion/episodic.py
# - api/ewa_platform/companion/memory/retrieval.py
# - documentation/product/ewa/EWA-COMPANION-HCM-MEMORY.md
# ---
"""Heuristic sanitizer for companion episodic bodies (llama-server log hygiene)."""

from __future__ import annotations

import re
from typing import Final

_MAX_DEFAULT: Final[int] = 8192

_META_PREFIX_RE = re.compile(
    r"(?i)^\s*(?:пользователь\s+(?:хочет|просит|спрашивает)|"
    r"the\s+user\s+(?:wants|asks)|user\s+message\s*:)",
)


def _strip_meta_episodic_line(line: str) -> bool:
    """True → drop line (analyst voice should not enter episodic store)."""

    return bool(_META_PREFIX_RE.match(line.strip()))


def _looks_like_llama_server_log_line(line: str) -> bool:
    """Return True when a single line strongly resembles llama.cpp / server slot telemetry."""

    s = (line or "").strip()
    if len(s) < 10:
        return False
    low = s.lower()
    # Strong single-token signals (often appear alone on a line in stack2 debug).
    if "prompt_save" in low or "n_ctx_slot" in low or "dump_state_hierarchical" in low:
        return True
    if "lost a slot" in low or "slot save" in low:
        return True
    if "llama_server" in low or "llama-server" in low or "llama.cpp" in low:
        return True
    if "ggml_" in low:
        return True
    # Combined telemetry: srv + slot, or KV + MiB-style sizing.
    if ("srv" in low or "server" in low) and ("slot" in low or "prompt" in low):
        return True
    if "kv cache" in low and ("mib" in low or " kv " in low or "ram" in low):
        return True
    return "alloc_tensor" in low or "eval time" in low


def sanitize_companion_episode_body_for_storage(text: str, *, max_chars: int = _MAX_DEFAULT) -> str:
    """Strip llama-server-style log lines and bound length for episodic storage / embedding."""

    raw = (text or "").strip()
    if not raw:
        return ""
    lines_out: list[str] = []
    for line in raw.splitlines():
        if _looks_like_llama_server_log_line(line):
            continue
        if _strip_meta_episodic_line(line):
            continue
        lines_out.append(line)
    out = "\n".join(lines_out).strip()
    out = re.sub(r"\n{5,}", "\n\n\n\n", out)
    if not out.strip():
        return ""
    limit = max(256, min(int(max_chars), 65536))
    if len(out) > limit:
        return out[: limit - 1].rstrip() + "…"
    return out


__all__ = ("sanitize_companion_episode_body_for_storage",)
