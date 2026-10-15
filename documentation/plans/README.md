# documentation/plans/ (operator-local)

**Not living product canon.** Process plans, roadmaps, remediation wave logs, and rollout checklists live here so they do not compete with SoT under `product/` / `platform/` / `api/` / `database/` / `reference/`.

## Git

- Tree is **gitignored** except this `README.md`.
- Fresh clones do **not** include plan bodies; keep local copies on the workstation if needed.
- Do **not** treat paths under `plans/` as Definition-of-Done or agent entrypoints.

## Layout

Mirror of former living paths:

```text
documentation/plans/
  api/
  platform/
  product/
    desktop/
    ewa/
    professional-worlds/
```

## When writing

- New **process plan / roadmap / remediation log** → create under `documentation/plans/...` (local only).
- Living contracts stay under the five living sections; link with prose:
  `` `documentation/plans/<rel>` *[operator-local process plan; gitignored — not living canon]* ``
- Prefer promoting decided waves into living SoT, then leave the plan as historical local notes.

Canon hubs: [INDEX.md](../INDEX.md) · [DOCUMENTATION-WRITING-GUIDE.md](../reference/DOCUMENTATION-WRITING-GUIDE.md).
