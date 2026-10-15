# Contributing

Registry status: **NOT_READY**. Do not claim inclusion.

The root of this monorepo cannot hold product markdown. This file is the contributor contract.

## Remotes

- Push only to `origin` (Forgejo `ssh://git@130.193.43.111:2222/eliteew/powered_by_emperyworld.git`) and only when the operator asked in this turn.
- Do not push the `github` remote.
- Do not commit `dl/`, `rootfs.tar.gz`, image blobs, `.env` secrets, or EGRIP scans.

## Changes

- One concern per commit. The message says why.
- OS image package changes follow [buildroot-packages.md](buildroot-packages.md).
- Dependency and license gates: [DEPENDENCY-POLICY.md](DEPENDENCY-POLICY.md), [LICENSE-POLICY.md](LICENSE-POLICY.md).
- Cloud, mobile, and the Tauri agent are not the OS image. Do not mix their dependencies into the OS SBOM.

## Before merge

- [ ] License named. No new `unknown` in the image.
- [ ] No paid foreign SDK without an ADR and a finance note.
- [ ] No prebuilt rootfs substituted for a source build.
- [ ] No UI or security source pasted into docs.
- [ ] `bash scripts/eliteew/check-eng-bar.sh` exits 0.
- [ ] If Buildroot packages changed: `make legal-info` is scheduled or done, and the SBOM is not described as current until then.
