# P10c — Ops scale: deploy and control (not user CLI)

## Thesis

Empery / contour operators keep **hundreds** of automations for deploy, control,
and care (on the order of **250–300+** scripts and wrappers). That is a scale
orientation — not “thousands” and not an invented round number.

For an **organization employee** that means: recovery and rollout belong to the
operator and Admin panel — **not** “open a terminal and run a deploy script.”

In self-hosted / on-prem the same principle: ops scale sits with the
organization’s **IT/SI**. Managed enterprise ops and architect participation can
be a separate accompaniment — see [P3e](03e-delivery-models.md).

Desk Admin is a **lightweight admin panel** for responsible people (people,
catalog, queues) — not a full IdP admin replacement and not a day-to-day
end-user feature.

Comparisons — [P1](01-what-is-eliteew.md); limits — [P12](12-honest-limits.md).
