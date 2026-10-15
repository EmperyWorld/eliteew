# WireGuard for Windows (bundled MSI)

**Purpose:** Pin + fetch the official amd64 MSI embedded in the EliteEW desktop-client NSIS installer (`NSIS_HOOK_POSTINSTALL`).

| File | Tracked? | Role |
|------|----------|------|
| `VERSION.json` | yes | URL, version, **sha256** pin |
| `wireguard-amd64.msi` | **no** (gitignore) | Downloaded artifact |
| `../hooks.nsh` | yes | Silent `msiexec` if WG missing |

```bash
cd pack-organization/connection-agent
bash packaging/windows/fetch-wireguard-msi.sh
# then Windows NSIS build (remote VM sync includes the MSI)
```

**Do not** commit the MSI. **Do not** uninstall WireGuard when removing the desktop-client.

Upstream: <https://download.wireguard.com/windows-client/>
