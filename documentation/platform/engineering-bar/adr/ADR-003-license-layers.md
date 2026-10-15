# ADR-003: EliteEW adopts AGPL-3.0-or-later

- Status: superseded by [ADR-005](ADR-005-mit-license.md) on 2026-10-16
- Date: 2026-09-28
- Supersedes: ADR-003 decision dated 2026-09-23

## Context

EliteEW is moving from a source-restricted product model to a free-software
community model. The product includes network services, desktop clients,
mobile code, build and operations code, plus a Buildroot aggregate containing
components under their own upstream licenses.

The license must protect every user's freedom to run, study, modify, and share
the software while requiring operators of modified network versions to offer
the corresponding source to their users. Software freedom does not require the
official hosted service, managed enterprise delivery, support, certification,
or trademarks to be free of charge.

## Decision

- First-party software in this monorepo is licensed
  `AGPL-3.0-or-later` unless a file or nearer component license states
  otherwise.
- The repository root `LICENSE` contains the complete AGPLv3 text. `NOTICE`
  records the copyright holders and points to the trademark and exception maps.
- Existing explicit MIT components remain MIT. Previously distributed releases
  retain the license delivered with them.
- Linux, Buildroot, labwc, gnome-keyring, dependencies, generated third-party
  assets, firmware, and package patches retain their applicable upstream
  licenses. The AGPL default does not overwrite them.
- Community/self-hosted rights come from the software license and must not be
  conditioned on a paid seat activation. Hosted cloud, managed enterprise,
  support, certification, and other services may remain paid.
- Interactive network interfaces must provide an appropriate legal notice and
  a clear route to the exact corresponding source, consistent with AGPL
  sections 5 and 13.
- The EliteEW and Empery World names and logos remain governed by the separate
  trademark policy. The AGPL grant does not make modified forks official.
- Do not claim registry inclusion.

The external EmpiierOS repository is not silently relicensed by this
monorepo ADR. Its copyright holders must apply an equivalent explicit change
in that repository before an EmpiierOS release is represented as AGPL.

## Consequences

- Source publication and corresponding-source availability are release
  requirements, including build and installation scripts needed by AGPL.
- Service entitlements must be separated from the right to run a community
  build.
- `legal-info`, edition-specific SBOMs, dependency scans, and
  `THIRD-PARTY-LICENSE-MAP.md` remain mandatory. An unknown license is a defect
  or release block, not a value to guess.
- Trademark permission and paid service agreements cannot add restrictions to
  the AGPL software rights.
- External legal review remains required before the first public release; this
  ADR records the engineering decision, not legal advice.
