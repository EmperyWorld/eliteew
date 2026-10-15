#!/usr/bin/env python3
"""Minimal cold import check for RabbitMQ worker images (no broker required)."""

from __future__ import annotations

import sys


def main() -> int:
    try:
        import aio_pika  # noqa: F401
    except ImportError:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
