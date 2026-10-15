# P2 — Threats and protection

**Diagram:** [D02](assets/diagrams/D02-threat-classes.md)

## The problem (channel, not people)

A common leak path: personal messengers, personal clouds, paste into an external
AI. A VPN closes a pipe but does not see inside a personal app. Classic endpoint
DLP often wants an agent — fragile on BYOD.

EliteEW is a **fast lever** on top of the current security stack: separate work
from personal. It does **not** replace firewall / antivirus / full DLP.

## Threat classes → product response

| Class | What happens | EliteEW response |
|-------|--------------|------------------|
| Shadow IT / personal messenger | Work files leave into a personal channel | Work chat/files inside the contour (P7a) |
| Personal clouds | Copy outside org control | Files in the managed library (P4a) |
| Paste / external AI | Strategy fragments leave | AI and materials stay in the project contour (P5b) |
| BYOD without separation | Personal OS = work desk | Browser / APK layer without an admin agent on the personal OS |
| Open exposure | Services open to everyone | Edge / granted trust (P7d) |
| Untrusted device / OTA | Client substitution | Client trust boundaries (P8) |
| Insider / roles | Excess rights | Org/project roles (P5a) |
| Screen photo | Analog channel | Digital-channel minimization — not 100% (P12) |
| “Sterile disk on every edition” | No traces on personal disk | Not a universal promise (P12) |

Host / DIY / EliteEW comparison — [P1](01-what-is-eliteew.md); limits — [P12](12-honest-limits.md).
