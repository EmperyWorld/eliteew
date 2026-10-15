#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Package exports and explicit imports for Celery task registration.
# Import side effects keep task modules visible to Celery autodiscovery.
# Invariants:
# - Do not start background work at import time; imports may only register task callables.
# - Public helpers continue to come from celery_app.
# Related:
# - api/tasks/celery_app.py
# ---
"""Celery tasks for background processing and scheduled operations."""

from .celery_app import celery_app, get_celery_app, get_task_result, get_task_status
from .marketing_performance_sync import sync_marketing_performance_facts_task

__all__ = [
    "celery_app",
    "get_celery_app",
    "get_task_result",
    "get_task_status",
    "sync_marketing_performance_facts_task",
]
