# Тексты для базы знаний Ассистента (RAG)

**Catalog inventory:** **105** `kb-*.md` files after the 2026-10-11 audit removed one empty article to repository trash. This count does not certify the content or indexing of the remaining articles.

Здесь лежат **готовые статьи** простым языком: их можно **скопировать в админку** (раздел «Ассистент» → документы KB) или **загрузить как файлы** (`.md`/`.txt`), затем проиндексировать. Один файл ≈ один документ в KB — так проще обновлять отдельные темы.

**Не путать** с [`../handbook-user-docs/`](../handbook-user-docs) — там короткие инструкции для людей; здесь — **тот же смысл, но развёрнуто и с синонимами вопросов**, чтобы RAG лучше находил ответы на формулировки пользователей.

Для **разработчиков** (структура кода, композер, очередь вложений, не пользовательский текст): [`../GAF-CHAT-DESKTOP-REFERENCE.md`](../GAF-CHAT-DESKTOP-REFERENCE.md). Технический справочник **EWRP** (API, биллинг, UI): [`../EWRP-REVOLUTIONARY-PRESENTATIONS.md`](../EWRP-REVOLUTIONARY-PRESENTATIONS.md). Магазин приложений на рабочем столе (витрина, данные, производительность, оформление UI): [`../desktop/DESKTOP-APP-STORE.md`](../desktop/DESKTOP-APP-STORE.md).

Продукт **«Ассистент»** (ассистент, админка KB, RAG): как держать статьи в согласии с интерфейсом, в том числе магазин — [`../PRODUCT-ASSISTANT-HANDBOOK.md`](../PRODUCT-ASSISTANT-HANDBOOK.md) (блоки про синхронизацию EWRP и магазин).

После изменений в интерфейсе (новые кнопки, переименования) обновите соответствующий файл и **переиндексируйте** документ в админке.

**Runbook индексации (sync, dry-run, Qdrant, stack0 mount, проверка RAG):** [`../PRODUCT-ASSISTANT-KB-INDEXING.md`](../PRODUCT-ASSISTANT-KB-INDEXING.md).

**Массовая синхронизация из git:** `shared/api/scripts/sync_handbook_kb_articles.py` (см. runbook). В админке: **«Проверить sync (dry-run)»** → **«Синхронизировать kb-*.md из репозитория»**. На **command-center** API видит статьи через bind `documentation/`; на **prod-core** — из baked API-образа (после `bash docker/scripts/eliteew-deploy.sh release stack0 --all`).

| Файл | Темы для поиска |
|------|-----------------|
| [`kb-spravochnik-i-obrashcheniya.md`](kb-spravochnik-i-obrashcheniya.md) | Ассистент, чат помощника, Обращения, лимиты |
| [`kb-rabochiy-stol-i-pusk.md`](kb-rabochiy-stol-i-pusk.md) | Рабочий стол, Пуск, трей (GAF/UGS/фон; **не** Ассистент/Обращения), где искать приложения |
| [`kb-magazin-prilozheniy.md`](kb-magazin-prilozheniy.md) | Магазин, установка, EW, Ассистент через Пуск/стол (не трей) |
| [`kb-gaf-chat-perepiska-i-soobshcheniya.md`](kb-gaf-chat-perepiska-i-soobshcheniya.md) | Мессенджер, удалить сообщение, переписку, чат |
| [`kb-ugs-studio-i-hab.md`](kb-ugs-studio-i-hab.md) | UGS, UGS Studio, UGS Хаб, очередь генераций |
| [`kb-tsentr-uvedomleniy.md`](kb-tsentr-uvedomleniy.md) | Уведомления, колокольчик, поиск, фильтры, **синхронизация между устройствами**, группировка (кратко) |
| [`kb-content-manager-i-fayly.md`](kb-content-manager-i-fayly.md) | Файловый менеджер, папки, файлы, Content Library |
| [`kb-content-manager-ubrat-fayl-iz-biblioteki.md`](kb-content-manager-ubrat-fayl-iz-biblioteki.md) | Убрать чужой файл, GAF вложение, share, не Only owner |
| [`kb-ai-chat-studii-i-muzyka.md`](kb-ai-chat-studii-i-muzyka.md) | AI Чат, Студия изображений, Студия видео, музыка, генератор |
| [`kb-studiya-gu.md`](kb-studiya-gu.md) | Студия ГУ, голос, Live Voice, расшифровка |
| [`kb-doc-editor.md`](kb-doc-editor.md) | Doc Editor, документы, сохранение |
| [`kb-doc-editor-struktura-format-i-sovmestnaya-rabota.md`](kb-doc-editor-struktura-format-i-sovmestnaya-rabota.md) | Структура текста и абзацы, Markdown, совместная работа, приглашения, владелец, отключение участника |
| [`kb-doc-editor-menedzher-faylov.md`](kb-doc-editor-menedzher-faylov.md) | Менеджер файлов, список документов, поиск, недавние, правый клик, ИИ из списка, Escape |
| [`kb-social-hub.md`](kb-social-hub.md) | Social hub, друзья, профиль |
| [`kb-ewrp-prezentatsii.md`](kb-ewrp-prezentatsii.md) | EWRP, презентации, PDF, тема, Файловый менеджер, без веб-поиска, редактор слайдов (bullets, nav, hotkeys, спойлеры), UGS картинка/текст слайда, энергия |
| [`kb-marketing-kabinet-i-sayty.md`](kb-marketing-kabinet-i-sayty.md) | Зал маркетинга, Site Studio, КИРС, Мой сайт |
| [`kb-bufer-obmena.md`](kb-bufer-obmena.md) | Буфер обмена, история копирований |
| [`kb-oboi-i-personalizatsiya.md`](kb-oboi-i-personalizatsiya.md) | Обои, фон рабочего стола, персонализация |
| [`kb-pusk-poisk-i-kategorii.md`](kb-pusk-poisk-i-kategorii.md) | Пуск, поиск, вкладки, по категориям, быстрый поиск |
| [`kb-okna-i-virtualnye-stoly.md`](kb-okna-i-virtualnye-stoly.md) | Окна, переключение задач, виртуальные столы |
| [`kb-papki-korzina-i-muzyka.md`](kb-papki-korzina-i-muzyka.md) | Папки на столе, Корзина, Музыка, Загрузки |
| [`kb-proizvoditelnost-i-turbo.md`](kb-proizvoditelnost-i-turbo.md) | Производительность, FPS, Turbo, тормоза |
| [`kb-trey-stroki-gaf-druzya-ugs.md`](kb-trey-stroki-gaf-druzya-ugs.md) | Трей, GAF, друзья, UGS, фоновые процессы |
| [`kb-palitra-komand.md`](kb-palitra-komand.md) | Палитра команд, команды и действия |
| [`kb-goryachie-klavishi-rabochego-stola.md`](kb-goryachie-klavishi-rabochego-stola.md) | Горячие клавиши, F1, Win+S, Alt+Tab |
| [`kb-nastroyki-rabochego-stola.md`](kb-nastroyki-rabochego-stola.md) | Настройки Win+I, персонализация, иконки, окна, shell |
| [`kb-uvedomleniya-zvuk-i-ne-bespochoy.md`](kb-uvedomleniya-zvuk-i-ne-bespochoy.md) | Звук уведомлений, не беспокоить, лента, GAF/UGS |
| [`kb-vyhod-iz-akkaunta.md`](kb-vyhod-iz-akkaunta.md) | Выход, завершить сессию, выключение в Пуске |
| [`kb-sinhronizatsiya-i-oshibka-zagruzki.md`](kb-sinhronizatsiya-i-oshibka-zagruzki.md) | Синхронизация, сервер недоступен, не загружается стол |
| [`kb-ikonki-setka-i-menyu.md`](kb-ikonki-setka-i-menyu.md) | Значки, F2, Tab, сетка, ПКМ, новая папка |
| [`kb-snimok-ekrana.md`](kb-snimok-ekrana.md) | Скриншот, Win+Alt+S, Win+Shift+S |
| [`kb-pusk-admin-panel-i-katalog.md`](kb-pusk-admin-panel-i-katalog.md) | Пуск, админ-панель, каталог приложений |
| [`kb-ugs-vkladki-hab-dashbord-analitika.md`](kb-ugs-vkladki-hab-dashbord-analitika.md) | UGS вкладки Хаб, Дашборд, Аналитика, Админ, Конструктор |
| [`kb-obrashcheniya-kvoty-statusy-i-otvety.md`](kb-obrashcheniya-kvoty-statusy-i-otvety.md) | Обращения лимиты, пожелание, ошибка, ответ команды |
| [`kb-magazin-kategorii-filtry-i-poisk.md`](kb-magazin-kategorii-filtry-i-poisk.md) | Магазин категории, фильтры, поиск, EW |
| [`kb-panel-zadach-chasy-zakrep.md`](kb-panel-zadach-chasy-zakrep.md) | Панель задач, часы, закреплённые, показать стол |
| [`kb-tema-svetlaya-i-temnaya.md`](kb-tema-svetlaya-i-temnaya.md) | Тема светлая тёмная, Alt+Shift+T |
| [`kb-marketing-kabinet-razdely-i-kontekst.md`](kb-marketing-kabinet-razdely-i-kontekst.md) | Зал маркетинга компания проект разделы |
| [`kb-elitew-obzor-dlya-polzovatelya.md`](kb-elitew-obzor-dlya-polzovatelya.md) | Что такое EliteEW, рабочий стол, Ассистент/Обращения (Пуск, не трей) |
| [`kb-site-studio-sayt-i-zapusk.md`](kb-site-studio-sayt-i-zapusk.md) | Site Studio, сайт, витрина, запуск, админка |
| [`kb-gaf-chat-server-poisk-soobshcheniy.md`](kb-gaf-chat-server-poisk-soobshcheniy.md) | GAF сервер онлайн, поиск, шифрование, звук |
| [`kb-tsentr-uvedomleniy-prochitano-i-ochistka.md`](kb-tsentr-uvedomleniy-prochitano-i-ochistka.md) | Прочитать все, очистить с подтверждением, **группы по типу и по источнику**, прочитать группу, 99+ |
| [`kb-ai-chat-dialogi-i-vlozheniya.md`](kb-ai-chat-dialogi-i-vlozheniya.md) | AI Чат список чатов, новый чат, вложения, стоп |
| [`kb-doc-editor-bokovye-paneli.md`](kb-doc-editor-bokovye-paneli.md) | Doc Editor ИИ, голос, комментарии, картинки в документе |
| [`kb-konstruktor-workflow-ugs.md`](kb-konstruktor-workflow-ugs.md) | Конструктор workflow UGS, воркфлоу, запуск, права |
| [`kb-ugs-hab-vkladki-i-razdely.md`](kb-ugs-hab-vkladki-i-razdely.md) | UGS Хаб вкладки, очередь, история, результаты |
| [`kb-muzykalnyj-pleer-i-generator-pesen.md`](kb-muzykalnyj-pleer-i-generator-pesen.md) | Музыкальный плеер, папка Музыка, Любимые, плейлисты в аккаунте, удалить трек, ПКМ, Студия песен (SFT/BASE/TURBO), ИИ |
| [`kb-kirs-dostup-k-vitrine-sayta.md`](kb-kirs-dostup-k-vitrine-sayta.md) | КИРС, витрина, Мой сайт, доступ клиента |
| [`kb-studiya-video-iz-kartinki.md`](kb-studiya-video-iz-kartinki.md) | Студия видео, картинка в видео, очередь UGS |
| [`kb-ai-chat-geroi-i-rezhim-komanda.md`](kb-ai-chat-geroi-i-rezhim-komanda.md) | AI Чат герой, команда, новый чат, закрепить |
| [`kb-studiya-izobrazheniy-sozdanie-i-pravka.md`](kb-studiya-izobrazheniy-sozdanie-i-pravka.md) | Студия изображений, текст, правка, UGS Хаб |
| [`kb-rabochiy-stol-obnovlenie-stranitsy.md`](kb-rabochiy-stol-obnovlenie-stranitsy.md) | Обновить рабочий стол, F5, сбой |
| [`kb-marketing-istochniki-dokumentov-proekta.md`](kb-marketing-istochniki-dokumentov-proekta.md) | Маркетинг источники, поиск по смыслу, проект |
| [`kb-marketing-s-zakazchikom-chaty-i-dokumenty.md`](kb-marketing-s-zakazchikom-chaty-i-dokumenty.md) | С заказчиком, GAF, согласование, EWRP |
| [`kb-provodnik-kontenta-goryachaya-klavisha.md`](kb-provodnik-kontenta-goryachaya-klavisha.md) | Win+E, проводник, Файловый менеджер |
| [`kb-content-manager-filtry-vidy-i-sortirovka.md`](kb-content-manager-filtry-vidy-i-sortirovka.md) | Файловый менеджер фильтры, виды, сортировка, видимость |
| [`kb-content-manager-zagruzka-i-moy-arhiv.md`](kb-content-manager-zagruzka-i-moy-arhiv.md) | Загрузка файлов, архив ZIP, мой архив |
| [`kb-doc-editor-versii-i-biblioteka-faylov.md`](kb-doc-editor-versii-i-biblioteka-faylov.md) | Версии документа, библиотека, импорт, OCR |
| [`kb-marketing-imk-i-ai-studio.md`](kb-marketing-imk-i-ai-studio.md) | ИМК исследования, AI Studio маркетинга, UGS |
| [`kb-marketing-kampanii-zadachi-i-alerty.md`](kb-marketing-kampanii-zadachi-i-alerty.md) | Кампании, воронка, задачи, алерты |
| [`kb-marketing-strategiya-konkurenty-i-segmenty.md`](kb-marketing-strategiya-konkurenty-i-segmenty.md) | SWOT, сегменты, JTBD, ценность, доказательства |
| [`kb-marketing-kontekstnyy-chat-proekta.md`](kb-marketing-kontekstnyy-chat-proekta.md) | Контекстный чат маркетинга vs AI Чат |
| [`kb-okna-prikreplenie-k-krayam-ekrana.md`](kb-okna-prikreplenie-k-krayam-ekrana.md) | Окна Win стрелки, прикрепить, развернуть |
| [`kb-magazin-pochemu-nelzya-udalit-prilozhenie.md`](kb-magazin-pochemu-nelzya-udalit-prilozhenie.md) | Нельзя удалить, заводское, админское, магазин |
| [`kb-elitew-brauzer-i-obnovleniya.md`](kb-elitew-brauzer-i-obnovleniya.md) | Браузер, JavaScript, кэш, совместимость |
| [`kb-pervye-shagi-na-rabochem-stole.md`](kb-pervye-shagi-na-rabochem-stole.md) | Первые шаги после входа, Пуск, магазин, Ассистент/Обращения без трея |
| [`kb-obrashcheniya-bezopasnost-dannyh.md`](kb-obrashcheniya-bezopasnost-dannyh.md) | Обращения без паролей и секретов |
| [`kb-gaf-chat-novyy-dialog-poisk-druzey.md`](kb-gaf-chat-novyy-dialog-poisk-druzey.md) | GAF новый чат, поиск, архив, история |
| [`kb-tsentr-uvedomleniy-kompakt-i-polnyy-ekran.md`](kb-tsentr-uvedomleniy-kompakt-i-polnyy-ekran.md) | Компактная панель и полное окно, «Открыть полностью», длинный список и упрощённый режим |
| [`kb-virtualnye-stoly-sozdat-i-pereklyuchit.md`](kb-virtualnye-stoly-sozdat-i-pereklyuchit.md) | Виртуальные столы создать, Ctrl Win стрелки |
| [`kb-spravochnik-chastye-voprosy-i-vstavka.md`](kb-spravochnik-chastye-voprosy-i-vstavka.md) | Ассистент FAQ, поиск, вставить, спросить, показать в чате |
| [`kb-spravochnik-interfeys-chata-i-export.md`](kb-spravochnik-interfeys-chata-i-export.md) | Ассистент чат: экспорт, стоп, помогло, источники, горячие клавиши |
| [`kb-spravochnik-ssylki-otkryt-prilozhenie-v-otvete.md`](kb-spravochnik-ssylki-otkryt-prilozhenie-v-otvete.md) | Ссылки в ответе Ассистента — открыть приложение (Пуск/стол, не трей) |
| [`kb-spravochnik-limity-zaprosov-i-ozhidanie.md`](kb-spravochnik-limity-zaprosov-i-ozhidanie.md) | Слишком много запросов, подождите N с, лимит |
| [`kb-spravochnik-populyarnye-voprosy-i-chipy.md`](kb-spravochnik-populyarnye-voprosy-i-chipy.md) | Популярные вопросы chips, ответ без ИИ |
| [`kb-spravochnik-istochniki-i-podbor-dokumentov.md`](kb-spravochnik-istochniki-i-podbor-dokumentov.md) | Источники справочника, подбор по документам, RAG |
| [`kb-spravochnik-rannye-soobshcheniya-i-prokrutka.md`](kb-spravochnik-rannye-soobshcheniya-i-prokrutka.md) | Ранние сообщения, прокрутка, к новым |
| [`kb-spravochnik-ochistit-chat-i-dlinnyy-vopros.md`](kb-spravochnik-ochistit-chat-i-dlinnyy-vopros.md) | Очистить чат, лимит символов, копировать ответ FAQ |
| [`kb-spravochnik-goryachie-klavishi-i-vvod.md`](kb-spravochnik-goryachie-klavishi-i-vvod.md) | Enter, Ctrl+., слэш FAQ, Escape |
| [`kb-spravochnik-pomoglo-i-obratnaya-svyaz.md`](kb-spravochnik-pomoglo-i-obratnaya-svyaz.md) | «Помогло», обратная связь по ответу |
| [`kb-admin-spravochnik-sync-handbook-limity.md`](kb-admin-spravochnik-sync-handbook-limity.md) | Sync handbook, dry-run, лимит файлов (админ) |
| [`kb-obrashcheniya-struktura-poley-i-shpargalka.md`](kb-obrashcheniya-struktura-poley-i-shpargalka.md) | Обращения поля, шпаргалка пожелание баг |
| [`kb-marketing-komanda-proekta.md`](kb-marketing-komanda-proekta.md) | Команда проекта, роли маркетинг |
| [`kb-marketing-obzor-i-dashbord-proekta.md`](kb-marketing-obzor-i-dashbord-proekta.md) | Обзор проекта, дашборд виджеты |
| [`kb-ai-chat-eksport-istorii-markdown.md`](kb-ai-chat-eksport-istorii-markdown.md) | AI Чат экспорт истории Markdown |
| [`kb-rabochiy-stol-peremeshchenie-i-vyravnivanie.md`](kb-rabochiy-stol-peremeshchenie-i-vyravnivanie.md) | Значки перетаскивание, сетка, синхронизация |
| [`kb-content-manager-umnye-kollekcii-i-poisk.md`](kb-content-manager-umnye-kollekcii-i-poisk.md) | Умные коллекции, поиск Ctrl+F, каталог проводник |
| [`kb-content-manager-zagruzka-vidimost-druzya.md`](kb-content-manager-zagruzka-vidimost-druzya.md) | Загрузка видимость компания проект друзья |
| [`kb-content-manager-razlozhit-fayly-po-papkam.md`](kb-content-manager-razlozhit-fayly-po-papkam.md) | Разложить без папки, Content, системные папки |
| [`kb-marketing-prezentatsii-ewrp-i-proekt.md`](kb-marketing-prezentatsii-ewrp-i-proekt.md) | Презентации EWRP в кабинете, пустой список |
| [`kb-marketing-bokovaya-panel-i-signaly.md`](kb-marketing-bokovaya-panel-i-signaly.md) | Боковое меню, сигналы, просрочки, алерты |
| [`kb-ewrp-sozdat-prezentatsiyu-i-pdf.md`](kb-ewrp-sozdat-prezentatsiyu-i-pdf.md) | EWRP лендинг PDF очередь UGS вводные документ редактор (бесплатно vs UGS) перегенерация слайда энергия |
| [`kb-polnoekrannyy-rezhim-prilozheniya.md`](kb-polnoekrannyy-rezhim-prilozheniya.md) | Полноэкранный F11, выйти из полного экрана |
| [`kb-obrashcheniya-priznanie-i-nagrada.md`](kb-obrashcheniya-priznanie-i-nagrada.md) | Признание команды, доверенный участник |
| [`kb-social-hub-zayavki-i-ogranicheniya.md`](kb-social-hub-zayavki-i-ogranicheniya.md) | Заявки в друзья, блокировка, GAF |
| [`kb-ai-chat-zakrepit-udalit-pereimenovat.md`](kb-ai-chat-zakrepit-udalit-pereimenovat.md) | AI Чат закрепить удалить переименовать |
| [`kb-pereklyuchatel-okon-i-alt-tab.md`](kb-pereklyuchatel-okon-i-alt-tab.md) | Переключатель окон Alt+Tab передний план |
| [`kb-kalendar-prilozhenie.md`](kb-kalendar-prilozhenie.md) | Календарь открыть палитра команд |
| [`kb-bystriy-poisk-win-s-prilozheniya-i-fayly.md`](kb-bystriy-poisk-win-s-prilozheniya-i-fayly.md) | Быстрый поиск Win+S недавние файлы |
| [`kb-sistemnyy-monitor-cpu-ram-gpu.md`](kb-sistemnyy-monitor-cpu-ram-gpu.md) | Системный монитор CPU RAM GPU |
| [`kb-tsentr-uvedomleniy-sobytie-i-perehod.md`](kb-tsentr-uvedomleniy-sobytie-i-perehod.md) | Уведомление клик перейти в приложение |
| [`kb-content-library-i-menedzher-kontenta.md`](kb-content-library-i-menedzher-kontenta.md) | Content Library файловый менеджер папка |
| [`kb-trey-spravochnik-obrashcheniya-i-bystrye-deystviya.md`](kb-trey-spravochnik-obrashcheniya-i-bystrye-deystviya.md) | **Устарело:** трей без Ассистента/Обращений; см. `kb-trey-stroki-gaf-druzya-ugs.md` |
| [`kb-win-v-bufer-obmena-istoriya.md`](kb-win-v-bufer-obmena-istoriya.md) | Win+V буфер обмена история |
| [`kb-gaf-chat-uvedomlenie-i-otkrytie-chata.md`](kb-gaf-chat-uvedomlenie-i-otkrytie-chata.md) | GAF уведомление открыть чат |

Канон поведения продукта: [`../PRODUCT-ASSISTANT-HANDBOOK.md`](../PRODUCT-ASSISTANT-HANDBOOK.md).
