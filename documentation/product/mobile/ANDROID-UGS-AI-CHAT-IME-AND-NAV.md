# Mobile chat inputs: клавиатура (IME), вложенный Scaffold и нижняя навигация

Документ фиксирует поведение UI при открытой экранной клавиатуре в разделах **UGS → AI-чат** и **Чат → GAF-переписка** (`pack-cloud/mobile/`), причину «воздушного зазора» между полем ввода и клавиатурой и принятое архитектурное решение. Ниже же зафиксирована **среда**, в которой решение проверялось (снято через `adb`).

## Среда проверки (снимок с устройства оператора)

Команды выполнялись на **рабочей станции** с подключённым по USB телефоном. Вывод актуален для сессии отладки (дата в worklog: **2026-05-17**).

| Параметр | Значение |
|----------|----------|
| Приложение (процесс / фокус) | `world.empery.mobile.dev` / `world.empery.mobile.MainActivity` |
| Версия Android (release) | **12** (`ro.build.version.release`) |
| API level (SDK) | **31** (`ro.build.version.sdk`) |
| Производитель | **HUAWEI** |
| Модель | **GOA-LX9** |
| Код устройства | **HWGOA-Q** |
| Сборка / display id | **GOA-L89 14.2.0.186(C10E2R2P2)** (`ro.build.display.id`) |
| Патч безопасности (заявленный) | **2022-08-01** (`ro.build.version.security_patch`) |
| Локаль | **ru-RU** |
| Плотность экрана | Physical **520** dpi; override **600** dpi (`wm density`) |
| Размер логического дисплея | **1200×2652**; `app` bounds по dumpsys (пример): **1200×2516** |
| Навигация / клавиатура (config) | `-nav/h` gesture; `-keyb/v/h` (`dumpsys window displays` → `overrideConfig`) |

**ADB на ПК:**

- **Android Debug Bridge version 1.0.41**
- **Version 37.0.0-14910828**
- **Host OS:** Linux (Fedora 44, kernel **7.0.8-200.fc44.x86_64**)

Повторить снимок свойств на своём ПК:

```bash
adb devices
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.manufacturer
adb shell getprop ro.product.model
adb shell getprop ro.build.display.id
adb shell getprop ro.build.version.security_patch
adb shell wm density
adb version
```

> **Примечание:** в общем `adb logcat` без фильтра по тегу приложения **нет осмысленных строк** про разметку IME; диагностика этого бага опиралась на визуальную проверку и на модель компоновки (см. ниже), а не на системный лог.

## Симптом

На экранах **переписки с AI** и **GAF-переписки** при открытой клавиатуре между **нижней границей поля ввода** (composer) и **верхним краем клавиатуры** оставалась заметная пустая полоса. Одновременно **нижняя панель вкладок** приложения оставалась видимой над клавиатурой.

## Почему так неизбежно при «двойном» Scaffold

В `MainActivity` используется **корневой** `Scaffold` Jetpack Compose с **`bottomBar` = нижняя навигация** (вкладки). Контент выше — это `NavHost`, в том числе маршруты `ugs/chat`, `ugs/chat/{chatId}` и root-tab `chat`.

Экран чата (`UgsAiChatDetailScreen`) строит **второй** (вложенный) `Scaffold` со своим **`bottomBar` = панель ввода сообщения**.

При **`android:windowSoftInputMode="adjustResize"`** окно уменьшается по высоте так, чтобы оставить место под IME. Вертикальный порядок визуальных блоков (упрощённо, снизу вверх от клавиатуры):

1. Клавиатура (IME)
2. **Панель вкладок** корневого `Scaffold`
3. **Панель ввода** вложенного `Scaffold`
4. Лента сообщений

Тогда «зазор», который пользователь воспринимает как отступ от клавиатуры до поля ввода, по смыслу совпадает с **высотой полосы вкладок** (и возможными системными отступами в этой зоне). Дополнительный **`windowInsetsPadding(WindowInsets.navigationBars)`** на composer **усиливает** ошибку в этой геометрии, потому что **системная** зона навигации уже «далеко внизу окна», а composer находится **выше** вкладок приложения.

## Принятое решение (без «магических» отрицательных отступов)

1. **`MainActivity`**, манифест: для `MainActivity` задано **`adjustResize`**, чтобы не комбинировать режим панорамирования окна с ручными IME-инсетами в Compose (это давало отдельный класс артефактов).

2. **Composer** (`UgsAiChatDetailScreen`, `ChatMessages`): нижний док ввода получает **`Modifier.windowInsetsPadding(WindowInsets.ime)`** — только **IME**, без **union** с **`navigationBars`** для описанной выше геометрии.

3. **Условное скрытие корневой нижней навигации при открытой клавиатуре на маршрутах AI-чата, GAF-переписки, «Песни», «Изображения» и «Презентации»:**  
   если текущий маршрут начинается с префикса **`ugs/chat`** **или** равен **`ugs/songs`**, **`ugs/images`**, **`ugs/presentations`** **или** равен **`chat`** при активном `selectedChatId`, и **`WindowInsets.ime.getBottom(density) > 0`**, блок **`bottomBar`** у корневого `Scaffold` в **`MainActivity`** **не отображается**.  
   Тогда область `NavHost` временно расширяется до низа «видимого» окна над клавиатурой, поле ввода (чат, тема песни, промпт изображения, тема презентации) оказывается **ближе к IME**, а после закрытия клавиатуры вкладки **возвращаются**.

Это **штатный компромисс** для сценария «экран с полем ввода + глобальные табы»: либо табы остаются и гарантированно оставляют визуальный разрыв между вводом и клавиатурой, либо на время набора текста табы убираются и ввод прижимается к IME.

## Связанные файлы в репозитории

- `pack-cloud/mobile/app/src/main/AndroidManifest.xml` — `android:windowSoftInputMode` у `MainActivity`.
- `pack-cloud/mobile/app/src/main/java/world/empery/mobile/MainActivity.kt` — условие скрытия `bottomBar` для `ugs/chat*`, `ugs/songs`, `ugs/images`, `ugs/presentations` и активной GAF-переписки при ненулевом IME inset.
- `pack-cloud/mobile/feature/ugs/src/main/java/feature/ugs/UgsAiChatDetailScreen.kt` — `bottomBar` composer и `WindowInsets.ime`.
- `pack-cloud/mobile/feature/chat/src/main/java/feature/chat/ChatFeature.kt` — GAF composer и `WindowInsets.ime`; черновик сообщения держится в **локальном Compose state** при наборе (как UGS AI detail), персист в prefs — debounced из `MainViewModel.setChatDraft` (не синхронный reload на каждый символ).

## Smoke-проверка на устройстве

1. Авторизоваться, открыть **UGS → AI-чат** или **Чат**, затем диалог.
2. Тап по полю сообщения — клавиатура открыта.
3. Ожидание: **нижних вкладок нет**, поле ввода **визуально примыкает** к верхней границе клавиатуры (без большой пустой полосы между ними).
4. Закрыть клавиатуру — **вкладки снова на месте**.

## Ограничения и возможные расширения

- Пока клавиатура открыта на этих маршрутах, **переключение вкладок недоступно**, пока IME не закрыт — это следствие выбранной модели.
- Если на конкретном OEM-прошивке **`WindowInsets.ime.getBottom`** не провоцирует рекомпозицию, условие скрытия табов может потребовать дополнительной подписки на insets (отдельная задача при регрессии).
