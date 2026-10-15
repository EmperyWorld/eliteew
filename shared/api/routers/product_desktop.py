# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Product desktop API facade: composes feedback, assistant, news, and KB sub-routers.
# Invariants:
# - Sub-routers own domain routes; this module only mounts them under /product-desktop.
# Related:
# - api/routers/product_desktop_feedback.py
# - api/routers/product_desktop_assistant.py
# - api/routers/product_desktop_assistant_kb.py
# - api/routers/product_desktop_news.py
# ---
"""Product desktop API: feedback, assistant (Справочник), EWDesk news."""

from __future__ import annotations

from fastapi import APIRouter

from api.routers.product_desktop_assistant import assistant_router
from api.routers.product_desktop_assistant_kb import kb_router
from api.routers.product_desktop_feedback import feedback_router
from api.routers.product_desktop_news import news_router
from api.routers.product_desktop_surveys import surveys_router

router = APIRouter(prefix="/product-desktop", tags=["product-desktop"])

router.include_router(news_router)
router.include_router(feedback_router)
router.include_router(surveys_router)
router.include_router(assistant_router)
router.include_router(kb_router)
