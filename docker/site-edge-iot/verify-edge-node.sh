#!/usr/bin/env bash
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/docker/scripts/site-edge-iot-verify.sh" "$@"
