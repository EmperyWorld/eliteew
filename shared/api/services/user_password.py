#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Bcrypt password hashing and strength validation for profile/auth flows (Keycloak-era local password ops).
# Invariants:
# - Minimum hash length 6 chars; strength rules require 8+ with mixed character classes.
# Related:
# - api/services/user_profile_service.py
# ---

from __future__ import annotations

import logging

import bcrypt  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

_MIN_PASSWORD_LENGTH_HASH = 6
_MIN_PASSWORD_LENGTH_STRENGTH = 8


class PasswordManager:
    """Secure password management with bcrypt."""

    @staticmethod
    def hash_password(password: str) -> str:
        if not password:
            msg = "Password cannot be empty"
            raise ValueError(msg)

        if len(password) < _MIN_PASSWORD_LENGTH_HASH:
            msg = f"Password must be at least {_MIN_PASSWORD_LENGTH_HASH} characters long"
            raise ValueError(msg)

        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password.encode("utf-8"), salt)
        return password_hash.decode("utf-8")

    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        try:
            if not password or not hashed_password:
                return False

            return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
        except (ValueError, TypeError):  # fmt: skip
            logger.exception("Password verification failed")
            return False
        except Exception:
            logger.exception("Unexpected error during password verification")
            return False

    @staticmethod
    def validate_password_strength(password: str) -> tuple[bool, list[str]]:
        errors: list[str] = []

        if len(password) < _MIN_PASSWORD_LENGTH_STRENGTH:
            errors.append(f"Password must be at least {_MIN_PASSWORD_LENGTH_STRENGTH} characters long")

        if not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")

        if not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")

        if not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one number")

        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(c in special_chars for c in password):
            errors.append("Password must contain at least one special character")

        return len(errors) == 0, errors
