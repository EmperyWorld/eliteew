# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — post-install black screen: kiosk exit on missing client + incomplete archive.
# ---

# trusted-substrate — installed kiosk getty black-loop (missing client die)

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-09` |
| **product_id** | `trusted-substrate` |
| **symptom** | Install Done; reboot — no kiosk, black screen; same chronology as live bring-up failures |
| **failure layer** | Install payload SoT + kiosk session lifecycle |
| **root cause** | (1) Archive lacked DejaVu + i915 + Desktop Client while live had partial injects. (2) `eliteew-ts-kiosk` called `die` after 30s when client missing → agetty `Restart=always` black-loop. |
| **fix** | pack-metal syncs fonts/i915 (+ optional client); apply `assert_extracted_metal_stack`; kiosk **holds tty1 forever** if payload missing (never exit). |
| **verification** | Archive lists DejaVu + i915 + client; kiosk contains hold guard; selftest/pack fail-closed. |
| **also_affects** | Any install without shipping Tauri client |
