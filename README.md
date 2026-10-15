# EliteEW

**An open-source, AI-native workspace platform by
[Empery World](https://eliteew.ru).**

[Website](https://eliteew.ru) ·
[Source](https://github.com/EmperyWorld/eliteew) ·
[License](LICENSE) ·
[Contact](mailto:public@eliteew.ru)

## Наш подарок миру

**EliteEW — наш подарок миру.**

Мы — **Поэт (po&T), Кундухов Артём Георгиевич**, и
**TZBrand, Кундухова Татьяна Александровна**. За этим десктопом — год нашей
жизни: дни и ночи работы, тысячи решений, поисков и попыток сделать лучше.

Мы создавали его с простой надеждой: сделать мир немного лучше и дать людям
больше свободы — творить, общаться, работать и воплощать свои идеи.

Сегодня мы дарим этот труд миру под [лицензией MIT](LICENSE).
Пользуйтесь, изучайте, меняйте, делитесь и создавайте на его основе своё.
Пусть наш год работы станет для кого-то началом новой возможности.

EliteEW brings a desktop-style workspace, modular applications, collaboration,
content tools, and AI orchestration into one platform. The same shared kernel
can be delivered as a hosted service, a customer-controlled on-premises
deployment, or a capability-scoped client.

> **Status: active development.** The source tree contains working product
> paths and edition foundations, but the community deployment experience is
> not yet a polished one-command installer. Trusted Substrate is not
> release-ready, and the client edition does not promise full air-gap parity.

## What EliteEW is building

- A browser desktop shell with an application registry and install profiles.
- Documents, files, communication, projects, and organization workflows.
- EWA, an AI companion and orchestration layer for product tasks and tools.
- Pluggable AI providers for hosted, customer-managed, and local scenarios.
- Mobile and organization entrances over the same shared product contracts.
- A manifest-driven application platform instead of a collection of unrelated
  product forks.

EliteEW is a user product, not an operator console. Recovery, permissions,
offline behavior, and degraded states are designed as product journeys rather
than instructions that require users to edit configuration or run shell
commands.

## Editions

### Community and self-hosted

The `onprem-team-core` profile is the community foundation. It does not require
a paid EliteEW seat or an activation service. Authentication, authorization,
and local administrator permissions still apply inside the deployment.

Packaging is currently foundation-level: manifests, profile resolution, an
environment overlay, and contract smoke tests exist, while a complete
customer-ready installer and every optional service bootstrap remain work in
progress.

### Official cloud and managed deployments

Access to an Empery-operated service may be paid even though its covered source
code is free software. Managed hosting, enterprise integration, certification,
support, and SLA work are services; they are not restrictions on the right to
run the community code.

### Client and offline-capable

Client mode is capability-scoped. Local shell state and selected local AI
workflows can operate without the hosted platform, while remote tools are
explicitly allowlisted. It is not currently presented as full offline or
air-gapped parity with every cloud feature.

## Architecture

```text
pack-cloud/mobile ───────────────┐
                                │
                                ▼
                        shared platform
                    API · web shell · apps
                                ▲
                                │
pack-organization ──────────────┘
connection agent · substrate

       install profiles select applications and capabilities
       identity, data, and AI providers remain deployment choices
```

The product follows a kernel-and-app model:

- The kernel owns identity protocols, the desktop shell, app discovery,
  configuration, storage adapters, and shared job/event contracts.
- An app owns its domain UI and API and declares required capabilities through
  a manifest.
- A separate process or container is used when isolation, scaling, or hardware
  locality justifies it—not merely because a feature exists.

## Repository map

- `shared/api/` — Python 3.14 / FastAPI API, workers, and shared services.
- `shared/web/frontend/` — React 19 / TypeScript 7 desktop and application UI.
- `shared/apps/` — application manifests, schemas, and install profiles.
- `shared/packages/` — shared private packages used by the product.
- `pack-cloud/mobile/` — Android entrance for the cloud delivery path.
- `pack-organization/connection-agent/` — Tauri organization connection agent.
- `pack-organization/trusted-substrate/` — Buildroot-based OS carrier; not
  release-ready.
- `docker/` — Podman-first runtime manifests and operational tooling. The
  directory name is historical and does not require Docker Engine.
- `documentation/` — living product, platform, API, database, and reference
  documentation.

## Start exploring

Requirements for frontend development are Node.js 22.22 or newer and pnpm 12.

```bash
git clone https://github.com/EmperyWorld/eliteew.git
cd eliteew/shared/web/frontend
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

This starts the frontend development server. API-backed features require a
configured backend and identity provider. See the [developer setup](documentation/platform/DEVELOPER-SETUP.md)
for local HMR/proxy limitations, package-specific tooling and backend prerequisites.

After preparing the repository Python environment, validate the app platform
and the activation-free community profile from the repository root:

```bash
bash scripts/eliteew/validate-app-manifests.sh
bash scripts/eliteew/smoke-install-profile.sh --profile onprem-team-core
```

The second command validates the local profile contract; it does not install a
production stack.

Useful entry points:

- [Documentation hub](documentation/README.md) and [source architecture](documentation/platform/ARCHITECTURE-CODE-MAP.md)
- [Module map](documentation/reference/SOURCE-MODULE-MAP.md) and [HTTP reference](documentation/api/SOURCE-HTTP-REFERENCE.md)
- [Documentation audit status](docs/DOCUMENTATION_PROGRESS.md)

- [On-prem community pack](documentation/platform/ELITEEW-ONPREM-TEAM-CORE-PACK.md)
- [Application manifests and profiles](shared/apps/README.md)
- [Public product overview](documentation/product/product-overview/ru/01-what-is-eliteew.md)
- [Honest limits](documentation/product/product-overview/ru/12-honest-limits.md)
- [License and third-party map](documentation/platform/THIRD-PARTY-LICENSE-MAP.md)

## Contributing and security

Contributions are welcome as the public workflow is established. Before a
large change, open an issue describing the user journey, affected edition, and
verification approach. Keep pull requests focused and preserve third-party
license notices.

For security-sensitive reports, do not open a public issue. Email
[public@eliteew.ru](mailto:public@eliteew.ru) with `security` in the subject.
No response-time SLA is promised.

## Licensing

First-party code without a narrower notice is licensed under
[MIT](LICENSE). Preserve the copyright and license notice when distributing
copies or substantial portions of the software.

Some first-party components retain earlier permissive licenses, and
third-party components remain under their upstream licenses. See
[NOTICE](NOTICE) and the
[license map](documentation/platform/THIRD-PARTY-LICENSE-MAP.md).

The software license does not grant rights to present a fork as an official
EliteEW or Empery World release. See the
[trademark policy](documentation/platform/ELITEEW-TRADEMARK-POLICY.md).

## Русский

EliteEW — свободная AI-native платформа рабочего пространства от Empery World:
рабочий стол, модульные приложения, совместная работа и ИИ-оркестрация в одном
продукте.

Авторы EliteEW: **po&T — Кундухов Артём Георгиевич** и
**TZBrand — Кундухова Татьяна Александровна**.

Community/self-hosted профиль можно запускать без платной активации. Официальное
облако, managed enterprise, внедрение и поддержка могут оставаться платными
услугами. Проект активно развивается: полноценный установщик для сообщества и
полный офлайн-паритет ещё не готовы.

Связь: [public@eliteew.ru](mailto:public@eliteew.ru).

> Публичный снимок исходников: конфигурации GitHub Actions в него не включены.
