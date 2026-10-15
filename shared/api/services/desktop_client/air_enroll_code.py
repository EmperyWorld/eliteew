# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Generate and validate the versioned one-code Air enrollment wire contract.
# ---

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass, field

from api.services.desktop_client.license_service import DesktopClientError

PREFIX = "EWAE1"
PORT_MIN = 62200
PORT_MAX = 63200
SELECTOR_BYTES = 10
SELECTOR_CHARS = 16
SECRET_BYTES = 16
SECRET_CHARS = 26
CHECKSUM_CHARS = 4
CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
CROCKFORD_VALUES = {char: index for index, char in enumerate(CROCKFORD_ALPHABET)}


@dataclass(frozen=True)
class AirAccessCode:
    port: int
    selector: str = field(repr=False)
    secret: str = field(repr=False)
    checksum: str = field(repr=False)

    def render(self) -> str:
        return f"{PREFIX}-{self.port:05d}-{self.selector}-{self.secret}-{self.checksum}"

    @property
    def selector_hash(self) -> str:
        return hashlib.sha256(self.selector.encode("ascii")).hexdigest()

    @property
    def secret_hash(self) -> str:
        return hashlib.sha256(self.secret.encode("ascii")).hexdigest()


def _encode_fixed(raw: bytes, characters: int) -> str:
    return _encode_value_fixed(int.from_bytes(raw, "big"), characters)


def _encode_value_fixed(value: int, characters: int) -> str:
    encoded = ["0"] * characters
    for index in range(characters - 1, -1, -1):
        encoded[index] = CROCKFORD_ALPHABET[value & 31]
        value >>= 5
    if value:
        raise ValueError("crockford_output_too_short")
    return "".join(encoded)


def _decode_fixed(value: str, *, byte_length: int, characters: int) -> bytes:
    canonical = value.strip().upper()
    if len(canonical) != characters:
        raise ValueError("crockford_length")
    decoded = 0
    for char in canonical:
        number = CROCKFORD_VALUES.get(char)
        if number is None:
            raise ValueError("crockford_character")
        decoded = (decoded << 5) | number
    if decoded >= 1 << (byte_length * 8):
        raise ValueError("crockford_padding")
    raw = decoded.to_bytes(byte_length, "big")
    if _encode_fixed(raw, characters) != canonical:
        raise ValueError("crockford_noncanonical")
    return raw


def checksum_for(*, port: int, selector: str, secret: str) -> str:
    transcript = f"{PREFIX}|{port:05d}|{selector}|{secret}".encode("ascii")
    checksum_bits = int.from_bytes(hashlib.sha256(transcript).digest()[:3], "big") >> 4
    return _encode_value_fixed(checksum_bits, CHECKSUM_CHARS)


def generate_access_code(port: int) -> AirAccessCode:
    if not PORT_MIN <= port <= PORT_MAX:
        raise ValueError("air_enroll_port_range")
    selector = _encode_fixed(secrets.token_bytes(SELECTOR_BYTES), SELECTOR_CHARS)
    secret = _encode_fixed(secrets.token_bytes(SECRET_BYTES), SECRET_CHARS)
    checksum = checksum_for(port=port, selector=selector, secret=secret)
    return AirAccessCode(
        port=port,
        selector=selector,
        secret=secret,
        checksum=checksum,
    )


def normalize_credential(value: str, *, kind: str) -> str:
    canonical = (value or "").strip().upper()
    try:
        if kind == "selector":
            _decode_fixed(
                canonical,
                byte_length=SELECTOR_BYTES,
                characters=SELECTOR_CHARS,
            )
        elif kind == "secret":
            _decode_fixed(
                canonical,
                byte_length=SECRET_BYTES,
                characters=SECRET_CHARS,
            )
        else:
            raise ValueError("credential_kind")
    except ValueError as exc:
        raise DesktopClientError(
            "air_credential_invalid",
            "Air enrollment credential is invalid",
            http_status=400,
        ) from exc
    return canonical


def parse_access_code(raw: str) -> AirAccessCode:
    compact = "".join(char for char in (raw or "").upper() if char not in " -")
    expected_length = len(PREFIX) + 5 + SELECTOR_CHARS + SECRET_CHARS + CHECKSUM_CHARS
    if len(compact) != expected_length or not compact.startswith(PREFIX):
        raise ValueError("air_code_structure")
    offset = len(PREFIX)
    port_text = compact[offset : offset + 5]
    offset += 5
    if not port_text.isdecimal():
        raise ValueError("air_code_port")
    port = int(port_text)
    if not PORT_MIN <= port <= PORT_MAX:
        raise ValueError("air_code_port_range")
    selector = compact[offset : offset + SELECTOR_CHARS]
    offset += SELECTOR_CHARS
    secret = compact[offset : offset + SECRET_CHARS]
    offset += SECRET_CHARS
    checksum = compact[offset:]
    _decode_fixed(
        selector,
        byte_length=SELECTOR_BYTES,
        characters=SELECTOR_CHARS,
    )
    _decode_fixed(
        secret,
        byte_length=SECRET_BYTES,
        characters=SECRET_CHARS,
    )
    expected_checksum = checksum_for(
        port=port,
        selector=selector,
        secret=secret,
    )
    if not secrets.compare_digest(checksum, expected_checksum):
        raise ValueError("air_code_checksum")
    return AirAccessCode(
        port=port,
        selector=selector,
        secret=secret,
        checksum=checksum,
    )
