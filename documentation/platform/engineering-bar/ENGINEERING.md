# Engineering bar — EmpiierOS image and this monorepo

Status of the registry filing: **NOT_READY**. This file is the coding bar, not a filing.

Two products share this git tree. Do not treat them as one SBOM.

| In the OS image (`empiieros-shell`) | Not in that image |
|--------------------------------------|-------------------|
| Buildroot 2025.02.1 Trusted Substrate, labwc, gnome-keyring, kernel 6.12.20 | Cloud SPA, API, Keycloak, mobile |
| EmpiierOS shell and runtime overlay from the other repo | Tauri connection-agent |
| First-party MIT installer and state-unlock agent | Retired Fedora pilot carrier (`os_trust=pilot`, historical only) |

First-party monorepo software without a nearer license is
`MIT`. This table separates OS-image SBOM scope; it does not
override the root license or any upstream component license. See
[LICENSE-POLICY.md](LICENSE-POLICY.md).

## Code

- Names say what the thing does. Side effects are visible at the call.
- Do not swallow errors. No empty `except`, no `pass` on failure, no `unwrap()` on a production Rust path without a comment that states the invariant.
- No dead code in the same change that adds the live path.
- New runtime behavior needs a test, or the PR says why a test cannot run here.
- User-facing OS copy is Russian first. Cloud UI follows the existing locale files for that app. Do not paste OS UI or security sources into docs, the site, or an SBOM dump.
- Do not log secrets, tokens, or private keys.
- Least privilege. Do not weaken auth or secure defaults for a demo unless a dev flag exists and the warning is in the same change.
- An OS image change does not silently replace the canonical rootfs hash. Record the new hash in the registry artifact pack as its own step.

## Build

The OS image is built from upstream source tarballs plus this tree's patches. A prebuilt rootfs, a distro ISO, or a downloaded toolchain blob is not a substitute. See [ADR-002](adr/ADR-002-source-build.md).

After a package list or license-field change, run `make legal-info` before calling the SBOM current. Checklist: [buildroot-packages.md](buildroot-packages.md).
