#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Content Processors Package — Phase 1 Week 3 content processing.
# Invariants:
# - Lazy exports only: importing ``processors.base`` (FTS clamp) must not load
#   DocumentProcessor → business_intelligence → elasticsearch (site-studio lean image).
# Related:
# - docker/builders/stack0-api/requirements/site-studio-worker.in
# ---
"""Content processors package (lazy exports)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .audio_processor import AudioProcessor
    from .base import ContentProcessor
    from .document_processor import DocumentProcessor
    from .factory import ProcessorFactory
    from .image_processor import ImageProcessor
    from .ocr_processor import OCRProcessor
    from .video_processor import VideoProcessor

__all__ = [
    "AudioProcessor",
    "ContentProcessor",
    "DocumentProcessor",
    "ImageProcessor",
    "OCRProcessor",
    "ProcessorFactory",
    "VideoProcessor",
]

_LAZY_EXPORTS: dict[str, tuple[str, str]] = {
    "AudioProcessor": (".audio_processor", "AudioProcessor"),
    "ContentProcessor": (".base", "ContentProcessor"),
    "DocumentProcessor": (".document_processor", "DocumentProcessor"),
    "ImageProcessor": (".image_processor", "ImageProcessor"),
    "OCRProcessor": (".ocr_processor", "OCRProcessor"),
    "ProcessorFactory": (".factory", "ProcessorFactory"),
    "VideoProcessor": (".video_processor", "VideoProcessor"),
}


def __getattr__(name: str) -> Any:
    target = _LAZY_EXPORTS.get(name)
    if target is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module_name, attr = target
    from importlib import import_module

    mod = import_module(module_name, __name__)
    value = getattr(mod, attr)
    globals()[name] = value
    return value


def __dir__() -> list[str]:
    return sorted({*globals().keys(), *__all__})
