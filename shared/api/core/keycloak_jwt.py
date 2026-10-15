# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# PyJWT helpers for Keycloak JWKS resolution and unverified claim reads (Wave 2: python-jose removal).
# Invariants:
# - RS256/EC JWK keys from Keycloak JWKS only; no token verification in decode_unverified_claims.
# Related:
# - api.services.keycloak_service; api.services.sso_session_registry
# ---
from __future__ import annotations

import json
import logging
from typing import Any

import jwt  # type: ignore[import-untyped]
from jwt.algorithms import ECAlgorithm, RSAAlgorithm

logger = logging.getLogger(__name__)

_UNVERIFIED_DECODE_OPTIONS = {
    "verify_signature": False,
    "verify_exp": False,
    "verify_aud": False,
    "verify_iss": False,
}


def decode_unverified_claims(token: str) -> dict[str, Any]:
    """Return JWT payload without signature or time validation (refresh/id token introspection)."""
    try:
        payload = jwt.decode(token, options=_UNVERIFIED_DECODE_OPTIONS)
    except jwt.exceptions.DecodeError:
        logger.debug("Could not decode unverified JWT claims")
        return {}
    return payload if isinstance(payload, dict) else {}


def signing_key_from_jwk(key_data: dict[str, Any]) -> Any:  # noqa: ANN401
    """Build a PyJWT-compatible signing key from a single JWK dict."""
    kty = str(key_data.get("kty") or "").strip()
    serialized = json.dumps(key_data)
    if kty == "RSA":
        return RSAAlgorithm.from_jwk(serialized)
    if kty == "EC":
        return ECAlgorithm.from_jwk(serialized)
    msg = f"Unsupported JWK kty: {kty or '?'}"
    raise ValueError(msg)


def resolve_jwks_signing_key(jwks: dict[str, Any], token: str | None = None) -> Any:  # noqa: ANN401
    """Pick the signing key from JWKS using token kid when present, else first key."""
    keys = jwks.get("keys")
    if not isinstance(keys, list) or not keys:
        msg = "JWKS response has no keys"
        raise ValueError(msg)

    if token:
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            if kid:
                for key_data in keys:
                    if isinstance(key_data, dict) and key_data.get("kid") == kid:
                        logger.debug("Found JWKS key with kid: %s", kid)
                        return signing_key_from_jwk(key_data)
                logger.debug("No JWKS key for kid %s; using first key", kid)
        except jwt.exceptions.DecodeError as exc:
            logger.debug("Error parsing token header (expected for invalid tokens): %s", exc)

    first_key = keys[0]
    if not isinstance(first_key, dict):
        msg = "JWKS first key is not an object"
        raise ValueError(msg)
    logger.debug("Using first JWKS key with kid: %s", first_key.get("kid"))
    return signing_key_from_jwk(first_key)
