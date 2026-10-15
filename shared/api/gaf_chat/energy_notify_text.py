"""Plaintext templates for GAF system messages about UGS energy (no I/O, no heavy imports)."""

from __future__ import annotations

from typing import Literal

EnergyCreditsNotifyKind = Literal["refund"]


def format_energy_credits_notify_text(
    *,
    new_balance: float,
    delta: float | None = None,
    message_override: str | None = None,
    change_kind: EnergyCreditsNotifyKind | None = None,
) -> str:
    """Build the plaintext line for GAF system messages about UGS energy (credits)."""
    if message_override and message_override.strip():
        return message_override.strip()
    if change_kind == "refund" and delta is not None and delta > 1e-9:
        return (
            f"Вам возвращено {delta:.2f} энергии (UGS) — списание за генерацию отменено. "
            f"Текущий баланс: {new_balance:.2f}."
        )
    if delta is not None and abs(delta) > 1e-9:
        if delta > 0:
            return f"Ваш баланс энергии (UGS) пополнен на {delta:.2f}. Текущий баланс: {new_balance:.2f}."
        return f"Баланс энергии (UGS) скорректирован на {delta:.2f}. Текущий баланс: {new_balance:.2f}."
    return f"Ваш баланс энергии (UGS) обновлён. Текущий баланс: {new_balance:.2f}."
