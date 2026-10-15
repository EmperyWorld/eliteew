# Repository scripts

Run repository wrappers from the monorepository root. [docker/scripts](../docker/scripts/README.md) owns deployment/operator CLIs; `scripts/docker` is its compatibility symlink. [tools](../tools/README.md) owns developer/CI utilities, while [shared/tools](../shared/tools/README.md) contains packages imported by the API.

- [_lib/repo-root.sh](_lib/repo-root.sh): repository path resolution.
- [doc/](doc/): tracked Markdown listing and documentation drift checks.
- [eliteew/](eliteew/): local validation, manifests/profiles, host virtual-environment setup, Connection Agent issuance/build helpers, offline-policy parity, release probes and operator wrappers.
- `eebackup` / `eebackupfull`: backup wrappers with filesystem side effects.
- Meet media scripts: installation/verification helpers; inspect the selected command and target first.

Safe discovery commands:

```bash
bash scripts/eliteew/validate-local.sh --help
bash tools/check_all.sh --help
bash scripts/doc/list-md.sh
```

The validation help paths and manifest/profile checks were exercised during the documentation audit; broad builds and operator mutations were not. Deploy, backup, trash-move, credential issuance and host installation are separate authorized operations, not part of documentation validation.

Retired `EliteEW/scripts/*` aliases are absent from this checkout. Use current root paths, [developer setup](../documentation/platform/DEVELOPER-SETUP.md) and [infrastructure guide](../documentation/platform/INFRASTRUCTURE-SOURCE-GUIDE.md). Historical one-shot helpers under `trash/` are not supported living entry points.
