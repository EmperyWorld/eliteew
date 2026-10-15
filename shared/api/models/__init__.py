#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Barrel re-export основных SQLAlchemy-моделей для импортов `api.models`.
# Invariants:
# - Экспортируемый набор синхронизировать с тем, что реально использует приложение.
# Related:
# - `database_models.py`, доменные модули `transcription`, `ultimate_doc_editor`, `user_theme`.
# ---

"""
Публичный re-export ключевых ORM моделей приложения.
"""

from api.models.database_models import (
    AgentConfig,
    AIGeneration,
    AppAccessGroup,
    ChatMessage,
    ChatSession,
    DesktopAppCatalog,
    DesktopConfig,
    DesktopItem,
    Document,
    ProjectSiteInstance,
    User,
    UserInstalledApp,
    UserSession,
    UserSiteInstance,
)
from api.models.transcription import Transcription
from api.models.ultimate_doc_editor import (
    UltimateAIPrompt,
    UltimateCollabSession,
    UltimateDocument,
    UltimateDocumentEmbedding,
    UltimateDocumentVersion,
)
from api.models.user_theme import UserTheme

__all__ = [
    # AI models
    "AIGeneration",
    # Agent models
    "AgentConfig",
    "ChatMessage",
    # Chat models
    "ChatSession",
    "DesktopAppCatalog",
    "DesktopConfig",
    "DesktopItem",
    # Document models
    "Document",
    # Audio Transcription models
    "Transcription",
    "UltimateAIPrompt",
    "UltimateCollabSession",
    # Ultimate Document Editor models
    "UltimateDocument",
    "UltimateDocumentEmbedding",
    "UltimateDocumentVersion",
    # Core user models
    "AppAccessGroup",
    "User",
    "UserInstalledApp",
    "UserSiteInstance",
    "ProjectSiteInstance",
    "UserSession",
    "UserTheme",
]
