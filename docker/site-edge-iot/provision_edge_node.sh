#!/usr/bin/env bash
# Thin wrapper — same as docker/scripts/site-edge-iot-provision.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/docker/scripts/site-edge-iot-provision.sh" "$@"
