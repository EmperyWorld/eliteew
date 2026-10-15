# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Heuristics for SSO browser vs Socket.IO channel mismatch in admin Users directory.
# Invariants:
#   - Mirrors frontend `adminUserChannelMismatch.ts` (operator diagnostics, not security).
# Related:
#   - api/services/admin_users_directory.py
#   - documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
# ---

from __future__ import annotations


def directory_entry_has_channel_mismatch(
    *,
    presence_online: bool,
    presence_sessions_web: int,
    presence_sessions_mobile: int,
    sso_browser_active: bool,
) -> bool:
    """True when SSO browser and Socket.IO web channel disagree (operator heuristic)."""
    web_sock = max(0, int(presence_sessions_web or 0))
    mobile_sock = max(0, int(presence_sessions_mobile or 0))
    socket_live = bool(presence_online) and (web_sock > 0 or mobile_sock > 0)
    if sso_browser_active and web_sock == 0 and not socket_live:
        return True
    return bool(socket_live and web_sock > 0 and not sso_browser_active)
