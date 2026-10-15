# P3f — Receiving the gift in-house (artifacts · Day‑0…90)

**Diagram:** [D12](assets/diagrams/D12-transfer-handover.md)  
**Gift & license:** [P3c](03c-full-complex-source.md) · **how to use it:** [P3e](03e-delivery-models.md)  
**Do not confuse with:** an operator ops runbook · end-user CLI · “someone else’s production secrets in a zip”

## Why this chapter exists

The code is already open under MIT. An organization needs a practical answer:
**which artifacts to verify**, what will never arrive with a contour handoff, and
how to stand up your own instance in the first weeks without mistaking the gift
for perpetual author staffing.

## Artifact classes (not a secret manifest)

Guidance for self-host / on-prem due diligence. The MIT right to use first-party
code does **not** depend on this list.

| Class | Usually present | Usually absent |
|-------|-----------------|----------------|
| Source | Public MIT source + release commit/tag | Foreign SaaS accounts, foreign personal data, foreign keys |
| Documentation | Current product/platform canon for evolution | Internal drafts, agent dialect notes |
| Build | Build recipes, test contours without prod secrets | Passwords, host keys, live SOPS bundles |
| Sample config | Scrubbed templates / edition profiles | Live URLs/IPs, another operator’s IdP client ids |
| Clients | Desktop / mobile sources or artifacts in an agreed scope | Foreign store certificates without a separate transfer |
| Knowledge | Agreed knowledge sessions — **only if** accompaniment was arranged | A promise of “authors forever” |
| Brand | Only if mark use was separately agreed | Automatic right to present a fork as official EliteEW |

**Rights:** first-party default is `MIT`; explicit component notices and
third-party components keep their own licenses (third-party map + release SBOM).
Marks and names are separate. This pack is **not** a legal opinion.

## “Day of acceptance” logic

1. Public source link and exact commit/tag (+ agreed binaries if needed).
2. Checklist of the classes above (not end-user CLI).
3. If accompaniment exists — a contact for the acceptance window (not “eternal user support”).
4. An implementation architect / mentor — **only** if separately arranged ([P3e](03e-delivery-models.md)).

## Day‑0…90 orientation

Timing depends on IT/integrator maturity and edition. Numbers are orientation,
not a contractual SLA.

| Phase | Orientation | Focus | Outcome |
|-------|-------------|-------|---------|
| **H0 Verify artifacts** | Day 0–14 | Source, commit/tag, builds, docs | “What we need for our stand is here” |
| **H1 First stand** | Day 14–45 | Your instance, IdP, role smoke | A live stand **you** own |
| **H2 Pilot** | Day 30–75 | One unit: desk, files, chat, roles ([P3a](03a-employee-day-adoption.md)) | A proven employee day |
| **H3 Scale** | Day 60–90+ | Your service runbooks ([P10c](10c-ops-scale-not-user-cli.md)) | Ops without end-user CLI |
| **H4 Stabilize** | per your plan | Edition criteria + needed apps | The contour lives with you |

Migration from a tool zoo — [P3g](03g-si-migration-playbook.md).

## Risks (short)

| Risk | Meaning | Anchor |
|------|---------|--------|
| No authors “inside the gift” | Evolution is yours / integrator | P3e · P3g · P12 |
| Key-person | Not the default | Only a separate arrangement |
| Incomplete artifact list | Disputes about what was verified | Commit/tag + class checklist |
| Security absolutes | Over-claims | [P12](12-honest-limits.md) |
| Third-party licenses | Foreign code | SBOM + NOTICE + third-party map |
| Foreign prod secrets | Not part of the gift | Do not include; scrub |

Questions — [Q&A](13-onepager-dd-rfi.md).
