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
