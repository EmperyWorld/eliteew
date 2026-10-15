# Связи (Social Hub) privacy (pointer)

**Канон поведения приватности:** [SOCIAL-HUB-PROFILE-PRIVACY.md](SOCIAL-HUB-PROFILE-PRIVACY.md)
**Поверхности продукта и API Связи:** [SOCIAL-HUB.md](SOCIAL-HUB.md)

Privacy settings live on `app.eliteew.ru` Desktop/API only — not on site product hosts (`{slug}-site.eliteew.ru`). Meet/video perimeter: [INTERNAL-VIDEO-CALLS.md](INTERNAL-VIDEO-CALLS.md).

Этот файл — короткий указатель. Не дублирует IA вкладок и пути миграций.

## Что смотреть

| Тема | Документ |
|------|----------|
| Discoverability, field visibility, circles, server redaction | [SOCIAL-HUB-PROFILE-PRIVACY.md](SOCIAL-HUB-PROFILE-PRIVACY.md) |
| Desktop IA (Главная / Люди / Приватность / Телефон), feed/inbox, admin reports | [SOCIAL-HUB.md](SOCIAL-HUB.md) |
| Миграции privacy/circles/reports | `shared/api/migrations/applied/` (`20260329_02_user_profile_privacy.sql`, `20260529_*`) |

## Устарело здесь (не использовать)

- Модель «две вкладки Друзья + Мой профиль» — заменена shell-секциями в SOCIAL-HUB.md.
- Утверждения про SQL в `pending/` — файлы в `applied/`.
