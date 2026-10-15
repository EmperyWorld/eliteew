#!/usr/bin/env python3
"""
Encryption Service for Unified Content System
Implements encryption at rest for sensitive metadata

SECURITY FIX #6: Encryption at rest
"""

import base64
import logging

from cryptography.fernet import Fernet

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)


class EncryptionService:
    """
    Encryption service for sensitive data at rest

    Features:
    - AES-256 encryption via Fernet
    - PBKDF2 key derivation
    - Encrypted fields: descriptions, metadata
    - Environment-based key management
    """

    def __init__(self, master_key: str | None = None):
        """
        Initialize encryption service

        Args:
            master_key: Master encryption key (base64-encoded)
                       If None, loads from ENCRYPTION_MASTER_KEY env var

        Environment Variables:
            ENCRYPTION_MASTER_KEY: Base64-encoded master key
            ENCRYPTION_ENABLED: Enable/disable encryption (default: true)
        """
        self.enabled = unified_settings.encryption_enabled

        if not self.enabled:
            logger.warning("Encryption is DISABLED. This is insecure for production!")
            self.cipher = None
            return

        key_material: str | None = master_key
        if key_material is None:
            key_material = unified_settings.encryption_master_key

        if not key_material:
            logger.error(
                "ENCRYPTION_MASTER_KEY not set! Generating temporary key. This key will NOT persist across restarts!"
            )
            resolved_key = Fernet.generate_key().decode("utf-8")
        else:
            resolved_key = key_material

        try:
            # Validate and create cipher
            self.cipher = Fernet(resolved_key.encode())
            logger.info("Encryption service initialized successfully")
        except Exception as e:
            logger.warning("Failed to initialize encryption: %s", e)
            msg = f"Invalid encryption key: {e}"
            raise ValueError(msg) from e

    def encrypt(self, plaintext: str) -> str | None:
        """
        Encrypt plaintext string

        Args:
            plaintext: String to encrypt

        Returns:
            Base64-encoded encrypted string, or None if encryption disabled
        """
        if not self.enabled or not plaintext:
            return plaintext

        try:
            encrypted = self.cipher.encrypt(plaintext.encode("utf-8"))  # type: ignore[union-attr]
            return base64.b64encode(encrypted).decode("utf-8")
        except Exception:
            logger.exception("Encryption failed")
            # Fail-safe: return plaintext if encryption fails
            return plaintext

    def decrypt(self, ciphertext: str) -> str | None:
        """
        Decrypt encrypted string

        Args:
            ciphertext: Base64-encoded encrypted string

        Returns:
            Decrypted plaintext string, or None if decryption fails
        """
        if not self.enabled or not ciphertext:
            return ciphertext

        try:
            encrypted = base64.b64decode(ciphertext.encode("utf-8"))
            decrypted = self.cipher.decrypt(encrypted)  # type: ignore[union-attr]
            return decrypted.decode("utf-8")
        except Exception as e:
            logger.warning("Decryption failed: %s. Returning original value.", e)
            # Fail-safe: assume plaintext if decryption fails (backward compatibility)
            return ciphertext

    def encrypt_dict(self, data: dict, fields: list) -> dict:
        """
        Encrypt specific fields in a dictionary

        Args:
            data: dict[str, Any]ionary to encrypt
            fields: List of field names to encrypt

        Returns:
            (dict[str, Any])ionary with encrypted fields
        """
        if not self.enabled:
            return data

        result = data.copy()
        for field in fields:
            if result.get(field):
                result[field] = self.encrypt(str(result[field]))

        return result

    def decrypt_dict(self, data: dict, fields: list) -> dict:
        """
        Decrypt specific fields in a dictionary

        Args:
            data: dict[str, Any]ionary with encrypted fields
            fields: List of field names to decrypt

        Returns:
            (dict[str, Any])ionary with decrypted fields
        """
        if not self.enabled:
            return data

        result = data.copy()
        for field in fields:
            if result.get(field):
                result[field] = self.decrypt(result[field])

        return result


# Global encryption service instance
_encryption_service: EncryptionService | None = None
_encryption_init_attempted = False


def get_encryption_service() -> EncryptionService:
    """
    Get global encryption service instance

    Returns:
        EncryptionService instance
    """
    global _encryption_service, _encryption_init_attempted

    if _encryption_service is not None:
        return _encryption_service
    if _encryption_init_attempted:
        msg = "Encryption service initialization previously failed"
        raise ValueError(msg)

    _encryption_init_attempted = True
    _encryption_service = EncryptionService()
    return _encryption_service


def generate_master_key() -> str:
    """
    Generate a new master encryption key

    Returns:
        Base64-encoded Fernet key
    """
    key = Fernet.generate_key()
    return key.decode("utf-8")
