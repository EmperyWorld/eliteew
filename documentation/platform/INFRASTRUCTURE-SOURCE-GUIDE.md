# Infrastructure, configuration and operations from source

This guide describes checked-in manifests and scripts at the audit baseline. Actual hosts, active stacks and deployed versions are maintained in [PRODUCTION-TOPOLOGY-STATE](PRODUCTION-TOPOLOGY-STATE.md); no remote runtime was inspected here. Start with [developer setup](DEVELOPER-SETUP.md) for local work and [the architecture map](ARCHITECTURE-CODE-MAP.md) for component boundaries.

## Configuration layers

1. **Process settings:** the shared API's [UnifiedConfig](../../shared/api/core/unified_config.py) loads environment-backed Pydantic settings. Import/startup requires its mandatory settings and reachable dependencies. KBSEW has [its own settings](../../KBSEW/api/core/config.py); the two services do not share a Python configuration object.
2. **Compose interpolation:** manifests expand `${...}` from the explicitly selected `--env-file` and shell environment. This is distinct from injecting variables into a container.
3. **Container injection:** [stack0 compose](../../docker/stack/stack0_b.yml) injects role slices from `env_file:` plus explicit `environment:` entries. Explicit entries override duplicate injected keys. [Role materialization](../../docker/scripts/stack0-env-materialize-roles.sh) classifies the backend source file into `.env.stack0.shared`, `.env.stack0.api` and `.env.stack0.jobs`. It fails conflicting classification; unknown keys default to shared. `--check` validates classification without writing slices.
4. **Runtime settings:** EWA reads its operator settings catalog through the [settings package](../../shared/api/ewa_platform/settings/) and separate database connection. Those stored values and feature flags can change behavior after a build; environment names alone do not establish effective configuration.
5. **Browser build settings:** Vite's `VITE_*` values can become browser-visible bundle data. They must not carry backend secret values. See [frontend environment](../product/FRONTEND-ENV.md) and the [secret scan helper](../../scripts/eliteew/scan-frontend-dist-secrets.sh).

The [source contract inventory](../api/SOURCE-CONTRACT-INVENTORY.json) includes 1,238 distinct environment names from the selected Python scope and tracked examples. It contains names/source locations, not values, and is not a complete merged environment schema for every language or deployment. Read the corresponding settings class, template and compose consumer for defaults, required fields and precedence.

Checked-in redacted templates live in [docker/env_file](../../docker/env_file/README.md). Live files, tokens and decrypted bundles are local/operator assets. Do not paste them into docs or command output. The [Config Plane runbook](PROD-CORE-CONFIG-PLANE.md) owns SOPS bundle delivery and tmpfs placement.

## Container boundaries

[The compose inventory](../../docker/stack/README.md) lists runtime manifests; [builder directories](../../docker/builders/) contain image construction inputs. The repository's default operator runtime is Podman; historical `docker/` paths do not imply Docker Engine support in every script. Inspect each script: the EWA migration fallback currently calls literal `docker exec`.

- `stack0_b.yml` supplies the API, worker/beat services and optional profiles. A manifest present in the repository is not proof that its optional profile is running.
- `stack0_f.yml` serves the built SPA. The frontend build defaults to `dist-build`; it is independent of the Next.js landing application.
- `stack1.yml` defines shared PostgreSQL, Redis, RabbitMQ, Qdrant, S3-compatible storage and other retained infrastructure. Resource usage and active legacy services require runtime verification.
- `stack-ewa-postgres.yml` is the EWA data boundary; `stack6.yml` provides identity/Keycloak; `kbsew.yml` provides the standalone ingestion service.
- stack2/remote LLM manifests, stack4 document processing, stack11 Meet and stack12 internal DNS are deployment-specific dependencies. Their presence does not guarantee availability in a local development checkout.

Base stack0 manifests have source/runtime bind mounts. Production baked and dev-bind overrides select different packaging behavior. Do not describe the base file alone as a baked deployment. External networks, volumes, secrets, identity clients and images must exist before a compose startup; this repository does not provide a universal one-command clean-machine installation.

## Build and release path

Repository policy assigns image builds to command-center and production runtime to prod-core. [The unified deployment CLI](../../docker/scripts/eliteew-deploy.sh) exposes stack0 release, hotfix and runtime release operations; [operator CLI navigation](../../docker/scripts/README.md) links implementers. Planned stack0 releases cover API and SPA together with `--all`. The existing policy prohibits agent partial planned releases.

[Line A](PROD-CORE-DEV-BIND-LINE.md) uses baked images. Line B supplies the documented dev-bind hotfix path. They are mutually exclusive runtime selections. [Provenance](docker-re_doc/DEPLOY-CLI-PROVENANCE.md), [release checklist](ELITEEW-RELEASE-CHECKLIST.md), maintenance handling and smoke gates must be evaluated for an authorized rollout. No release command, image build, host sync or restart was executed in this documentation task.

The [public site](../../shared/web/site_prod/README.md), [Android entrance](../../pack-cloud/mobile/README.md), [Connection Agent](../../pack-organization/connection-agent/README.md), [KBSEW](../../KBSEW/README.md) and [Olenti template](../../site-templates/olenti/README.md) have separate package/build/release inputs. A successful SPA build does not validate them.

## CI and local gates

[eliteew-pr-gate.yml](../../.github/workflows/eliteew-pr-gate.yml) runs architecture integrity before hygiene, then selected frontend resilience suites and the admin-shell checklist. It provisions Python 3.14, Node 22 and pnpm 10. The current SPA requires Node >=22.22 and pnpm >=12, so the pnpm CI pin is inconsistent with its manifest. This audit records the mismatch without changing configuration.

Other workflows cover Android, editor/desktop E2E, LLM evaluation and OpenAPI pilots. They have their own triggers and opt-in flags. Read [.github/workflows](../../.github/workflows/) for actual coverage. Do not call them a single exhaustive integration gate or equate local `check:release` with the primary PR workflow.

Local entry points are [validate-local.sh](../../scripts/eliteew/validate-local.sh) and [check_all.sh](../../tools/check_all.sh). The former combines broader selected checks; the latter handles architecture/hygiene. Their `--help` paths were executed. [Manifest validation](../../scripts/eliteew/validate-app-manifests.sh) and the `onprem-team-core` [profile smoke](../../scripts/eliteew/smoke-install-profile.sh) passed locally. Complete builds, full test suites and CI execution were not performed for the documentation-only change.

## Storage changes and recovery

Read the [database hub](../database/README.md) before applying SQL. Application operator migrations use an explicit list/ledger; the alternate pending-file runner moves files; EWA applies ordered files without a ledger. They are different workflows. No migration runner here promises an atomic transaction across the full set. Review SQL-specific rollback, backup ownership and target connection before any authorized mutation.

Backup/deploy helpers are operator tools with side effects. Their existence does not prove backup freshness or successful restore. [Host assets](../../host/README.md) distinguish bind-mounted data/policies from service processes and root-level host installers.

## Errors, logs and monitoring

The [source architecture](ARCHITECTURE-CODE-MAP.md) and [HTTP reference](../api/SOURCE-HTTP-REFERENCE.md) explain application errors, auth failures and readiness limits. Main API health has public/admin visibility differences. KBSEW `/health` only proves liveness; `/ready` probes PostgreSQL, Qdrant and the S3 bucket and returns 503 on degradation. Neither establishes all provider readiness.

Stack0 manifests map logs through `ELITEEW_LOG_FILE` and bind directories. Read [the logging implementation](../../shared/api/core/logging_config.py) for emitted fields and redaction behavior rather than assuming every dependency uses identical structured logs. [Metrics code](../../KBSEW/api/monitoring/metrics.py) defines KBSEW counters/gauges/histograms. Optional instrumentation and retained monitoring manifests are not evidence of an active collector or dashboard.

Operational runbooks include historical acceptance observations. Where a document asserts live state, that assertion needs a dated runtime check by an authorized operator. This source audit validates implementation paths and explicitly preserves that distinction.
