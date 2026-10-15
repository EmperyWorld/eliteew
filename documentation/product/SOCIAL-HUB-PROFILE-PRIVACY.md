# Social hub: друзья + профиль и приватность на сервере

## Назначение

На рабочем столе одно приложение **Связи** (`app-social-hub` / `SocialHubApp`) объединяет секции **Главная**, **Люди**, **Приватность** и **Телефон** (см. [SOCIAL-HUB.md](SOCIAL-HUB.md)). Настройки видимости и обнаруживаемости в поиске хранятся в БД (`user_profile_privacy`) и применяются только на сервере (API за `app.eliteew.ru`, edge → Meet WG → prod-core). Операторская очередь жалоб: Unified Admin `?section=socialReports`. Не путать с Site Studio витринами (`{slug}-site.eliteew.ru`).

## Где в коде

| Область | Путь |
|--------|------|
| UI shell | `shared/web/frontend/src/features/friends/components/SocialHubApp.tsx` |
| Обзор | `SocialHubOverviewPanel` — attention items, recent contacts, privacy/mobile/feed summary |
| Вкладка друзей (вложенно) | `FriendsApp` с `hubMode` |
| Профиль / Privacy UI | **Profile Home** (`social-hub/profile-home/`): IdentityHero + PrivacyBoard + AccountPulse. Sheets: visibility / identity / activity. Host: `SocialHubPrivacySection`. Editor: `ProfilePrivacySection` `layout="premium"`. Legacy `UserProfile` panes remain for non-hub embeds. |
| Identity editor | `ProfileIdentityPanel` (name/bio) + `ProfileAvatarPanel` (avatar upload/history) |
| Preview query key | `features/friends/social-hub/privacyPreviewQueryKey.ts` — invalidate после `PATCH /profile/me/privacy` |
| Мобильный статус | `MobileAppHubPanel` |
| Legacy hash `#/user-profile` | `desktopOnlyNavigation.ts` + `SOCIAL_HUB_INITIAL_TAB_KEY` в `socialHubConstants.ts` |
| Приватность API | `GET/PATCH /api/v1/profile/me/privacy` — `shared/api/routers/user_profile.py` |
| Оценка прав | `shared/api/services/profile_privacy.py` |
| Поиск пользователей | `GafChatService.search_users`, `FriendsService.search_users` — фильтр discoverability |
| Карточка друга | `FriendsService.get_friend_profile` — redaction полей по visibility / кругам |

## Миграции

- `shared/api/migrations/applied/20260329_02_user_profile_privacy.sql` — таблица `user_profile_privacy`.
- `shared/api/migrations/applied/20260329_03_desktop_social_hub_merge.sql` — каталог десктопа, перенос ярлыков и `user_installed_apps`.
- `shared/api/migrations/applied/20260529_01_friend_circles_visual_metadata.sql` — визуальная мета кругов.
- `shared/api/migrations/applied/20260529_02_social_user_reports.sql` — moderation reports.

Поток SQL: `shared/api/migrations/README.md`.

## Поведение

- **discoverability `hidden`**: пользователь не попадает в поиск GAF и Friends для **не-друзей**; друзья по графу не теряются.
- **Заявка в друзья по точному username** по-прежнему возможна (`send_request` по username), даже если профиль скрыт из поиска — см. комментарий в `friends_service.py`.
- **Поля** (аватар, ФИО, bio): режимы `everyone` / `friends_only` / `none` / `circle` + при необходимости `*_circle_id` (круг владельца профиля).
- При выборе visibility `circle` UI показывает preview размера круга, чтобы пользователь видел, сколько контактов увидят поле.
- Круги можно переименовывать через `PATCH /api/v1/friends/circles/{id}`; visual metadata (`sort_order`, `color`, `icon`) уже в контракте.
- Связи feed (`/api/v1/social-hub/feed`) возвращает только privacy-safe summaries, без private notes и bodies переписки.

## Стиль UI

Канон: `product/desktop_brand_style.md`, правила `desktop-shell-and-windows.mdc`, `desktop-ui-brand-style.mdc`, `premium-user-interface.mdc`.

Privacy в Связи — **interactive Profile Home**, не operator cabinet и не пустой overview:

1. **Home:** IdentityHero (avatar/name/bio/badges) + PrivacyBoard (`preview.fields` + audiences, всегда видны) + AccountPulse (stats + 3 activity rows) + password disclosure.
2. **Sheets** replace Home: visibility / identity / activity (Back → Home). Нет peer-раздела «Ещё».
3. Один filled primary CTA: «Настроить видимость»; карточки полей/аудиторий тоже открывают visibility sheet.
4. User copy in `contentManager` (`profileHome*` / `socialHubPrivacy*` / `socialHubProfilePrivacy*`).
5. Avatar uses `SecureAvatar` (Bearer blob). Raw `<img src="/api/v1/content/{id}/download">` → **401**.
6. Chunk activity: `ProfileActivityPanel.tsx` (not `ActivityLog.tsx` — edge 404).
