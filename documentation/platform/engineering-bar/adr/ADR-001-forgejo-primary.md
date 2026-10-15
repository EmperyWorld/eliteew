# ADR-001: Forgejo in Russia is the git origin

- Status: superseded for the EliteEW monorepo by [ADR-004](ADR-004-github-development-canon.md)
- Date: 2026-09-23

The decision below is historical. EliteEW monorepo development and the public
corresponding-source repository follow ADR-004. EmpiierOS git hosting in the
decision below is unchanged and is outside ADR-004.

## Context

The OS sources must sit on infrastructure in the Russian Federation for registry item «и». GitHub remains a backup remote on the monorepo. EmpiierOS has no GitHub remote.

## Decision

- Monorepo `origin` is `ssh://git@130.193.43.111:2222/eliteew/powered_by_emperyworld.git` (Forgejo, zone `ru-central1-b`).
- EmpiierOS `origin` is `ssh://git@130.193.43.111:2222/eliteew/empiieros.git`.
- Do not `git push` to GitHub. The monorepo remote named `github` is backup only.
- There is no HTTPS domain for this git. Do not invent one.
- Do not commit `dl/`, rootfs images, or `SECRETS-HANDOFF`.

## Consequences

Agents and people push only when the operator asked, and only to `origin`. A push to `github` is a hard fail even if a hook is bypassed.
