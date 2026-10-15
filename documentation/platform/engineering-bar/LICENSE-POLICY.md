# License layers

ADR-005 adopts `MIT` for first-party monorepo software that does
not carry a more specific license. The root license is a default, not a claim
over third-party work.

| Layer | License | Evidence / boundary |
|-------|---------|---------------------|
| First-party monorepo default | MIT | Root `LICENSE` + `NOTICE` |
| Trusted Substrate installer and state-unlock agent | MIT | Their own `LICENSE` files and Cargo manifests |
| Shared frontend and landing | MIT | Existing package manifests; prior grants remain valid |
| EliteEW KBSEW MCP tool | MIT | Component `LICENSE` and Python manifest |
| Linux 6.12.20 | GPL-2.0-only WITH Linux-syscall-note | Buildroot kernel; no blanket MIT relabel |
| Buildroot 2025.02.1 | GPL-2.0-or-later | Build system; packages are licensed per recipe |
| labwc 0.8.3 | Upstream GPL license | `BR2_EXTERNAL` recipe |
| gnome-keyring 50.0 | GPL-2.0-or-later | `BR2_EXTERNAL` recipe |
| Dependencies, firmware, fonts, media, generated third-party assets | Upstream license | Adjacent notices, manifests, SBOM, and `legal-info` |
| External EmpiierOS source repository | Its own repository license until changed there | Not silently relicensed by this monorepo |

Cloud, mobile, Tauri, and Buildroot are different release/SBOM scopes even
when their first-party code shares the root MIT default.

## Compatibility and linking

- MIT applies to first-party code. GPL/AGPL dependencies retain their own
  copyleft terms; distributing a combined work requires compatibility review.
- Kernel syscall use and process/socket communication do not relicense the
  userspace program. Copied or linked code requires compatibility review.
- LGPL, MPL, custom, firmware, model, font, and media licenses remain review
  inputs under the dependency policy.
- A custom “free of charge” grant is not a free-software license. Do not bundle
  it into an GPL or MIT product surface without an explicit compatibility
  decision; the SPA removed GSAP 3.15.0 for this reason.
- Package patches stay under the license of the upstream files they modify
  unless the patch carries a valid different notice.
- A dependency scan must preserve every upstream license; never replace
  `unknown` with GPL or MIT to make a report green.

## Community and paid services

- The MIT right to run a community/self-hosted build is not a paid
  entitlement.
- Official cloud hosting, managed enterprise operations, certification,
  support, and warranties may be paid services.
- A service agreement cannot remove rights already granted by the MIT for the
  software.
- Distributions must preserve the MIT copyright and permission notice.
- Source links remain a project transparency feature; MIT does not require
  publication of modifications or corresponding source for network services.
- Living UI route: hosted SPA Start footer **Source code** and Connection Agent
  **Ещё → О приложении → Исходный код** both open
  `https://github.com/EmperyWorld/eliteew`. The Tauri route is a fixed Rust
  target (`source_code`), not a caller-supplied URL. Which repository is the
  write authority, and which paths stay out of that public tree, is
  [ELITEEW-GITHUB-REPOSITORY.md](../ELITEEW-GITHUB-REPOSITORY.md).

## Marks and claims

- The software license does not grant trademark rights. Follow
  [ELITEEW-TRADEMARK-POLICY.md](../ELITEEW-TRADEMARK-POLICY.md).
- Do not write “включён в реестр Минцифры” or “included in the Ministry
  registry”. The filing has not been sent.

Changing this policy requires an ADR. A silent license or exception change is a
release blocker.
