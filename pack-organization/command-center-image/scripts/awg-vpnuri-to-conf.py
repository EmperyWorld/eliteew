#!/usr/bin/env python3
"""Decode Amnezia vpn:// URI to awg-quick .conf on stdout (no secrets logged)."""
from __future__ import annotations

import base64
import json
import sys
import zlib
from typing import Any


def decode_vpn_key(link: str) -> dict[str, Any]:
    vpn_prefix = "vpn://"
    link = link.strip()
    if not link.startswith(vpn_prefix):
        msg = "Expected vpn://… (one line in input file)"
        raise SystemExit(msg)
    payload = link[len(vpn_prefix) :] + "=="
    compressed = base64.urlsafe_b64decode(payload)
    zlib_header_size = 4
    if len(compressed) <= zlib_header_size:
        raise SystemExit("Invalid vpn:// payload")
    raw = zlib.decompress(compressed[zlib_header_size:])
    return json.loads(raw)


def parse_awg_config(data: dict[str, Any]) -> str:
    dns1 = data.get("dns1", "1.1.1.1")
    dns2 = data.get("dns2", "1.0.0.1")
    container_name = data["defaultContainer"]
    last_config: str | None = None
    for container in data.get("containers", []):
        if container.get("container") == container_name:
            last_config = container["awg"]["last_config"]
            break
    if not last_config:
        raise SystemExit("awg last_config not found in vpn:// blob")
    wg_config = json.loads(last_config)["config"]
    return (
        wg_config.replace("$PRIMARY_DNS", dns1).replace("$SECONDARY_DNS", dns2).strip()
        + "\n"
    )


def main() -> None:
    if len(sys.argv) > 1:
        text = open(sys.argv[1], encoding="utf-8").read()
    else:
        text = sys.stdin.read()
    line = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
    cfg = parse_awg_config(decode_vpn_key(line))
    sys.stdout.write(cfg)


if __name__ == "__main__":
    main()
