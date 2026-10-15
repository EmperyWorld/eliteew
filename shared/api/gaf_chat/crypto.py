"""
GAF Chat server-side encryption (phase 1).

Behavior overview
-----------------
- **With a valid key** (environment variable ``GAF_CHAT_SERVER_ENCRYPTION_KEY``):
  bodies are encrypted with **AES-256-GCM**. Stored fields: base64 ciphertext,
  base64 nonce, ``algorithm=server_aes``, ``version=v1``.
- **Without a valid key** (unset, empty, wrong length, or undecodable base64):
  bodies are stored as **plaintext** with ``algorithm=plain``; ciphertext and
  nonce fields are empty for new writes from :func:`encrypt_body`.

**Wire format (``server_aes`` / ``v1``):** 12-byte random nonce (NIST SP 800-38D
recommendation for GCM), ciphertext from ``AESGCM`` includes the 16-byte auth
tag appended by ``cryptography`` (same as ``encrypt`` output layout).

:func:`decrypt_body` never raises for API callers: ``plain`` and missing-key
paths return the stored string (or empty), and AES failures yield a fixed
placeholder string so list endpoints stay stable.
"""

from __future__ import annotations

import base64
import binascii
import logging
import os

logger = logging.getLogger(__name__)

# Environment variable name (value: base64-encoded 32-byte AES key).
ENV_VAR_GAF_CHAT_SERVER_ENCRYPTION_KEY = "GAF_CHAT_SERVER_ENCRYPTION_KEY"

# Stored ``algorithm`` column values and encryption payload version tag.
GAF_CHAT_ALGO_PLAIN = "plain"
GAF_CHAT_ALGO_SERVER_AES = "server_aes"
GAF_CHAT_ENC_VERSION_V1 = "v1"

# Returned to clients when AES-GCM decrypt fails but a key is configured (tampering, wrong key, corrupt DB).
GAF_CHAT_DECRYPTION_FAILED_PLACEHOLDER = "[decryption error]"


def _get_key_bytes() -> bytes | None:
    """
    Load and validate the server AES key from the environment.

    Accepts standard base64 or Fernet-style 44-character url-safe base64
    (padded with ``=``) that decodes to 32 bytes.

    Returns:
        32-byte key material, or ``None`` if encryption should be disabled.

    Note:
        Logs a warning and returns ``None`` on missing env, wrong length after
        decode, or base64 decode errors.
    """
    raw = (os.environ.get(ENV_VAR_GAF_CHAT_SERVER_ENCRYPTION_KEY) or "").strip()
    if not raw:
        return None
    try:
        # Standard base64 first; Fernet-style keys use URL-safe alphabet and need urlsafe_b64decode.
        key = base64.b64decode(raw)
        if len(key) == 32:
            return key
        if len(key) == 44 and raw.endswith("="):  # Fernet-style 32 bytes b64
            return base64.urlsafe_b64decode(raw)
        logger.warning("[GAF_CHAT] GAF_CHAT_SERVER_ENCRYPTION_KEY length not 32 bytes; encryption disabled")
        return None
    except Exception as e:
        logger.warning(
            "[GAF_CHAT] Invalid GAF_CHAT_SERVER_ENCRYPTION_KEY (%s): %s",
            type(e).__name__,
            e,
        )
        return None


def encrypt_body(plaintext: str) -> tuple[str, str, str, str]:
    """
    Encrypt a message body for persistence.

    Args:
        plaintext: UTF-8 message text.

    Returns:
        Tuple ``(body_ciphertext_b64, nonce_b64, algorithm, version)``.
        With encryption off: plaintext as first element, empty nonce, ``plain``, ``v1``.
        With encryption on: standard base64 ciphertext and nonce (ASCII);
        ``algorithm`` is ``server_aes``; ``version`` is ``v1``.

    Note:
        On unexpected failure inside the crypto library, logs at error level
        and falls back to the same tuple shape as plaintext mode so storage
        still succeeds.
    """
    key = _get_key_bytes()
    if not key:
        return (plaintext, "", GAF_CHAT_ALGO_PLAIN, GAF_CHAT_ENC_VERSION_V1)
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        # Single UTF-8 encode: same bytes fed to GCM as before (no associated data).
        pt_bytes = plaintext.encode("utf-8")
        nonce = os.urandom(12)
        aes = AESGCM(key)
        ct = aes.encrypt(nonce, pt_bytes, None)
        return (
            base64.b64encode(ct).decode("ascii"),
            base64.b64encode(nonce).decode("ascii"),
            GAF_CHAT_ALGO_SERVER_AES,
            GAF_CHAT_ENC_VERSION_V1,
        )
    except Exception as e:
        logger.exception("[GAF_CHAT] Encryption failed: %s", e)
        return (plaintext, "", GAF_CHAT_ALGO_PLAIN, GAF_CHAT_ENC_VERSION_V1)


def decrypt_body(body_ciphertext: str, nonce_b64: str | bytes, algorithm: str) -> str:
    """
    Decrypt a stored message body for API responses.

    Args:
        body_ciphertext: Base64 ciphertext, or plaintext when ``algorithm`` is
            ``plain``.
        nonce_b64: Base64 nonce string, or raw nonce bytes (e.g. from PostgreSQL
            ``BYTEA``); raw bytes are re-encoded to base64 before decode.
        algorithm: ``plain`` or ``server_aes`` (see module constants).

    Returns:
        UTF-8 message text, or empty string when the ciphertext is empty in
        ``plain`` mode. If ``algorithm`` is ``server_aes`` but the nonce is
        empty, the key is missing, base64 is invalid, or GCM verification fails,
        returns :data:`GAF_CHAT_DECRYPTION_FAILED_PLACEHOLDER` when a key was
        loaded; if no key is configured, returns the ciphertext string unchanged
        (legacy / misconfigured row).
    """
    if algorithm == GAF_CHAT_ALGO_PLAIN:
        return body_ciphertext or ""
    if isinstance(nonce_b64, bytes):
        # BYTEA / memoryview from drivers: re-encode so one b64decode path handles str and bytes.
        nonce_b64 = base64.b64encode(nonce_b64).decode("ascii")
    if not nonce_b64:
        return body_ciphertext or ""
    key = _get_key_bytes()
    if not key:
        return body_ciphertext or ""
    try:
        from cryptography.exceptions import InvalidTag
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        nonce = base64.b64decode(nonce_b64)
        ct = base64.b64decode(body_ciphertext)
        aes = AESGCM(key)
        # AAD is unused (None); must match encrypt for verification to succeed.
        return aes.decrypt(nonce, ct, None).decode("utf-8")
    except InvalidTag as e:
        logger.warning("[GAF_CHAT] Decryption failed (InvalidTag): %s", e)
        return GAF_CHAT_DECRYPTION_FAILED_PLACEHOLDER
    except (binascii.Error, TypeError, ValueError) as e:
        logger.warning(
            "[GAF_CHAT] Decryption failed (decode error, type %s): %s",
            type(e).__name__,
            e,
        )
        return GAF_CHAT_DECRYPTION_FAILED_PLACEHOLDER
    except Exception as e:
        logger.warning("[GAF_CHAT] Decryption failed (type %s): %s", type(e).__name__, e)
        return GAF_CHAT_DECRYPTION_FAILED_PLACEHOLDER
