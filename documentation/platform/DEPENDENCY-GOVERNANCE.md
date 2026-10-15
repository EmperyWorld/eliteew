# EliteEW: управление зависимостями и Dependabot

## Роли

- **Dependabot** создаёт PR при обновлении зависимостей (npm в **`shared/web/frontend`**, pip lock в **`docker/builders/stack0-api`**, GitHub Actions).
- **Ответственный за triage** назначается командой (роль фиксируется в теле Dependabot/security PR или в операторской заметке; **не** в `documentation/worklog/` — worklog retired).

## Конфигурация

Файл **`.github/dependabot.yml`** в корне монорепозитория:

- **npm**: каталог `shared/web/frontend`, еженедельно, группировка production-зависимостей по типу (`dependencies` / `devDependencies`).
- **pip**: каталог `docker/builders/stack0-api` (constraints + lock; заголовки PR ссылаются на образы stack0).
- **github-actions**: обновления экшенов в **`.github/workflows`**.

Fork-only режим GitHub: если Dependabot недоступен, оператор выполняет **ручной** аудит: `pnpm audit` (с осторожностью к breaking), просмотр security advisories, обновление lockfile в отдельном PR.

## SLA (ориентиры)

| Уровень | Действие |
| --- | --- |
| Critical / GHSA с эксплуатацией в пути | PR или патч в **`pnpm overrides`** / constraint в течение **72 ч** после подтверждения применимости к EliteEW |
| High | В течение **2 недель** или явное исключение в PR с датой review |
| Medium/Low | Включать в регулярный dependency sweep или закрывать с обновлением major при необходимости |

Исключения (**overrides**, игнор уязвимости) требуют **комментария в `package.toml` / lock / документе** и ссылки на тикет или причину.

## Связь с релизом

Перед production: блок **Security / supply chain** в **[ELITEEW-RELEASE-CHECKLIST.md](ELITEEW-RELEASE-CHECKLIST.md)**.

## См. также

- Фронт лицензии: **`platform/FRONTEND-LICENSE-CLEANUP.md`**
- Образы backend: **`platform/docker-re_doc/STACK0-BACKEND-IMAGES.md`**
