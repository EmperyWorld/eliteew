# Mobile: Yandex perimeter access instrument

Канон для инструмента **доступа к Empery через Yandex ID access-gate** в native-приложении `pack-cloud/mobile/`.

Perimeter gate (сеть / SG) и app-сессия (Keycloak mobile SSO) — **разные слои**. Подробности gate: `platform/docker-re_doc/YANDEX-ID-ACCESS-GATE.md`.

**Do not confuse transports:**

| Layer | Transport | Client |
|-------|-----------|--------|
| **Perimeter (Yandex)** | Chrome **Custom Tabs** → `access.eliteew.ru` | Not Keycloak |
| **App SSO** | In-app **`EmperySsoWebViewActivity`** → Keycloak **`empery-mobile`** | `POST /api/v1/auth/sso/callback` |

When the phone is **trusted-device bound**, Profile hides the Yandex perimeter card (Secure Connection owns network trust) — see [`MOBILE-SECURE-CONNECTION-OPERATIONS.md`](MOBILE-SECURE-CONNECTION-OPERATIONS.md) § Profile UX.

## Два слоя

| Слой | Что открывает | Где в UI |
|------|----------------|----------|
| **Perimeter** | Временный сетевой доступ к `app.eliteew.ru` после Yandex ID на `access.eliteew.ru` | Profile → карточка «Доступ к Empery» (hidden when trusted-device bound) |
| **App session** | Keycloak tokens (`empery-mobile`), чат, API | «Вход в приложение: активен / требуется» + экран логина |

UI **не показывает** TTL SG, IP пользователя и правила Security Group — только статус «открыт / закрыт / проверяем».

## Источник правды (v1)

Без отдельного backend status API:

1. **Primary:** `GET https://app.eliteew.ru/api/health` (без Bearer, timeout ~5 s).
   - **200** → perimeter открыт (доступ до API есть). Публичный body — только `{"ok": true|false}` (без topology сервисов).
   - timeout / connect error при validated network → perimeter закрыт.
2. **Secondary (косвенно):** authenticated `/api/v1/mobile-app/overview` — при закрытой SG тоже недоступен; **401** трактуется как app-auth, не perimeter.

Реализация: `pack-cloud/mobile/core/network/src/main/java/world/empery/mobile/core/network/PerimeterAccessProbe.kt`.


## Manual Yandex auth CTA (v1.1)

When perimeter is **closed** or **semi-silent auto-renew did not open** `/api/health`:

1. **Profile card** — hint + primary button **«Войти через Яндекс»** (Custom Tabs → `access.eliteew.ru/oauth/yandex/start`).
2. **Global banner** — same CTA on all tabs while closed (authenticated shell).
3. **Login screen** — if perimeter closed before Keycloak SSO, Yandex button above app sign-in (Yandex remains Custom Tabs; app SSO stays WebView).
4. **Notification** — after failed auto-renew in background (unchanged); foreground failure relies on banner/card.

State: `PerimeterAccessUiState.autoRenewFailed` set after poll timeout or Custom Tabs launch failure; cleared when probe returns **Open**.

## Semi-silent renewal

Полностью headless Yandex OAuth на Android **не поддерживается**. Реализован **semi-silent** контур:

1. Toggle «Автопродление доступа» (default **off**, SharedPreferences).
2. При триггере (сеть восстановилась, socket/sync transport error) — probe; если closed и toggle on → Custom Tabs на `https://access.eliteew.ru/oauth/yandex/start`.
3. Если Yandex-сессия в Chrome жива — форма логина может не показываться.
4. После возврата в app — poll `/api/health` (2 s × 30).
5. Cooldown между авто-попытками: **15 min** (`PerimeterAccessRenewPolicy`).
6. В фоне без foreground — **notification** «Нажмите, чтобы продлить» (не стартуем Activity из FGS).

Custom Tabs only — **не WebView** для Yandex login.

## Модули

| Путь | Роль |
|------|------|
| `core/network/PerimeterAccessProbe.kt` | HTTP probe |
| `feature/profile/PerimeterAccessRepository.kt` | StateFlow + prefs |
| `feature/profile/PerimeterAccessCard.kt` | Profile UI |
| `app/.../perimeter/AccessGateCustomTabsLauncher.kt` | Custom Tabs, host allowlist |
| `app/.../perimeter/PerimeterAccessCoordinator.kt` | Triggers, poll, notification |
| `app/.../perimeter/PerimeterAccessNotificationHelper.kt` | Notification channel |

## Триггеры coordinator

- `MainViewModel.onNetworkRestored()`
- Socket `onConnectionError` (transport-like errors)
- `BackgroundSyncWorker` failure (IOException / non-401 HTTP)

## Smoke (оператор)

1. Закрыть SG / дождаться timeout → Profile: «Нужен вход через Яндекс».
2. «Продлить доступ» → Yandex в Custom Tabs → после redirect probe → «Доступ открыт».
3. Включить автопродление → airplane off при closed perimeter → notification или Custom Tabs (foreground).
4. Perimeter open + logout app → perimeter pill Open, app session «требуется».

## Будущее (v2, опционально)

Authenticated status endpoint на access-gate или proxy в EliteEW API — только если probe недостаточен (LAN без Yandex vs активная Yandex-сессия).

## Связанные документы

- `product/mobile/ANDROID-DEVELOPER-HANDBOOK.md` — § perimeter / §7 Auth (`empery-mobile`)
- `platform/docker-re_doc/YANDEX-ID-ACCESS-GATE.md`
- `platform/docker-re_doc/KEYCLOAK-ELITEEW.md` — `empery-mobile` (not perimeter)
- `platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md`
- `product/FRONTEND-AUTH.md` — Keycloak mobile vs web
