# Purpose: OS update channel vs payload update channel precedence.
# Related: ELITEEW-TRUSTED-SUBSTRATE.md §5.1 / §12 dual-flag

"""Update channel precedence: OS slot before payload when both pending."""

from __future__ import annotations

from enum import StrEnum


class UpdateChannel(StrEnum):
    OS = "os"
    PAYLOAD = "payload"
    NONE = "none"


def update_channel_precedence(
    *,
    os_update_pending: bool,
    payload_update_pending: bool,
) -> UpdateChannel:
    """
    When both OS and payload updates are pending, OS wins (apply first).

    Callers must not apply payload while an OS slot update is still pending.
    """
    if os_update_pending:
        return UpdateChannel.OS
    if payload_update_pending:
        return UpdateChannel.PAYLOAD
    return UpdateChannel.NONE
