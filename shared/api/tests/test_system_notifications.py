"""GAF system notification text for UGS energy balance."""

from api.gaf_chat.energy_notify_text import format_energy_credits_notify_text


def test_format_refund_uses_dedicated_copy() -> None:
    text = format_energy_credits_notify_text(
        new_balance=150.0,
        delta=25.0,
        change_kind="refund",
    )
    assert "Вам возвращено 25.00 энергии" in text
    assert "отменено" in text
    assert "150.00" in text
    assert "пополнен" not in text


def test_format_positive_delta_without_kind_is_topup() -> None:
    text = format_energy_credits_notify_text(new_balance=200.0, delta=10.0)
    assert "пополнен на 10.00" in text
    assert "200.00" in text


def test_format_negative_delta_is_adjustment() -> None:
    text = format_energy_credits_notify_text(new_balance=90.0, delta=-10.0)
    assert "скорректирован на -10.00" in text


def test_format_message_override_wins() -> None:
    text = format_energy_credits_notify_text(
        new_balance=1.0,
        delta=99.0,
        change_kind="refund",
        message_override="  Custom line  ",
    )
    assert text == "Custom line"


def test_format_fallback_balance_only() -> None:
    text = format_energy_credits_notify_text(new_balance=42.5)
    assert "обновлён" in text
    assert "42.50" in text
