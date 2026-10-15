# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Survey Hub API facade: composes user + admin routers for product-desktop.
# Invariants:
# - One response per user per survey; rewards on first submit only.
# Related:
# - api/routers/product_desktop_surveys_user.py
# - api/routers/product_desktop_surveys_admin.py
# - documentation/product/SURVEY-HUB.md
# ---

from __future__ import annotations

from fastapi import APIRouter

from api.routers.product_desktop_surveys_admin import surveys_admin_router
from api.routers.product_desktop_surveys_user import surveys_user_router

surveys_router = APIRouter(tags=["product-desktop"])
surveys_router.include_router(surveys_user_router)
surveys_router.include_router(surveys_admin_router)
