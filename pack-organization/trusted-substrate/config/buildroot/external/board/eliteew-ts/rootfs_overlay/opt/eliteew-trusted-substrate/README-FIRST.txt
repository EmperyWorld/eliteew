EliteEW Trusted Substrate — first boot (EmpiierOS shell)

WARNING: Install ISO wipes the target disk. Dedicated hardware only.

## What starts automatically

1. **tty1:** `agetty --autologin eliteew-ts` → session-router → EmpiierOS kiosk **or** live GUI installer
2. `labwc` launches the single native EmpiierOS Shell; app and compositor retries are bounded, then tty1 holds a visible diagnostic
3. Root-owned `empiieros-runtime.service` serves authenticated Unix-socket IPC; it does not share the kiosk user's keyring trust
4. A session D-Bus is present for WebKitGTK; `gnome-keyring` is started only by the legacy Tauri profile

**Consoles:** tty1 only (autologin → session-router). tty2–tty6 gettys are masked. Root and `eliteew-ts` stay password-locked. Operator logs use provisioned key-only SSH when enabled, not a local console password. Live installer sudoers for wipe are stamped **only** on live media, not on the installed runtime.

## Smoke

```bash
eliteew-ts-smoke
```

## Legacy device request

The historical Tauri profile can start `eliteew-ts-secrets-up` for its device-request flow. The active `empiieros-shell` profile does not start that helper and does not treat a kiosk-user keyring as Runtime trust.

## Channel / seat

Live inside the Desktop Client (W-transport). Substrate WG peer is optional ops handoff — not required for the window.

## Ops

Change password immediately: `passwd`
