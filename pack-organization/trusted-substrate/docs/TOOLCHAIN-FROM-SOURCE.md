# Trusted Substrate — toolchain from source (W3)

**Pack:** `pack-organization/trusted-substrate/`  
**SoT:** [ELITEEW-TRUSTED-SUBSTRATE.md](../../../documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md) §6  
**Plan:** `ELITEEW-TRUSTED-SUBSTRATE-PLAN.md` (historical reference; absent from this checkout) §W3

## What this is

Pinned **host** toolchain (binutils + gmp/mpfr/mpc + gcc) built from source on **command-center**, with:

- Content-addressed cache under `$ELITEEW_TS_WORK_ROOT/toolchain-cache/sha256/<digest>/` (see `config/work-root.example.env`; default outside monorepo)
- Fail-closed SPDX gate against `licenses/ALLOWLIST`
- Rebuild **identity** from pins digest + deterministic `$PREFIX/etc/eliteew-ts-toolchain.env` (not a claim of bit-identical `gcc` binaries)

W4 rootfs must use **only** this prefix (`PATH=$PREFIX/bin:…`). Fedora W1 pilot ISO (distro gcc) is retired under `trash/`.

## Chicken-egg (ops-only)

| Pass | Compiler used | Label |
|------|---------------|--------|
| First build on a machine | Host distro `/usr/bin/gcc` (Fedora on command-center) | `toolchain_bootstrap=host-once` |
| Second+ builds | `$PREFIX/bin/gcc` if already installed | `toolchain_bootstrap=eliteew` |

The first host compiler is **honest and temporary**. It is not SoT for product images. Documented here so nobody claims “from-source” while silently baking distro gcc into the OS image without the EliteEW prefix.

Ops bootstrap checklist (human, not end-user):

1. Install build deps on command-center (`gcc`, `g++`, `make`, `curl`, `xz`, …) — ops only.
2. Host **GCC ≥15** defaults to C23: `toolchain-build.sh` passes `-std=gnu17` for GMP/MPFR/MPC configure on the chicken-egg pass (pinned GMP 6.3.0).
3. Missing `makeinfo`/texinfo: binutils/gcc builds use `MAKEINFO=/bin/true` and `--disable-gprofng` so docs are skipped (info pages are not SoT).
4. Host **g++ ≥15**: GCC 14.2 `libcody` needs `CXX='g++ -std=gnu++17'` on the chicken-egg pass (not CXXFLAGS alone — that breaks libcody’s C++11 probe).
5. `bash scripts/toolchain-fetch.sh` → `$ELITEEW_TS_WORK_ROOT/toolchain-cache/`
6. `bash scripts/toolchain-build.sh` → `$ELITEEW_TS_WORK_ROOT/toolchain-prefix/`
7. Record `$PREFIX/etc/eliteew-ts-toolchain.identity`
8. Rebuild once more with `PATH=$PREFIX/bin:$PATH` and compare identity (`toolchain-identity.sh --expect …`)

## Commands

```bash
cd pack-organization/trusted-substrate

# SPDX gate (any package→SPDX manifest)
bash scripts/spdx-allowlist-gate.sh --manifest /path/to/manifest.txt

# Fetch pins into CA cache
bash scripts/toolchain-fetch.sh
bash scripts/toolchain-fetch.sh --dry-run   # plan only

# Build (hours; needs disk + RAM)
bash scripts/toolchain-build.sh --dry-run
bash scripts/toolchain-build.sh

# Identity
bash scripts/toolchain-identity.sh --write
bash scripts/toolchain-identity.sh --expect "$(cat work/toolchain-prefix/etc/eliteew-ts-toolchain.identity)"
```

Env overrides: `ELITEEW_TS_PINS`, `ELITEEW_TS_TOOLCHAIN_CACHE`, `ELITEEW_TS_TOOLCHAIN_PREFIX`, `ELITEEW_TS_TOOLCHAIN_JOBS`, `SOURCE_DATE_EPOCH`.

## Reproducibility policy (tolerance)

| Exact match required | Soft / out of identity |
|----------------------|------------------------|
| `toolchain/PINS` normalized digest | Bitwise identical `gcc` ELF (timestamps, ASLR of build host) |
| `$PREFIX/etc/eliteew-ts-toolchain.env` (versions, flags, dumpversion, SOURCE_DATE_EPOCH) | Parallel make ordering noise outside env file |

Second clean build **exit proof** = same `identity=` string from `toolchain-identity.sh`.

## Selftest

```bash
bash scripts/selftest-w3.sh
# Full gcc wall-clock (operator):
ELITEEW_TS_SELFTEST_SKIP_TOOLCHAIN_BUILD=0 bash scripts/selftest-w3.sh
```

Default selftest **skips** multi-hour gcc build; still proves SPDX fail-closed, pins parse, dry-run fetch/build, and **two-pass identity match** on a fixture env.
