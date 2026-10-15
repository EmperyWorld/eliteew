# Dependency policy

Revenue on the books used for the registry pack: **0 ₽**. Foreign royalties: **0 ₽**. Do not invent sales to make a percentage.

## Classes

| Class | Rule |
|-------|------|
| allow | OSI/FSF-style license named in the upstream file and compatible with the receiving component, no royalty |
| review | copyleft compatibility across a link boundary; firmware/model/media terms; custom or missing license strings |
| deny | paid foreign SDK or runtime royalty; `license = unknown` left in the image on purpose; a prebuilt OS dropped in as rootfs |

STOP and ask a human before adding anything in **deny**, or anything in
**review** that links into an MIT component or the separately licensed
external EmpiierOS runtime.

## Add a dependency

1. Name the license from the upstream file, not from memory.
2. Say whether money leaves the country for this component. If yes, stop: ADR plus a finance recount. The <30% line is not yours to waive.
3. Say whether the component is in the OS image or only in cloud/mobile/kiosk. Kiosk and cloud dependencies are not rows in the OS SBOM.
4. Buildroot packages: site URL, sha256, `*_LICENSE`, `*_LICENSE_FILES`. GNU sites need the `/gnu/` path segment. See [buildroot-packages.md](buildroot-packages.md).
5. New or changed package set: `make legal-info` on the factory output dir with `BR2_DL_DIR` pointed at the download cache. Do not commit `dl/` or `rootfs.tar.gz`.

## Current debts (P1)

These are not permission to add more of the same.

| Item | Fact | Next step |
|------|------|-----------|
| Buildroot's own source archive | legal-info warned it was not saved | save it on the next legal-info; do not claim the build-system tarball is in the manifest |
| dejavu 2.37 | manifest said `unknown` because `DEJAVU_LICENSE` was empty. The shipped LICENSE is Bitstream Vera plus public-domain DejaVu changes | patch `0006-dejavu-localedef-license.patch` sets the field. SBOM stays stale until the next legal-info |
| host localedef | same gap; sources are glibc | same patch, same SBOM lag |
| labwc LICENSE hash | legal-info printed `No hash found` for LICENSE | `labwc.hash` now pins that file. Re-run legal-info to clear the warning |
| skeleton / host-skeleton `unknown` | Buildroot in-tree skeleton, no upstream tarball | do not guess GPL/MIT or treat it as a paid SDK; record the Buildroot provenance |

No paid foreign SDK was found in the OS shell npm set or the runtime's direct crates on 2026-09-23. That scan is not a promise about the next commit.
