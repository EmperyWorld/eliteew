# EliteEW license and third-party map

SPDX-FileCopyrightText: 2026 Кундухов Артём Георгиевич (po&T)
SPDX-FileCopyrightText: 2026 Кундухова Татьяна Александровна (TZBrand)
SPDX-License-Identifier: MIT

This map explains license precedence in the monorepo. It is not a replacement
for generated SBOMs, Buildroot `legal-info`, dependency lockfiles, or an
upstream license file.

## Precedence

1. A license or SPDX identifier on a file controls that file.
2. A nearer component `LICENSE`, manifest license field, or upstream package
   recipe controls that component.
3. Unmodified third-party material and patches against it retain the
   applicable upstream license.
4. First-party software without a more specific notice is
   `MIT` under the repository root `LICENSE`.

The root MIT license does not overwrite an existing MIT, Apache, GPL, LGPL,
MPL, BSD, ISC, font, media, or other upstream grant.

## Components with explicit MIT notices

These components keep their existing MIT grant:

| Component | License evidence |
|-----------|------------------|
| Trusted Substrate GUI installer | `pack-organization/trusted-substrate/installer/LICENSE` and `Cargo.toml` |
| Trusted Substrate state-unlock agent | `pack-organization/trusted-substrate/state-unlock-agent/LICENSE` and `Cargo.toml` |
| EliteEW KBSEW MCP tool | `tools/eliteew-kbsew-mcp/LICENSE` and `pyproject.toml` |
| Shared web frontend | `shared/web/frontend/package.json` |
| Landing application | `shared/web/landing/package.json` |

Previously distributed versions remain under the license delivered with those
versions. A later repository-wide default cannot revoke those grants.

## Trusted Substrate and Buildroot

| Material | License treatment |
|----------|-------------------|
| Linux kernel | `GPL-2.0-only WITH Linux-syscall-note`; kernel source and notices come from upstream |
| Buildroot build system | `GPL-2.0-or-later`; packages keep per-recipe licenses |
| labwc | Upstream GPL license recorded by its Buildroot recipe |
| gnome-keyring | Upstream GPL license recorded by its Buildroot recipe |
| First-party board configuration, policy, scripts, and units | Root default `MIT`, except files with a specific notice |
| Patches under `config/buildroot/patches/` | Same license as the upstream files they modify, unless the patch says otherwise |
| Firmware and media | Their upstream redistribution terms; inclusion is not relicensing |

The Buildroot output is a license aggregate. Its authoritative release packet
must come from `make legal-info` for the exact image configuration.

## Language and package dependencies

- Rust crates, Python packages, JavaScript packages, Android dependencies, and
  container base images keep their upstream licenses. Cargo, Python, pnpm, and
  Gradle metadata are evidence inputs, not a blanket license grant.
- Lockfiles and generated SBOMs describe dependency versions; they do not
  relicense dependency source or binaries.
- Generated API clients are governed by the license of their generator output
  and first-party template/runtime code, with any embedded upstream notices
  preserved.
- Minified or vendored assets such as Mermaid retain their upstream license and
  notice even when copied into a generated documentation export.
- Fonts, icons, audio, video, model files, and example content must be checked
  against their adjacent notice or source record before redistribution.

## Resolved dependency metadata (2026-09-28)

- SPA `khroma@2.1.0` omits a machine-readable license field; its pinned
  [upstream license](https://github.com/fabiospampinato/khroma/blob/v2.1.0/license)
  is MIT. The frontend gate binds this resolution to that exact version.
- Python `clamd@1.0.2` declared only an ambiguous `LGPL` label and shipped no
  dedicated license file. It was removed from the API image dependency graph;
  EliteEW now speaks the bounded ClamAV PING/INSTREAM Unix-socket protocol with
  first-party MIT code.
- Python `html2text` uses GPL-3.0-or-later and PyMuPDF uses its AGPL-3.0 branch
  in the API dependency graph. These dependencies remain GPL/AGPL; the MIT
  change does not relicense them. Preserve upstream notices and source
  obligations and review combined distributions before release.
- Connection Agent Rust metadata has no missing/custom license fields for the
  Linux target. MPL dependencies remain under MPL at their file boundary.

## Release gate

Before a public source or binary release:

1. Scan manifests and lockfiles for unknown, paid, royalty-bearing, GPL/AGPL,
   and custom licenses.
2. Generate the edition-specific SBOM.
3. Run Buildroot `legal-info` for every shipped Trusted Substrate image.
4. Preserve all upstream license texts and notices in the distributed
   artifact.
5. Resolve every `unknown` or missing license; do not silently classify it as
   AGPL, MIT, or proprietary.

The current map records policy, not a claim that the final release scan has
already passed.
