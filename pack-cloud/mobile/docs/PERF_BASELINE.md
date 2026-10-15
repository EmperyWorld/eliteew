# MobileAndroid: baseline производительности

Повторяйте сценарий **до и после** оптимизаций (одно и то же устройство, заряд батареи, без отладки по USB при замере jank, если возможно).

## Сценарий

1. Холодный старт приложения (смахнуть из recents).
2. Логин (если нужен).
3. Вкладка **Лента** — дождаться контента, медленный скролл 5 с.
4. Вкладка **Чат** — список чатов, скролл 5 с.
5. Открыть один диалог — скролл сообщений 5 с.
6. Переключить 2–3 другие вкладки и вернуться в чат.

## Команды (host)

```bash
# Кадры и jank (после сценария на нужном экране)
adb shell dumpsys gfxinfo world.empery.mobile framestats | tail -n 80

# Для dev-сборки: StrictMode уже включён в Application (penaltyLog).
# Смотреть logcat: StrictMode policy violation
adb logcat -d -s StrictMode | tail -n 50
```

## Macrobenchmark

После синхронизации Gradle: из корня `pack-cloud/mobile/` (установите на устройство **devDebug** приложения `:app`, package `world.empery.mobile.dev`):

```bash
./gradlew :benchmark:connectedDebugAndroidTest
```

(Подключённое устройство или эмулятор API 28+; первый прогон может быть дольше.)

## Baseline Profile

В `app` подключён `androidx.profileinstaller`. Сгенерированный профиль попадает в артефакты сборки; для обновления правил используйте модуль `:benchmark` и задачу генерации профиля в Android Studio / AGP, когда инструментарий настроен.
