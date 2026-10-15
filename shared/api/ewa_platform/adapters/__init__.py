# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Package marker for outbound adapters (HTTP to EliteEW shell APIs and similar bridges).
# Invariants:
# - Do not import ``api.services.amka_core``; ``httpx`` lives in concrete adapters only.
# Related:
# - api/ewa_platform/adapters/eliteew_desktop_http.py
# - api/ewa_platform/adapters/README.md
# ---
from __future__ import annotations

from api.ewa_platform.adapters.eliteew_desktop_http import EliteEwDesktopHttpDriverStub
from api.ewa_platform.adapters.eliteew_ugs_http import EliteEwUgsHttpDriverStub
from api.ewa_platform.adapters.http_client_config import HttpClientConfig

__all__ = ["EliteEwDesktopHttpDriverStub", "EliteEwUgsHttpDriverStub", "HttpClientConfig"]
