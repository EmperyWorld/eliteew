"""IMC (marketing cabinet research) services."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from api.services.imc.imc_service import ImcService

__all__ = ["ImcService"]


def __getattr__(name: str):
    if name == "ImcService":
        from api.services.imc.imc_service import ImcService

        return ImcService
    msg = f"module {__name__!r} has no attribute {name!r}"
    raise AttributeError(msg)
