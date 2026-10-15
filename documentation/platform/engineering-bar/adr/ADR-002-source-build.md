# ADR-002: The OS image is built from source

- Status: accepted
- Date: 2026-09-23

## Context

Registry reviewers will ask whether the image is a rebuilt foreign distribution. The factory is Buildroot 2025.02.1 plus a Trusted Substrate external tree. The former Fedora pilot carrier is retired under `trash/` and is not a product image or release path.

## Decision

- Release images come from `buildroot-build.sh` and the EmpiierOS overlay packager, compiling upstream sources.
- Do not substitute a prebuilt rootfs, a vendor ISO, or a downloaded compiler blob for that build.
- Download caches and image tarballs stay out of git.
- One canonical rootfs hash is recorded after a build. Do not change it inside an unrelated patch.

## Consequences

Missing upstream tarballs are fetched and hash-checked. They are not replaced with a binary that happens to boot.
