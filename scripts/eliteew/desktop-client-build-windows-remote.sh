#!/usr/bin/env bash
# EliteEW — tracked wrapper → Windows NSIS remote build horse (libvirt guest).
# Canon: documentation/product/desktop/DESKTOP-CLIENT-WINDOWS-BUILD-VM.md
set -euo pipefail
exec bash /up_back/vms/eliteew-win11-build/scripts/05-remote-windows-build.sh "$@"
