# EliteEW GitHub repository — development canon and public source

**Status:** Living target canon (2026-09-28). Cutover and community install waves are not done.
**Process plan:** `documentation/plans/platform/ELITEEW-GITHUB-REPOSITORY-PLAN.md` *[operator-local process plan; gitignored — not living canon]*. This file wins on contracts.
**Decision:** [engineering-bar/adr/ADR-004-github-development-canon.md](engineering-bar/adr/ADR-004-github-development-canon.md).
**Lock:** `tools/github_repository_policy.py` (placement of paths, repository ids, community install constants).

## 1. Intent

People commit in one place. The public corresponding-source URL stays the URL
already shown to users. Prod ciphertext and command-center agent configuration
do not ship in that public tree. Cloud shell media stays in git because the
edge static media layer and any community build read it from the checkout.

## 2. Repositories

| Role | Repository | Who may push the default branch |
|------|------------|----------------------------------|
| Development canon | `EmperyWorld/eliteew-dev` (private) | Maintainers, via pull request into the protected default branch |
| Public corresponding source | `EmperyWorld/eliteew` (public) | Publisher identity only |

Public URL, fixed in product UI and in this canon:

`https://github.com/EmperyWorld/eliteew`

Command-center, deploy provenance, and agent sessions use `eliteew-dev`.
A prod release records the development-canon SHA. The public SHA is the
export of that commit, not a second line of development.

EmpiierOS git hosting is outside this canon.

## 3. Write control

On `eliteew-dev`:

- The default branch accepts merges from pull requests.
- Required check: `.github/workflows/eliteew-pr-gate.yml` (architecture guard
  and hygiene). A red check does not merge.
- Direct pushes to the default branch are disabled for humans.
- `git push` from an agent still happens only when the operator asks in the
  current message. The asked remote is `eliteew-dev`.

On `eliteew`:

- The default branch is protected.
- The only writer is the publisher identity.
- Pull requests opened by other people are not the development queue. The
  development queue is `eliteew-dev`.
- The publisher refuses a push when the export still contains a
  development-only or excluded path (section 4).

There is no third remote and no manual "sync by copying files" path.

## 4. What each repository contains

Machine-readable placement: `classify_repo_path` in
`tools/github_repository_policy.py`. Target placement after cutover:

| Placement | Paths | Development repo | Public repo |
|-----------|--------|------------------|-------------|
| `both` | Product and ops source, including shell media listed below | yes | yes |
| `development_only` | `docker/env_file/bundles/prod-core.env.tar.sops`, `docker/env_file/bundles/.sops.yaml`, `.cursor/**` | yes | no |
| `neither` | `pack-cloud/mobile/adb_exports/**`, `tg_bot_ip_verif/**` | no | no |

Shell media that stays in both repositories:

- `shared/web/frontend/public/audio/**`
- `shared/web/frontend/public/ewa/**`
- `shared/web/landing/kuku2.mp4`

Cloud edge static serving reads those trees from the command-center checkout
([CLOUD-SPA-EDGE-STATIC.md](CLOUD-SPA-EDGE-STATIC.md)). Removing them from the
development canon removes guided-tour audio and EWA video from the next bake.

Plaintext env files stay gitignored in both repositories. The encrypted
prod-core bundle stays in the development canon only. The age private key
stays on command-center disk and is not a git object.

New files of these types are gitignored in the root `.gitignore` (W1,
2026-09-28): `*.jks`, `*.keystore`, `*.p8`,
`pack-cloud/mobile/adb_exports/**`. A new video under
`shared/web/frontend/public/` is gitignored until an explicit exception names
that file. Videos already listed there, tracked audio, the SOPS bundle, and
`.cursor/**` stay in the index.

`scripts/` and `docker/scripts/*` stay allowlisted. A new script is not in
git until a `!` line names it. The community installer in section 6 must have
that line in the same change that adds the script.

## 5. Publisher

The publisher builds the public tree from a `eliteew-dev` SHA:

1. Start from that commit.
2. Drop every path classified `development_only` or `neither`.
3. Refuse to push if any dropped path is still present, or if a blob larger
   than 50 MiB remains.
4. Push the result to `EmperyWorld/eliteew` default branch.
5. Record the pair `(dev SHA, public SHA)` in the publisher log on
   command-center. Prod deploy does not read the public SHA.

The publisher does not rewrite `eliteew-dev` history. The one history
rewrite is the cutover wave in the process plan, and it happens before
`eliteew-dev` is the command-center remote.

## 6. Community install (target)

This is the on-prem community profile, not cloud prod and not a customer OEM
installer. Customer IdP choice stays parked in
[ELITEEW-ONPREM-TEAM-CORE-PACK.md](ELITEEW-ONPREM-TEAM-CORE-PACK.md). The
community command below carries its own local realm.

| Constant | Value |
|----------|--------|
| Script | `scripts/eliteew/install-community.sh` *[planned W4 — not in tree]* (**planned / not shipped** — Wave W4 in plan; do not expect on disk yet) |
| Edition | `ELITEEW_PRODUCT_EDITION=onprem` |
| Profile | `ELITEEW_INSTALL_PROFILE=onprem-team-core` |
| Services | Postgres, Redis, Keycloak, stack0 API, stack0 frontend |
| Out of this command | stack2, stack4, stack9, stack11, GPU workers, edge tunnel, `eliteew-deploy.sh` |

The script:

- Generates local secrets into a gitignored env file. It does not read or
  write the prod-core SOPS bundle.
- Imports a community Keycloak realm and creates one local administrator.
- Runs database migrations.
- Exits 0 only after API health and the frontend HTTP port both succeed.
- Exits 2 when the target host is prod-core `192.168.1.111`, when command-center
  `192.168.1.136` is the install target, or when a prod env file
  (`docker/env_file/.env.stack0.backend` or `docker/env_file/bundles/prod-core.env.tar`)
  is present in the work tree. Those files mean this checkout is an operator
  cloud checkout, and the community installer must not run there.
- Leaves cloud deploy scripts and the baked / dev-bind lines unchanged.

AI, Meet, and OCR are off. The shell for `onprem-team-core` still opens.
The script does not tell the operator to edit env files by hand.

A later product installer with a button in the UI is out of this canon until
this command is the proven path.

## 7. What stays true for cloud prod

- Build on command-center, run on prod-core.
- Stack0 release remains `bash docker/scripts/eliteew-deploy.sh release stack0 --all`.
- Config Plane plaintext stays on command-center. Prod-core runtime env stays
  tmpfs. The development repository still stores the encrypted bundle.
- No persistent plaintext env on prod-core.

## 8. Failure / Edge-Case Matrix

| Axis | Contract |
|------|----------|
| Offline | Publisher and community install need a local checkout. They do not call the public GitHub API to build. If GitHub is unreachable, command-center keeps building from the last fetched `eliteew-dev` SHA. Community install does not download shell media; media is already in the checkout. |
| Dual-flag / conflict | Development SHA and public SHA are different objects. Deploy records only the development SHA. Community install and prod deploy do not share an env file. If a prod env file is present, community install exits 2. Edition/profile mismatch inside the running API stays the existing 503 from the on-prem pack. |
| Permission / access | Humans merge only on `eliteew-dev`. The public default branch accepts the publisher identity. Prod ciphertext is absent from the public repository. The age private key is not a git object. |
| Regression | `cd /data/repos/powered_by_emperyworld && .venv/bin/python -m pytest tools/test_github_repository_policy.py -q` |

## 9. Doc ownership

| File | Role |
|------|------|
| This file | Normative contracts |
| `documentation/plans/platform/ELITEEW-GITHUB-REPOSITORY-PLAN.md` *[operator-local process plan; gitignored — not living canon]* | Waves, inventory, exit proofs |
| [ADR-004](engineering-bar/adr/ADR-004-github-development-canon.md) | Decision record |
| [LICENSE-POLICY.md](engineering-bar/LICENSE-POLICY.md) | Public source URL |
| [ELITEEW-ONPREM-TEAM-CORE-PACK.md](ELITEEW-ONPREM-TEAM-CORE-PACK.md) | Profile and smoke; not the installer |
| [CLOUD-SPA-EDGE-STATIC.md](CLOUD-SPA-EDGE-STATIC.md) | Why shell media stays in git |
| [PROD-CORE-CONFIG-PLANE.md](PROD-CORE-CONFIG-PLANE.md) | SOPS bundle on the operator checkout |
