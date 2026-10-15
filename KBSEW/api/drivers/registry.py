# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Driver type registry for KBSEW ingestion engine.
# Invariants:
# - Lazy driver imports so barrel_service → registry does not circular-import drivers
#   that pull api.services.* during package init.
# Related:
# - api/drivers/code_python.py
# - api/drivers/code_typescript.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from api.drivers.base import BaseIngestionDriver

_REGISTRY: dict[str, type[BaseIngestionDriver]] | None = None


def _ensure_registry() -> dict[str, type[BaseIngestionDriver]]:
    global _REGISTRY
    if _REGISTRY is not None:
        return _REGISTRY
    from api.drivers.code_python import CodePythonIngestionDriver
    from api.drivers.code_typescript import CodeTypescriptIngestionDriver
    from api.drivers.markdown import MarkdownIngestionDriver
    from api.drivers.pdf import PDFIngestionDriver

    _REGISTRY = {
        PDFIngestionDriver.driver_type: PDFIngestionDriver,
        MarkdownIngestionDriver.driver_type: MarkdownIngestionDriver,
        CodePythonIngestionDriver.driver_type: CodePythonIngestionDriver,
        CodeTypescriptIngestionDriver.driver_type: CodeTypescriptIngestionDriver,
    }
    return _REGISTRY


def list_driver_types() -> list[str]:
    return sorted(_ensure_registry().keys())


def get_driver(driver_type: str) -> BaseIngestionDriver:
    key = driver_type.strip().lower()
    cls = _ensure_registry().get(key)
    if cls is None:
        raise KeyError(f"Unknown driver_type: {driver_type!r}")
    return cls()


def register_driver(cls: type[BaseIngestionDriver]) -> None:
    _ensure_registry()[cls.driver_type] = cls
