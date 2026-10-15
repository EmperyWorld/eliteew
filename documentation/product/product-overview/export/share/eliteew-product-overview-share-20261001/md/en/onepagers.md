# EliteEW — one-pagers + glossary (Markdown)

# Overview: gift to the world and your contour

A short page for people deciding whether to **receive EliteEW** as an open work
complex inside the organization.

## What it is

**EliteEW** = the organization’s work desk (apps, files, projects, AI on your data)  
**+** a closed work layer (personal and work stay separated)  
**+** first-party code as a **gift to the world** under MIT.

Not a host-OS replacement. Not “100% protection.” Not a certificate. Not
“receiving the gift locks authors onto your payroll forever.”

Formula — [P1](01-what-is-eliteew.md); license and license terms —
[P3c](03c-full-complex-source.md); limits — [P12](12-honest-limits.md).

## Four questions

| Question | Answer | See |
|----------|--------|-----|
| What is given to the world? | First-party code: run, study, modify, redistribute under MIT; preserve copyright and permission notices | [P3c](03c-full-complex-source.md) |
| What is outside the gift? | Author staffing, SLA, official brand, foreign secrets | [P3e](03e-delivery-models.md) · [P12](12-honest-limits.md) |
| Who stands the contour up? | Organization IT/security and/or an integrator; accompaniment is optional | [P3g](03g-si-migration-playbook.md) · [P10c](10c-ops-scale-not-user-cli.md) |
| How do we accept it in-house? | Source + commit/tag, artifacts, pilot, your own runbooks | [P3f](03f-transfer-bom-handover.md) · [Q&A](13-onepager-dd-rfi.md) |

## Editions

Cloud (hosted) · On-prem (organization contour) · Client/FoFline (device + channel; **not** air-gap) — [P10](10-editions.md).

## Next by role

| Role | Page |
|------|------|
| Security | [CISO](13-onepager-ciso.md) |
| Rollout | [industry](13-onepager-industry.md) · [P3g](03g-si-migration-playbook.md) |
| Terms | [glossary](glossary.md) |
| Full pack | [contents](00-README.md) |

---

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

---

# Rollout / industry overview

For rollout leads and people standing the contour up.

## In one paragraph

EliteEW is a **work environment** and a **gift to the world** under MIT: the
organization receives the code, deploys its own instance with IT/integrator
effort, and lives in its own contour. Accompaniment (if needed) is optional —
it does not replace the gift with a closed product story. Self-host cost
structure is payroll/host orientation, not a code tariff
([P3d](03d-tco-orientative.md) · [P3e](03e-delivery-models.md)).

## Map

| Topic | Chapter |
|-------|---------|
| What it is | [P1](01-what-is-eliteew.md) |
| Gift / MIT / license terms | [P3c](03c-full-complex-source.md) |
| How to use the gift | [P3e](03e-delivery-models.md) |
| Employee day | [P3a](03a-employee-day-adoption.md) |
| Industry accents | [P3b](03b-industry-profiles.md) |
| Accept in-house | [P3f](03f-transfer-bom-handover.md) |
| Migration from a zoo | [P3g](03g-si-migration-playbook.md) |
| Roles | [P5a](05a-roles-org-project.md) |
| Files | [P4a](04a-files-two-planes.md) |
| Limits | [P12](12-honest-limits.md) |

---

# Questions before deep reading

Short answers. **Does not replace:** a legal opinion, certification, or transfer
of someone else’s secrets.

Related: [P3c](03c-full-complex-source.md) · [P3e](03e-delivery-models.md) ·
[P3f](03f-transfer-bom-handover.md) · [P3g](03g-si-migration-playbook.md)

## Gift and license

| Question | Answer |
|----------|--------|
| First-party license? | `MIT` (root LICENSE); not one license for the whole monorepo |
| What freedoms? | Run, study, modify, redistribute under MIT |
| Modified network service? | MIT does not require publishing service source code |
| Third-party / MIT exceptions? | Their own licenses; map + SBOM / NOTICE |
| EliteEW brand? | Not transferred by MIT |
| Authors / SLA inside the gift? | No; accompaniment is a separate option |
| Service tariffs in this pack? | No — this pack carries no tariffs |

## Product and security

| # | Question | Answer | Chapter |
|---|----------|--------|---------|
| 1 | Host-OS replacement? | No — a layer on the host | P1 |
| 2 | Agent on personal OS? | Not the normal path | P2a |
| 3 | Certificate “out of the box”? | No | P3 |
| 4 | FoFline air-gap? | No | P10 · P12 |
| 5 | Always E2EE? | No; by consent | P7c |
| 6 | Native conditional access? | For Connected/FoFline native | P8a |
| 7 | Sterile disk everywhere? | Not as an absolute | P12 |
| 8 | Screen photos impossible? | No | P12 |
| 9 | Where is data? | By edition | P10 |
| 10 | Mobile = full desk? | A subset | P7e |

## Receiving it in-house

| # | Question | Answer | Chapter |
|---|----------|--------|---------|
| 11 | What to verify on acceptance? | Source, commit/tag, build, docs, SBOM | P3f |
| 12 | Foreign production secrets? | Not part of the gift | P3f |
| 13 | Who stands it up? | Organization IT / integrator | P3e · P3g |
| 14 | Migration from a tool zoo? | Waves, not one button | P3g |
| 15 | PoC? | Yes; against real capabilities | P3g · P12 |
| 16 | Self-host cost structure? | Orientation (payroll/host), not a code tariff | P3d |
| 17 | Official brand on a fork? | Only a separate mark agreement | P3c · P3e |
| 18 | OSS / third-party? | Map + release SBOM | P3c · P3f |

## Next

| Role | Path |
|------|------|
| Overview | [executive](13-onepager-executive.md) |
| Security | [CISO](13-onepager-ciso.md) |
| Rollout | [industry](13-onepager-industry.md) · [P3g](03g-si-migration-playbook.md) |
| Terms | [glossary](glossary.md) |

---

# Summary matrix (Host | DIY | EliteEW)

Compression of chapters already written; no new promises.

| Axis | Host | DIY | EliteEW | Chapter |
|------|------|-----|---------|---------|
| Role in the day | Host OS + apps | Host OS + packages | Work **layer** on the host | P1 |
| Shadow IT | Personal apps nearby | Same | Contour for chat/files/AI | P2 |
| Endpoint agent on BYOD | Typical for DLP | Typical | **No** admin agent on personal OS | P2a |
| Regulation / attestation | Separate contour | Separate | Helps the contour; **not** an attestation | P3 |
| Employee day | Scattered SaaS | Same | One swimlane | P3a |
| Industry organization | Verticals | DIY | Accent profiles | P3b |
| Source / instance | Closed OS | Open kernel | MIT gift · self-host | P3c |
| Gift vs accompaniment | — | DIY | Code open; accompaniment optional | P3e |
| Bring-up in-house | Volume / image | Distro + packages | Commit/tag + build + SBOM · Day‑0…90 | P3f |
| SI / migration | Change apps | DIY cutover | Waves M0–M5 · PoC on real capabilities | P3g |
| Cost structure | Licenses+agents | DIY labor | Structure · Discovery | P3d |
| Files | Disk/cloud | FS/DIY | PG + object store + ACL | P4a |
| Collab docs | 365 / third-party | self-host office DIY | Contour editor | P4b |
| AI | External chat | DIY LLM | EWA **≠** Experts | P5 |
| Roles | group directory | LDAP DIY | Owner/lead/participant | P5a |
| Generations | External SaaS | DIY GPU | Energy / quotas | P5b |
| Mobile | MDM apps | Same | Satellite · subset | P7e |
| E2EE chat | Signal etc. | Same | Opt-in · key on phone | P7c |
| Edge access | VPN/firewall | DIY | Wall + issued trust | P7d |
| Native client | Store/desktop installer | RPM/portable build | Tauri + signed OTA | P8 |
| Conditional access | Entra CA | DIY | Atomic native scope | P8a |
| Service access | Volume | DIY | Capsule/entitlement; MIT self-host not blocked | P9a |
| Editions | SaaS/RDS | Self-host | cloud/onprem/client | P10 |
| FoFline air-gap | — | — | **No** (local+channel) | P10 |
| Live sealed OS | Image | Live USB | Substrate **target** | P10b |
| Sterile disk | — | — | Not a universal promise | P12 |
| Analog (photo) | Not closed by OS | Not closed | Minimization · not 100% | P12 |

## One-pager index

| File | Audience |
|------|----------|
| [13-onepager-executive.md](13-onepager-executive.md) | Committee / organization |
| [13-onepager-ciso.md](13-onepager-ciso.md) | Security |
| [13-onepager-industry.md](13-onepager-industry.md) | Adoption / industry |
| [13-onepager-dd-rfi.md](13-onepager-dd-rfi.md) | DD / RFI (adoption + security) |
| [03e-delivery-models.md](03e-delivery-models.md) | Gift to the world: how to use |
| [03f-transfer-bom-handover.md](03f-transfer-bom-handover.md) | Bring-up · artifacts |
| [03g-si-migration-playbook.md](03g-si-migration-playbook.md) | SI · migration · PoC |
| [glossary.md](glossary.md) | Terms |

**Before external share:** no IPs/ports/client ids/ops-CLI; absolute security claims only via [P12](12-honest-limits.md).

---

# Glossary

| Term | Meaning in this pack |
|------|----------------------|
| **EliteEW** | Work environment (desk, apps, files, communications, AI) + managed layer; not a host-OS replacement |
| **Gift to the world** | First-party code released as free software under MIT |
| **MIT** | Permissive license: use, modify, and redistribute while preserving copyright and permission notices |
| **Corresponding source** | Source of the version you make available to users of a modified network service |
| **First-party** | EliteEW authors’ code without a narrower file license; default MIT |
| **Third-party** | Foreign components — their own licenses; see map / SBOM / NOTICE |
| **Layer / contour** | Organization work environment on top of the host OS |
| **Self-hosted** | Running the gift yourself |
| **Accompaniment (optional)** | Help with acceptance/operations; does not enclose the source |
| **Acceptance artifacts** | Source, commit/tag, build, docs, SBOM — [P3f](03f-transfer-bom-handover.md) |
| **SI** | Systems integrator / rollout partner |
| **Edition cloud / on-prem / client** | Where the contour runs — [P10](10-editions.md) |
| **Agentless** | No system agent on a personal OS as the normal access path |
| **Service access (seat / capsule)** | Access to a hosted/trusted channel; **not** the MIT code license |
| **E2EE (chat)** | End-to-end encryption by consent |
| **Edge / wall** | Default-deny outside + access by granted trust |
| **MusicForge** | Current “Song Studio” |
| **PoC** | Proof against real capabilities — [P3g](03g-si-migration-playbook.md) |
| **Q&A** | [13-onepager-dd-rfi.md](13-onepager-dd-rfi.md) |

---

