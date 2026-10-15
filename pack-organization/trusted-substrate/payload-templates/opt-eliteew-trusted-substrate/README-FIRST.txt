EliteEW Trusted Substrate — first boot (Tauri RPM kiosk)

WARNING: Install ISO wipes the target disk. Dedicated hardware only.

## What starts automatically

1. **tty1:** `agetty --autologin eliteew-ts` → real PAM session → `labwc` + Desktop Client (fullscreen)  
2. App restart loop inside labwc (launcher Hub + product second window) — **one** loop (`flock`); orphans reaped on compositor restart  
3. Session bus runs **gnome-keyring** (`eliteew-ts-secrets-up`) so device request export can use OS Secret Service  
4. If the compositor/session exits, getty comes back and autologins again  

Extra VT consoles (tty2–6) are masked. Operator maintenance uses provisioned SSH when enabled.

## Smoke

```bash
eliteew-ts-smoke
```

## Device request

Hub «prepare device request» writes `~/EliteEW/Import/eliteew-device-request-*.json`. Needs Secret Service (shipped). If prepare fails after password change and keyring wipe is required, regenerating `~/.local/share/keyrings/` also regenerates device keys — break-glass only.

## Channel / seat

Live inside the Desktop Client (W-transport). Substrate WG peer is optional ops handoff — not required for the window.

## Ops

Change password immediately: `passwd`
