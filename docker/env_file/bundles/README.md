# Prod-core env bundles

- `prod-core.env.tar.sops` — encrypted bundle (commit after prod-core-env-sops-encrypt.sh).
- `prod-core.env.tar` — plaintext tar (**gitignored**); build only on command-center; do not leave beside sops after encrypt.
- `.sops.yaml` — set age recipient before first encrypt.
- Private age key: `~/.config/sops/age/keys.txt` on .136 only.

See documentation/platform/PROD-CORE-CONFIG-PLANE.md.
