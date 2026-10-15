# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Runtime provider seed defaults and text LLM base URL resolver for UGS bootstrap.
# Invariants:
# - Seeds mirror generation_types provider references when DB rows are missing.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# ---

from typing import Any

from api.core.unified_config import unified_settings
from api.services.ugs.text_llm_constants import resolve_ugs_text_llm_base_url

_COMFYUI_DEFAULT_BASE_URL = "http://stack2-comfyui:3000"
_COMFYUI_MIN_MUSIC_TIMEOUT_SECONDS = 600


def ugs_resolve_text_llm_base_url(configured_base_url: str | None) -> str:
    """Prefer DB/admin base_url; else env LLAMA_URL (unified_settings); else compose default."""
    return resolve_ugs_text_llm_base_url(
        configured_base_url,
        env_llama_url=unified_settings.llama_url,
    )


def get_runtime_provider_seed(provider_name: str) -> dict[str, Any] | None:
    """Known runtime providers that can be bootstrapped into the DB."""
    normalized = provider_name.strip()
    defaults: dict[str, dict[str, Any]] = {
        "llama": {
            "provider_type": "llama",
            "base_url": None,
            "health_endpoint": "/health",
            "timeout_seconds": 120,
            "max_concurrent": 5,
        },
        "comfyui": {
            "provider_type": "comfyui",
            "base_url": (unified_settings.comfyui_url or "").rstrip("/") or "http://stack2-comfyui:3000",
            "health_endpoint": "/system_stats",
            "timeout_seconds": 600,
            "max_concurrent": 2,
        },
        "faster_whisper": {
            "provider_type": "faster_whisper",
            "base_url": (unified_settings.whisper_fast_url or "").rstrip("/") or "http://stack9-whisper-fast:8000",
            "health_endpoint": "/health",
            "timeout_seconds": 120,
            "max_concurrent": 2,
        },
        "silero": {
            "provider_type": "silero",
            "base_url": "http://stack9-silero:8000",
            "health_endpoint": "/health",
            "timeout_seconds": 90,
            "max_concurrent": 3,
            "config_json": {
                "defaults": {
                    "voice": "xenia",
                    "speed": 1.0,
                    "language": "ru",
                },
                "response_format": "wav",
            },
        },
        "piper": {
            "provider_type": "piper",
            "base_url": "http://stack9-piper:8000",
            "health_endpoint": "/health",
            "timeout_seconds": 90,
            "max_concurrent": 4,
            "config_json": {
                "defaults": {
                    "voice": "irina",
                    "speed": 1.0,
                    "language": "ru",
                },
                "response_format": "wav",
                "device": "cpu",
                "voice_model": "ru_RU-irina-medium",
            },
        },
        "supir": {
            "provider_type": "supir",
            "base_url": (unified_settings.supir.internal_url or "").rstrip("/") or "http://stack2-supir:8000",
            "health_endpoint": "/health",
            "timeout_seconds": 240,
            "max_concurrent": 2,
        },
        "sadtalker": {
            "provider_type": "sadtalker",
            "base_url": (unified_settings.sadtalker.internal_url or "").rstrip("/") or "http://stack2-sadtalker:8000",
            "health_endpoint": "/health",
            "timeout_seconds": 240,
            "max_concurrent": 2,
        },
        "stable_diffusion": {
            "provider_type": "stable_diffusion",
            "base_url": (unified_settings.stable_diffusion.internal_url or "").rstrip("/")
            or "http://stack2-stable-diffusion:7860",
            "health_endpoint": "/sdapi/v1/system-info",
            "timeout_seconds": 240,
            "max_concurrent": 2,
        },
        "localai": {
            "provider_type": "localai",
            "base_url": (unified_settings.localai.internal_url or "").rstrip("/") or "http://stack0-localai:8080",
            "health_endpoint": "/health",
            "timeout_seconds": 120,
            "max_concurrent": 4,
        },
        "openwebui": {
            "provider_type": "openwebui",
            "base_url": (unified_settings.openwebui.internal_url or "").rstrip("/") or "http://stack0-openwebui:8080",
            "health_endpoint": "/api/v1/health",
            "timeout_seconds": 120,
            "max_concurrent": 4,
        },
        "miso_provider": {
            "provider_type": "miso",
            "base_url": None,
            "health_endpoint": "/health",
            "timeout_seconds": 180,
            "max_concurrent": 2,
            "config_json": {
                "default_model": unified_settings.bi_ai_model,
            },
        },
        # provider_type = miso — из-за CHECK в БД; ветка ImcCabinetFiller по имени в _call_provider
        "imc_cabinet_filler_provider": {
            "provider_type": "miso",
            "base_url": None,
            "health_endpoint": "/health",
            "timeout_seconds": 180,
            "max_concurrent": 2,
            "config_json": {
                "default_model": unified_settings.bi_ai_model,
            },
        },
        "imc_rag_research_provider": {
            "provider_type": "miso",
            "base_url": None,
            "health_endpoint": "/health",
            "timeout_seconds": 180,
            "max_concurrent": 2,
            "config_json": {
                "default_model": unified_settings.bi_ai_model,
            },
        },
    }
    config = defaults.get(normalized)
    if config is None:
        return None
    return {
        "provider_name": normalized,
        "api_key_required": False,
        "enabled": True,
        "config_json": {},
        "fallback_for": [],
        "cost_per_request": 0.0,
        **config,
    }
