# MobileAndroid: GAF видеозвонки через in-app WebView

**Тип:** Reference + How-to (миграция и эксплуатация)  
**Дата:** 2026-05-27  
**Версия клиента:** **0.2.6** (`versionCode` **16**) и новее  
**Scope:** `pack-cloud/mobile/` (нативный клиент). **Не** путать с архивным Quest SPA-shell (soft-retired EliteEWWebViewAndroid under `trash/`; нет в корне репо и не в Gradle graph `pack-cloud/mobile`).

## Кратко

С **v0.2.4+** нативное приложение **не использует** `jitsi-meet-sdk` (React Native / WebRTC ~114 MB). GAF видеозвонок открывается так же, как на desktop **`VideoCallApp`**: API возвращает **`join_url`**, клиент загружает его во **внутренний WebView** на `meet.eliteew.ru`.

| | До (≤ 0.2.3) | После (≥ 0.2.4) |
|---|-------------|-----------------|
| Клиент | Jitsi Meet SDK (`EmperyJitsiMeetActivity`) | `EmperyMeetWebViewActivity` + `join_url` |
| Размер prod APK | ~114 MB | ~18 MB |
| Медиа-стек в APK | RN + WebRTC + colibri workarounds | Системный WebView + Meet в браузерном движке |
| Контракт запуска | `meet_base_url`, `room_name`, `jwt` | **`join_url`** (JWT уже в query/hash URL) |

Канон desktop/media: [`../INTERNAL-VIDEO-CALLS.md`](../INTERNAL-VIDEO-CALLS.md).  
Assistant Android: [`ANDROID-DEVELOPER-HANDBOOK.md`](ANDROID-DEVELOPER-HANDBOOK.md).  
OTA / edge publish: [`MOBILE-ANDROID-RELEASE-RUNBOOK.md`](MOBILE-ANDROID-RELEASE-RUNBOOK.md), [`../../platform/docker-re_doc/MOBILE-RELEASE-SERVER.md`](../../platform/docker-re_doc/MOBILE-RELEASE-SERVER.md).

---

## Архитектура (desktop ↔ mobile)

```text
Мессенджер (mobile / desktop)
        │
        ▼
POST /api/v1/video-calls/gaf-chats/{chat_id}
POST /api/v1/video-calls/{call_id}/join
        │
        ▼
VideoCallJoinResponse { join_url, call_id, room_name, jwt, meet_base_url, … }
        │
        ├─ Desktop: VideoCallApp.tsx → <iframe src={join_url} />
        │
        └─ MobileAndroid: GafMeetWebViewLauncher → EmperyMeetWebViewActivity.loadUrl(join_url)
```

**`join_url`** формируется на API (`shared/api/video_calls/service.py`):

```text
https://meet.eliteew.ru/{room}?jwt={token}#{embed_hash}
```

Клиент **не собирает** URL из отдельных полей — только валидирует и открывает готовый `join_url`.

---

## Модули Android

| Файл | Назначение |
|------|------------|
| `feature/chat/GafMeetWebViewLauncher.kt` | Валидация HTTPS `*.eliteew.ru`, `launch` / `bringToForeground`, broadcast `FINISH` / `USER_LEFT` |
| `feature/chat/EmperyMeetWebViewActivity.kt` | Полноэкранный WebView, immersive UI, `WebChromeClient.onPermissionRequest` (camera/mic) |
| `feature/chat/GafVideoCallReturnBar.kt` | Плашка «Вернуться» / «Завершить» поверх основного UI |
| `app/.../MainActivity.kt` | Запрос runtime permissions → launch WebView; receiver `USER_LEFT` → `endActiveGafVideoCall()` |
| `app/.../MainViewModel.kt` | Overlay state, `endActiveGafVideoCall()` → API `/end` + `GafMeetWebViewLauncher.requestFinish()` |

### Валидация URL

`GafMeetWebViewLauncher.isValidJoinUrl()`:

- схема **`https`**;
- host `eliteew.ru` или `*.eliteew.ru`;
- парсинг через `java.net.URI` (unit-тесты на JVM/Robolectric).

### Разрешения WebView

По образцу архивного Quest WebView shell (soft-retired EliteEWWebViewAndroid under `trash/`): для trusted origin `WebChromeClient` запрашивает Android runtime `CAMERA` / `RECORD_AUDIO`, затем `PermissionRequest.grant()`.

### Завершение звонка

| Действие | Поведение |
|----------|-----------|
| «Завершить» в `GafVideoCallReturnBar` | `MainViewModel.endActiveGafVideoCall()` → `POST …/end`, overlay сброшен, broadcast `FINISH_GAF_MEET` |
| Back / закрытие WebView (active Meet) | broadcast `GAF_MEET_USER_LEFT` → `MainActivity` → `endActiveGafVideoCall()` |
| Incoming overlay / WakeActivity Back | **Не** вызывает `/end`; только explicit Decline (или notification Decline action) |
| Socket `video_call.ended` | overlay сбрасывается (как раньше) |

---

## Удалённый Jitsi-контур (≤ 0.2.3)

Удалены из `pack-cloud/mobile/`:

- `EmperyJitsiMeetActivity`, `EmperyJitsiMeetLauncher`, `EmperyJitsiSession`, `EmperyJitsiConferenceConfig`, `EmperyJitsiActiveConference`
- colibri interceptors (`EmperyJitsiColibri*`)
- Gradle: `org.jitsi.react:jitsi-meet-sdk`, Maven repo Jitsi
- `MobileApp`: ICE IPv4 workarounds, React Native OkHttp/WebSocket DNS для Jitsi
- ProGuard keep-rules для RN/Jitsi (оставлены `org.json` / socket.io)

**Media stack (Prosody/JVB)** по-прежнему на **stack11** — менялся только **клиент** Android.

---

## Сборка и тесты

```bash
cd pack-cloud/mobile
./gradlew :feature:chat:testDebugUnitTest :app:assembleProdRelease -Pmobile.android.ci=true
```

- Unit: `GafMeetWebViewLauncherTest` (HTTPS + trusted host).
- Ожидаемый размер prod APK: **~17–20 MB**.

---

## Smoke на устройстве

1. Установить **≥ 0.2.4** (рекомендуется **0.2.6**).
2. Мессенджер → исходящий или входящий видеозвонок.
3. Должен открыться **полноэкранный WebView** (не отдельное Jitsi-приложение).
4. Разрешить камеру/микрофон → медиа в комнате.
5. «Завершить» или Back → звонок закрыт, overlay исчез.

```bash
adb logcat -s EmperyMeetWebView MainActivity
```

---

## OTA и публикация на edge (2026-05-28)

### Релизы

| versionName | versionCode | Содержание |
|-------------|-------------|------------|
| 0.2.4 | 14 | WebView-звонки, удаление Jitsi SDK |
| 0.2.5 | 15 | Fix OTA: pill «Сервер» обновляется при каждом открытии Профиля; API `Cache-Control: no-store` на overview |
| 0.2.6 | 16 | OTA download: 1 MiB Range chunks + retry/resume for unstable edge/tunnel links + SHA-256 verification |

### Оператор: publish на edge

```bash
cd pack-cloud/mobile && ./gradlew :app:assembleProdRelease -Pmobile.android.ci=true
bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke
# полный цикл (+ TG + frontend): --yes --all
```

Артефакты:

- `local/binaries/empery-mobile.apk`
- `empery-mobile.apk.meta.json`, `empery-mobile.manifest.json`
- mount в API: `/app/mobile-release/` (bind `local/binaries`)
- OTA nginx: `stack-mobile-release` → `http://127.0.0.1:29180/v1/manifest.json`

После изменения **`shared/api/routers/mobile_app.py`** (overview headers) — `podman restart stack0-eliteew-api-prod`.

### In-app updates (Профиль → Обновления)

1. **`GET /api/v1/mobile-app/overview`** (Bearer) — `version_code`, `version_name`, `apk_size_bytes`, `apk_sha256`.
2. Сравнение с `PackageManager.versionCode`.
3. **`GET /api/v1/mobile-app/download`** — streaming APK (~18 MB на 0.2.6).

**Важно для операторов и пользователей:**

- Pill **«Сервер»** на **≤ 0.2.4** мог показывать **устаревшую** версию до 6 ч без повторного запроса к API.
- **≥ 0.2.5:** при открытии вкладки Профиль overview запрашивается **всегда**.
- **≥ 0.2.6:** загрузка APK идёт короткими Range-чанками по 1 MiB с retry/resume.
- На **любой** версии: кнопка **«Проверить»** всегда делает свежий запрос.
- Размер **~17 MB** — новая сборка; **~114 MB** — старый Jitsi APK или битый partial download (удалить `.part`, проверить снова).

Страница загрузки (браузер): https://app.eliteew.ru/mobile-app/ — версия видна **после** входа Keycloak.

---

## Troubleshooting

| Симптом | Причина | Действие |
|---------|---------|----------|
| Сервер 0.2.3, на edge уже 0.2.6 | Stale UI (≤ 0.2.4) или не нажали «Проверить» | Профиль → **Проверить**; установить **0.2.6** |
| Звонок не открывается | Старая сборка с Jitsi или пустой `join_url` | OTA до ≥ 0.2.4; лог `EmperyMeetWebView` |
| Скачивание ~114 MB | Partial старого APK | Отменить загрузку, удалить partial, «Проверить» снова |
| Второй звонок без медиа / ICE | WebView `singleTask` переиспользовал stale colibri pwd; edge meet WS | **≥ 0.2.130** сбрасывает Meet-сессию; ops: `apply-stack11-jitsi-web-nginx-ws.sh` на prod-core после recreate web |
| overview 401 | Нет сессии | Перелогин в приложении |
| manifest / overview расходятся | publish не выполнен | `serve-mobile-apk-tunnel.sh publish` + smoke |

Проверка на хосте:

```bash
curl -s http://127.0.0.1:29180/v1/manifest.json | python3 -m json.tool
cat local/binaries/empery-mobile.apk.meta.json
bash docker/scripts/serve-mobile-apk-tunnel.sh status
```

---

## Связанные документы

| Документ | Тема |
|----------|------|
| [`../INTERNAL-VIDEO-CALLS.md`](../INTERNAL-VIDEO-CALLS.md) | API, stack11, desktop iframe |
| [`../GAF-CHAT-DESKTOP-REFERENCE.md`](../GAF-CHAT-DESKTOP-REFERENCE.md) | Мессенджер + VideoCallApp |
| [`../../api/ANDROID-API-CONTRACTS.md`](../../api/ANDROID-API-CONTRACTS.md) | mobile-app overview/download |
| [`pack-cloud/mobile/README.md`](../../../pack-cloud/mobile/README.md) | локальный README проекта |
| [`MOBILE-ANDROID-RELEASE-RUNBOOK.md`](MOBILE-ANDROID-RELEASE-RUNBOOK.md) | OTA publish / prod-core |
