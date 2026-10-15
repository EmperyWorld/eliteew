# Trusted Substrate — post-install smoke

## One command

```bash
eliteew-ts-smoke
```

## Expect (Tauri RPM kiosk)

1. After reboot: **agetty autologin** → **labwc** + EliteEW Desktop Client on tty1 (no password prompt).
2. Client window is **fullscreen** (no titlebar min/max/close chrome).
3. F2: `eliteew-ts` / `eliteew-ts-change-me` must succeed.
4. Start from Hub opens the **product as a second window** (also fullscreen).
5. Quit/crash → **one** app returns in a few seconds (no stacked launchers).
6. Break-glass: Ctrl+Alt+F2 → `eliteew-ts`.
7. Device request: Hub «Подготовить файл» writes `~/EliteEW/Import/eliteew-device-request-*.json`. Session must have `gnome-keyring-daemon` (`eliteew-ts-secrets-up`: `--login` then `--start`) so `org.freedesktop.secrets` login collection is writable.
8. Channel/seat: inside the Desktop Client — not substrate smoke scripts.

## Not expected

- Smoke-stub shell text as the product UI.
- Substrate WG handoff as a required first step for the app to appear.
- Prepare succeeding without `org.freedesktop.secrets` / writable login collection (missing gnome-keyring or secrets-up stopped at `--login` only).
- Multiple `eliteew-desktop-client` / labwc autostart loops after Close or compositor restart.
