# ADR-004: GitHub is the EliteEW monorepo development canon

- Status: accepted
- Date: 2026-09-28
- Supersedes: ADR-001 for the EliteEW monorepo only

## Context

EliteEW corresponding source is already published to users as
`https://github.com/EmperyWorld/eliteew` (public source link, SPA
footer, Connection Agent). The same tree also holds command-center agent
configuration, the encrypted prod-core env bundle, and generated shell media
that cloud edge static serving depends on.

A single public repository cannot be both the place operators commit and a
dump of prod ciphertext. A filtered export cannot be the place operators
commit either: branch protection, review, and deploy provenance need one
write remote.

EmpiierOS git hosting is a different repository. This ADR does not move it.
This ADR does not claim a ministry-registry filing. Filing status remains
**NOT_READY** ([ENGINEERING.md](../ENGINEERING.md)).

## Decision

- The EliteEW monorepo has one write authority: the private repository
  `EmperyWorld/eliteew-dev`. Command-center clones that repository. Pull
  requests, required checks, and deploy SHAs refer to it.
- `EmperyWorld/eliteew` is the public corresponding-source repository. Humans
  do not push its default branch. A publisher identity updates it from
  `eliteew-dev` using the path rules in
  [ELITEEW-GITHUB-REPOSITORY.md](../../ELITEEW-GITHUB-REPOSITORY.md).
- Prod ciphertext (`docker/env_file/bundles/prod-core.env.tar.sops` and
  `docker/env_file/bundles/.sops.yaml`) stays in the development repository
  and is absent from the public repository.
- Shell media under `shared/web/frontend/public/audio/`,
  `shared/web/frontend/public/ewa/`, and `shared/web/landing/kuku2.mp4` is
  present in both repositories. Cloud edge static serving and a community
  build both read those trees from git.
- History is rewritten once, before the development repository becomes the
  remote command-center uses. After that cutover the history is not rewritten
  again to publish a subset.
- `git push` still requires an explicit operator request. After cutover, that
  push targets `eliteew-dev`. A push of the public default branch is allowed
  only for the publisher identity.

## Consequences

- Deploy and agent work follow `eliteew-dev` SHAs. The public repository SHA
  is an export id, not a prod deploy id.
- Until the cutover wave in
  `documentation/plans/platform/ELITEEW-GITHUB-REPOSITORY-PLAN.md` *[operator-local process plan; gitignored — not living canon]*
  is finished, agents do not push this monorepo to GitHub and do not switch
  `origin`.
- Customer OEM install (external IdP, checkbox installer) stays out of scope.
  The community one-click profile is a separate, later wave on top of this
  git layout.
- Replacing this split with one public repository requires a new ADR. The
  condition is that prod ciphertext and command-center agent configuration
  have already left git.
