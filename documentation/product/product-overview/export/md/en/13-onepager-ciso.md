# Security / perimeter overview

Compressed entry. Full path: [P2](02-threats-and-protection.md) → [P2a](02a-agentless-instant-access.md) → [P7d](07d-edge-wall-one-click.md) → [P9a](09a-controlled-licenses-sealed.md) → [P8a](08a-atomic-conditional-access.md) → [P8](08-tauri-clients-ota.md) → [P7c](07c-trusted-phone-e2ee.md) → [P12](12-honest-limits.md) → [P3](03-regulatory-map.md).

## In one paragraph

EliteEW adds a **work layer** on a personal device: organization files and apps
stay in the contour, without a system agent on the personal OS as the normal
path. Outside — a closed perimeter and access by granted trust. Native
Connected/FoFline clients bind identity ∧ service entitlement ∧ channel ∧
device (not universal for every browser path). Chat E2EE is by consent, with a
key on the phone. The regulatory map “helps the contour” and is **not** a
certificate. Gift model — [P3e](03e-delivery-models.md).

## Thesis map

| Topic | Meaning | Chapter |
|-------|---------|---------|
| Shadow IT / personal messengers | Mass channel outside the perimeter | P2 |
| Firewall / AV / full DLP | Does not replace | P2 |
| Access without a personal-OS agent | Fast work-layer grant | P2a |
| External perimeter | Default-deny + trust | P7d |
| Service access / capsules | Managed place access, revocable | P9a |
| Native conditional access | Identity ∧ entitlement ∧ channel ∧ device | P8a |
| Client updates | Signed channel, fail-closed | P8 |
| Chat E2EE | Option, not default | P7c |
| Sterile disk / air-gap | Not an absolute | P12 · P10 |
| Norms and certification | Helps; does not replace | P3 |

Limits — [P12](12-honest-limits.md). Formula — [P1](01-what-is-eliteew.md).
