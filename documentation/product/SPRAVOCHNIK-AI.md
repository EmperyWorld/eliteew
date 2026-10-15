# Ассистент (ИИ-помощник): документация продукта

В интерфейсе EliteEW приложение и раздел админки называются **«Ассистент»**. Это **не** каталог `documentation/` репозитория — это встроенный FAQ и чат с ответами на вопросы **о продукте** (модель на сервере, опционально RAG по загруженным текстам).

## Зачем этот файл

Один вход для ролей: куда смотреть **пользователю**, **администратору**, **автору статей для RAG** и **разработчику**, не путая:

- **Ассистент в приложении** — чат + частые вопросы;
- **`documentation/`** — канон текстов для команды и операторов монорепозитория.

## По ролям

| Роль | Документ |
|------|----------|
| **Пользователь рабочего стола** | [`handbook-user-docs/README.md`](handbook-user-docs/README.md) — простые инструкции; про окно чата и FAQ: [`handbook-user-docs/01-spravochnik-prilozhenie.md`](handbook-user-docs/01-spravochnik-prilozhenie.md) |
| **Пользователь MobileAndroid (0.2.154+)** | EW → **Ассистент** — in-app WebView `#/mobile-handbook` (тот же `AssistantApp`, compact layout). Пользовательская инструкция: [`handbook-user-docs/01-spravochnik-prilozhenie.md`](handbook-user-docs/01-spravochnik-prilozhenie.md) §«Приложение EliteEW на телефоне»; канон: [MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md](mobile/MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md), layout/UI: [MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md](mobile/MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md) §4.3 |
| **Администратор (FAQ, KB, модель, RAG)** | [`PRODUCT-ASSISTANT-HANDBOOK.md`](PRODUCT-ASSISTANT-HANDBOOK.md) — API, лимиты, загрузка документов, коллекция Qdrant `product_assistant_kb`; **индексация KB:** [`PRODUCT-ASSISTANT-KB-INDEXING.md`](PRODUCT-ASSISTANT-KB-INDEXING.md) |
| **Автор текстов для ответов ассистента (RAG)** | [`handbook-kb-articles/README.md`](handbook-kb-articles/README.md) — готовые `kb-*.md` для загрузки в админку и **переиндексации**; порядок sync/reindex — [`PRODUCT-ASSISTANT-KB-INDEXING.md`](PRODUCT-ASSISTANT-KB-INDEXING.md); редактор документов: [`handbook-kb-articles/kb-doc-editor.md`](handbook-kb-articles/kb-doc-editor.md), структура и совместная работа: [`handbook-kb-articles/kb-doc-editor-struktura-format-i-sovmestnaya-rabota.md`](handbook-kb-articles/kb-doc-editor-struktura-format-i-sovmestnaya-rabota.md) |
| **Разработчик / ревью кода** | Роутер `shared/api/routers/product_desktop.py`, хелперы промпта `shared/api/services/product_assistant_prompt_helpers.py`, сервис RAG `shared/api/services/product_assistant_rag_service.py`; **SPA:** `AssistantApp.tsx` + `pages/Desktop/components/assistant/` (модульная карта — [`desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md`](desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md) §Ассистент); **редактор документов (архитектура, форматы):** [`ULTIMATE-DOC-EDITOR.md`](ULTIMATE-DOC-EDITOR.md); карта репозитория: [`../README.md`](../README.md), глоссарий: [`../reference/PROJECT-GLOSSARY.md`](../reference/PROJECT-GLOSSARY.md) |

## Отличия от других «ИИ» в продукте

| Продукт | Назначение |
|---------|------------|
| **Ассистент** | Только EliteEW: интерфейс, приложения на столе, типовые сценарии. Вне темы — вежливый отказ; при отсутствии материала — предложение написать в **«Обращения»**. |
| **AI Чат** | Общий диалог в рамках политики организации; не смешивать со Ассистентом (см. [`handbook-kb-articles/kb-ai-chat-studii-i-muzyka.md`](handbook-kb-articles/kb-ai-chat-studii-i-muzyka.md)). |
| **RAG в маркетинге / в чате** | Отдельные коллекции Qdrant; в контур Ассистента не подмешиваются (таблица в [`PRODUCT-ASSISTANT-HANDBOOK.md`](PRODUCT-ASSISTANT-HANDBOOK.md)). |

## Операционный порядок после правок текстов

1. Обновить соответствующий файл в `handbook-kb-articles/` (или FAQ через админку).
2. Синхронизировать или переиндексировать KB — см. [`PRODUCT-ASSISTANT-KB-INDEXING.md`](PRODUCT-ASSISTANT-KB-INDEXING.md) (CLI, админка, dry-run, проверка summary).
3. Проверить ответ ассистента на паре формулировок пользователя.

Карта «куда смотреть первым» по всему `documentation/`: [`../reference/HANDBOOK-MAP.md`](../reference/HANDBOOK-MAP.md).
