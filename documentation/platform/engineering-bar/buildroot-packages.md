# Adding a Buildroot package to the OS image

Scope: `pack-organization/trusted-substrate/` and the factory tree it drives. Cloud containers are a different gate.

## Recipe

- `*_SITE` is the upstream directory. For GNU, the real URL contains `/gnu/` (`https://ftp.gnu.org/gnu/<name>/`). `BR2_GNU_MIRROR` alone does not insert that segment. Do not invent a URL; copy it from the upstream project and pin sha256 from the project's `.hash` or a file you hashed yourself.
- `*_SOURCE` is the tarball name Buildroot expects in `dl/<pkg>/`.
- `*_LICENSE` and `*_LICENSE_FILES` are mandatory. `unknown` is a debt, not a default you may merge.
- Hash the tarball and every license file you name. `labwc` is the pattern: version tarball plus `LICENSE`.
- No prebuilt binary in place of the source tarball. No rootfs committed to git. No `dl/` cache in git.

## External packages

New OS packages that are not in Buildroot 2025.02.1 go under `config/buildroot/external/package/<name>/` with `Config.in`, `<name>.mk`, `<name>.hash`.

Tree patches that must survive a clean extract go in `config/buildroot/patches/NNNN-*.patch`. `buildroot-build.sh` applies those only when it extracts Buildroot (`RESUME=0`). A resume build does not re-apply them.

## After the change

```bash
make -C /data/repos/eliteew-ts-factory-work/buildroot-output \
  BR2_DL_DIR=/data/repos/eliteew-ts-factory-work/buildroot-cache/dl \
  legal-info
```

Do not call the registry SBOM current until that command exits 0 and someone refreshes `sbom-legal-info.csv`. A mid-run `manifest.csv` is not the SBOM.

`bash scripts/eliteew/check-eng-bar.sh` from the monorepo root reminds you when a package file is dirty. It does not run `make legal-info`.
