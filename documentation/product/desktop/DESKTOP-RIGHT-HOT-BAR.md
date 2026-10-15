# Desktop Right Hot Bar — реализация для разработчиков

## Назначение

Вертикальная панель горячих кнопок справа на экране Desktop:

- **Кнопка 1 — Голосовой Штаб**: активация голосовых команд (запись и выполнение). Два индикатора: доступность сервиса (whisper + llama) и успешность последней команды.
- **Кнопка 2 — Live Voice**: голосовой диалог с AI (запись → транскрипция → ответ → TTS). Те же два индикатора (доступность WebSocket/моделей и успешность последнего запроса).

Обе кнопки **взаимоисключающие**: одновременно может быть активен только один режим (`voice-command` или `live-voice`). Контекстное меню по ПКМ: открытие полного окна/панели и дополнительные пункты.

## Ключевые файлы

| Файл | Назначение |
|------|-------------|
| `context/DesktopVoiceContext.tsx` | Состояние панели: `activeMode`, статусы для двух кнопок, `pendingVoiceCommandStart`, коллбэк открытия Голосового Штаба, флаг панели Live Voice. |
| `components/DesktopRightHotBar/DesktopRightHotBar.tsx` | Вертикальная панель справа: две кнопки с индикаторами, ПКМ-меню, взаимоисключение. |
| `components/LiveVoiceDesktopPipeline/LiveVoiceDesktopPipeline.tsx` | Пайплайн Live Voice на Desktop: `useUnifiedVoiceSession` + `useLiveVoiceWebSocket`, старт/стоп по `activeMode`, обновление контекста, drawer с `WidgetExpanded`. |
| `components/VoiceCommandCenter/VoiceCommandCenter.tsx` | Подписка на контекст: реакция на `pendingVoiceCommandStart`, выдача статусов в контекст, остановка при смене `activeMode`. |
| `DesktopWorkspaceContent.tsx` | Оборачивает контент в `DesktopVoiceProvider`, рендерит `DesktopVoiceBridge`, `DesktopRightHotBar`, `LiveVoiceDesktopPipeline`, передаёт `openVoiceCommandCenter`. |

## Поток данных

```
DesktopVoiceContext (activeMode, voiceCommand, liveVoice, pendingVoiceCommandStart, openVoiceCommandCenter, showLiveVoicePanel)
        │
        ├── DesktopRightHotBar: читает контекст, по клику меняет activeMode / requestVoiceCommandListen / setShowLiveVoicePanel
        │
        ├── VoiceCommandCenter (окно): при pendingVoiceCommandStart → startListening(), clearPendingVoiceCommandStart();
        │                              при activeMode !== 'voice-command' и isListening → stopListening();
        │                              пишет setVoiceCommandStatus({ serviceAvailable, lastSuccess })
        │
        └── LiveVoiceDesktopPipeline: при activeMode === 'live-voice' → startRecording(), при смене режима → stopRecording();
                                     пишет setLiveVoiceStatus({ serviceAvailable, lastSuccess });
                                     при showLiveVoicePanel рендерит drawer с WidgetExpanded
```

## Индикаторы на кнопках

На каждой кнопке два индикатора (по аналогии с кнопкой «Сессия» в левом меню):

1. **Точка (top-right)**: доступность сервиса  
   - Зелёный — сервис доступен, красный — недоступен.  
   - Голосовой Штаб: `voiceCommand.serviceAvailable` (whisper && llama).  
   - Live Voice: `liveVoice.serviceAvailable` (isConnected && modelsReady).

2. **Вторая строка под иконкой**: результат последнего действия  
   - «OK» (успех), «Ошибка», «—» (нет результата).  
   - Цвет: success / error / нейтральный.

## Взаимоисключение

- В контексте хранится один `activeMode: 'voice-command' | 'live-voice' | null`.
- При установке `activeMode === 'voice-command'` Live Voice останавливает запись (эффект в `LiveVoiceDesktopPipeline` по `activeMode`).
- При установке `activeMode === 'live-voice'` или при смене режима VoiceCommandCenter при `activeMode !== 'voice-command'` вызывает `stopListening()`.

## Контекстное меню (ПКМ)

- **Голосовой Штаб**: «Открыть Голосовой Штаб», «История команд», «Настройки голоса». Открытие окна — через `onOpenVoiceCommandCenter` / `openVoiceCommandCenter` из контекста.
- **Live Voice**: «Открыть Live Voice» — выставляет `showLiveVoicePanel = true`, отображается drawer с содержимым как у развёрнутого виджета (`WidgetExpanded`).

## Открытие окна Голосового Штаба

В `DesktopWorkspaceContent` задаётся коллбэк:

- `openVoiceCommandCenter`: ищет в `items` элемент с `appComponent === 'VoiceCommand'` и вызывает `openWindow(voiceItem)`.
- Коллбэк передаётся в `DesktopRightHotBar` как `onOpenVoiceCommandCenter` и в контекст через `DesktopVoiceBridge` (`setOpenVoiceCommandCenter`), чтобы и бар, и контекстное меню могли открыть окно.

## Удаление глобального LiveVoiceWidget

Виджет `LiveVoiceWidget` больше не рендерится в `App.tsx`. Функциональность Live Voice на маршруте Desktop доступна только через правую панель (кнопка + при необходимости панель «Открыть Live Voice»).

## Как добавить пункт в контекстное меню

В `DesktopRightHotBar.tsx` в блоке `contextMenu.type === 'voice-command'` или `contextMenu.type === 'live-voice'` добавить новый `<button>` с `onClick` и вызовом `setContextMenu(null)` после действия.

## Как добавить новую кнопку на правую панель

1. При необходимости расширить `DesktopVoiceContext` (новый режим или статус).
2. В `DesktopRightHotBar` добавить ещё один `HotBarButton` и обработчики клика/ПКМ, с учётом взаимоисключения с существующими режимами (если нужно).
