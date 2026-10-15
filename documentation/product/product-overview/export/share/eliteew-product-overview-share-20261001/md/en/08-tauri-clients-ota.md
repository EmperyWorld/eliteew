# P8 — Tauri clients and update trust

## Thesis

Besides the browser there are **native clients** (Tauri) for Connected /
offline-capable / FoFline-adjacent scenarios: launcher, access import, protected
channel, product start, and **signed** updates over a trusted channel.

| Invariant | Meaning for the organization |
|-----------|------------------------------|
| OTA fail-closed | Unsigned / revoked updates are not installed silently |
| Not kiosk / not Trusted Substrate | A laptop client ≠ a sealed OS carrier (P10b) |
| Do not mix products | Connected and FoFline are different channels; do not treat “both packages mixed” as normal |

**Not promised:** “any internet executable is trusted” · FoFline = air-gap.

Comparisons — [P1](01-what-is-eliteew.md); limits — [P12](12-honest-limits.md).
