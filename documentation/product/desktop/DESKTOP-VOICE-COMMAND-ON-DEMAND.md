# Голосовой штаб на рабочем столе: монтирование по требованию

## Зачем

`VoiceCommandCenter` (Studio GU, голосовой штаб) тянет тяжёлые эффекты даже в режиме `backgroundOnly`: интервалы health, `useLiveVoiceWebSocket`, обработка аудио и т.д. Ранее фоновый экземпляр поднимался после `requestIdleCallback` или первого взаимодействия — это давало **высокую постоянную нагрузку на CPU** в «простое» на странице рабочего стола.

## Текущая схема (2026-04)

- **`VoiceCommandOnDemandMount`** — `shared/web/frontend/src/pages/Desktop/components/VoiceCommandOnDemandMount.tsx`.
- Пока движок **не** нужен, в дереве только **`VoiceCommandDesktopHotkeys`**: один глобальный `keydown` на хоткей (`VOICE_HOTKEY` из `StudioGU/voiceCommand/types.ts`), та же эвристика «не в поле ввода», игнор `repeat`.
- **Полный** `VoiceCommandCenter` с `backgroundOnly` монтируется **только** когда:
  - пользователь нажал хоткей (через `flushSync` + `requestVoiceCommandListen()` для согласования с `pendingVoiceCommandStart` в контексте), или
  - сработал **`pendingVoiceCommandStart`** из `DesktopVoiceContext` (плавающий виджет / мост вызывает `requestVoiceCommandListen()` — монтирование через **`useLayoutEffect` + `flushSync`**, чтобы не терять кадр до появления движка).
- Если на столе открыто окно **StudioGU** (`hasOpenStudioGUWindow`), фоновый слой **не** монтируется — иначе два экземпляра конкурируют за микрофон (как и раньше).

## Связанные файлы

| Файл | Роль |
|------|------|
| `DesktopWorkspaceContent.tsx` | Рендер `<VoiceCommandOnDemandMount hasOpenStudioGUWindow={...} />` рядом с `LiveVoiceDesktopPipeline`. |
| `DesktopVoiceContext.tsx` | `pendingVoiceCommandStart`, `requestVoiceCommandListen`, `clearPendingVoiceCommandStart`. |
| `DesktopWidgetVoiceStrip.tsx` | Включает режим `voice-command` и в `queueMicrotask` вызывает `requestVoiceCommandListen()`. |
| `VoiceCommandCenter.tsx` | По `pendingVoiceCommandStart` запускает `startListening` и сбрасывает pending. |

## Антипаттерн

Не возвращать «фоновый» монтирование тяжёлого `VoiceCommandCenter` по таймеру idle / «первому клику» без явного ТЗ на профилирование и UX. Для хоткеев без движка — отдельный минимальный слой слушателей; полный пайплайн — по событию пользователя или `pendingVoiceCommandStart`.

Правило для агентов: **`.cursor/rules/desktop-performance-background-mounts.mdc`**.
