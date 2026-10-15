// EliteEW product presentation app logic (externalized for CSP script-src 'self').
const MODULES = [
      { id: "01", title: "Рабочий стол", cat: "platform", file: "01-desktop-shell.md", tagline: "Операционная система в браузере: окна, Пуск, Win+S/W/I/V, виджеты, сценарии.", highlights: ["Панель задач и Alt+Tab", "Quiet mode при >8 окон", "Персистентность под аккаунт"], apps: ["DesktopShellSettings"] },
      { id: "02", title: "Магазин приложений", cat: "platform", file: "02-app-store.md", tagline: "Витрина программ: категории, EW/триал, установка, режим обслуживания.", highlights: ["Каталог по ролям", "Цены в EW", "Связь с maintenance"], apps: ["AppStore"] },
      { id: "03", title: "Зал маркетинга", cat: "business", file: "03-marketing-cabinet.md", tagline: "Компания → проект → стратегия, кампании, RAG по vault, дашборд.", highlights: ["Исследования с ИИ", "Материалы проекта", "AMKA и кампании"], apps: ["MarketingCabinet"] },
      { id: "04", title: "Файловый менеджер", cat: "content", file: "04-content-manager.md", tagline: "Единая библиотека файлов: версии, доступ, связь с маркетингом.", highlights: ["7 вкладок", "Шаринг и vault", "Открытие в редакторах"], apps: ["ContentManagerPro"] },
      { id: "05", title: "Спутник EWA", cat: "ai", file: "05-ewa-companion.md", tagline: "Постоянный ИИ-компаньон: диалог, оркестрация стола, музыка и картинки.", highlights: ["Действия на столе", "Vision и TTS", "Не заменяет Экспертов"], apps: ["EwaApp"] },
      { id: "06", title: "Эксперты", cat: "ai", file: "06-desktop-ai-chat.md", tagline: "Инструментальный чат: персонаж или Команда до 3 экспертов, память, vault лида.", highlights: ["Голос в соло", "Умные действия", "Отдельно от EWA"], apps: ["DesktopAiChatApp"] },
      { id: "07", title: "Справочная Навигация", cat: "ai", file: "07-spravochnik-handbook.md", tagline: "FAQ + RAG по продукту; 106 kb-статей; запуск из трея.", highlights: ["Streaming ответы", "Источники RAG", "→ Обращения"], apps: ["AssistantApp"] },
      { id: "08", title: "Редактор документов", cat: "content", file: "08-doc-editor.md", tagline: "Редактор документов и V2: совместная работа, EWA рядом, экспорт.", highlights: ["Yjs collab", "V2 featured", "Файловый менеджер handoff"], apps: ["DocEditor", "DocEditorV2"] },
      { id: "09", title: "Мессенджер и Связи", cat: "social", file: "09-gaf-social-hub.md", tagline: "Переписка 1:1 и социальный граф: друзья, приватность, видеозвонки.", highlights: ["Мессенджер", "Связи", "VideoCall 1:1"], apps: ["GAFChatApp", "SocialHubApp", "VideoCallApp"] },
      { id: "10", title: "Site Studio", cat: "sites", file: "10-site-studio.md", tagline: "Личный сайт из шаблона; операторский Контроль сайтов.", highlights: ["UserSiteStudio", "SiteManagerOps", "Внутренние домены"], apps: ["UserSiteStudio", "SiteManagerOps"] },
      { id: "11", title: "EWRP", cat: "content", file: "11-ewrp-presentations.md", tagline: "Тема → слайды с иллюстрациями → PDF для встреч и заказчика.", highlights: ["UGS-иллюстрации", "Редактор слайдов", "Связь с маркетингом"], apps: ["EWRP"] },
      { id: "12", title: "Музыка", cat: "creative", file: "12-music.md", tagline: "Плеер, Генератор и Эволюционная студия — единая библиотека «Музыка».", highlights: ["Сейчас играет глобально", "XL Base / солисты", "UGS Hub очередь"], apps: ["MusicPlayer", "MusicGenerator", "MusicEvolutionApp"] },
      { id: "13", title: "Уведомления и сервис", cat: "social", file: "13-notifications-ewdesk-feedback.md", tagline: "Центр уведомлений, EWDesk, Обращения.", highlights: ["Sync inbox", "Корп. лента"], apps: ["NotificationsApp", "EWDeskApp", "FeedbackHubApp"] },
      { id: "14", title: "Mobile Android", cat: "mobile", file: "14-mobile-android.md", tagline: "Компактный спутник: лента, Мессенджер, push, часть UGS.", highlights: ["Не полный стол", "Мессенджер Lite", "UGS сценарии"], apps: [] },
      { id: "15", title: "Указатель UGS/спец.", cat: "hub", file: "15-ugs-specialty-apps.md", tagline: "Hub-навигация к углублённым отчётам 11–12, 22, 24–27.", highlights: ["Не дублирует детали", "Схема связей", "14 приложений → отчёты"], apps: [] },
      { id: "16", title: "Админка оператора", cat: "ops", file: "16-admin-operator.md", tagline: "Unified Admin: пользователи, каталог, UGS, EWA, EWDesk, справочник.", highlights: ["Не Keycloak admin", "Companion admin", "Каталог магазина"], apps: ["UnifiedAdminApp"] },
      { id: "17", title: "Кабинет заказчика", cat: "business", file: "17-customer-cabinet.md", tagline: "Представитель клиента: сводка, согласование, презентации, чат с РП.", highlights: ["≠ зал маркетинга", "Диагностика", "Только desktop"], apps: ["CustomerCabinet"] },
      { id: "19", title: "Classic Presentations", cat: "legacy", file: "19-presentations-classic.md", tagline: "Presentations* — алиасы EWRP; Reveal.js снят.", highlights: ["Одно окно EWRP", "Site Studio slides — отдельно"], apps: ["Presentations", "PresentationsArchive"] },
      { id: "20", title: "Local Service", cat: "ops", file: "20-local-service.md", tagline: "Ops/dev: iframe UI чат-сервера через защищённый прокси.", highlights: ["Не для масс. пользователя", "HttpOnly cookie", "Sandbox iframe"], apps: ["LocalServiceIframeApp"] },
      { id: "21", title: "Буфер и заметки", cat: "platform", file: "21-clipboard-and-widget-shelf.md", tagline: "Win+V история копирований; заметки/задачи на сервере.", highlights: ["Два разных инструмента", "Панель виджетов", "shell_state vs PG"], apps: ["ClipboardManager", "DesktopWidgetShelfApp"] },
      { id: "22", title: "Студия ГУ", cat: "ai", file: "22-studio-gu-voice.md", tagline: "Голос: диалог, штаб команд, Live Voice, транскрипция.", highlights: ["4 вкладки", "Замена VoiceStudio", "Виджет на столе"], apps: ["StudioGU"] },
      { id: "23", title: "Maintenance screen", cat: "ops", file: "23-desktop-app-maintenance.md", tagline: "Экран «на обслуживании» при флаге в каталоге магазина.", highlights: ["Не отдельное приложение", "Admin вкладка", "409 при установке"], apps: ["DesktopAppMaintenance"] },
      { id: "24", title: "POEMMA", cat: "business", file: "24-poemma.md", tagline: "Карта бизнеса: 90 дней, прибыль, роли, server sync.", highlights: ["≠ маркетинг", "Owner/team ACL", "Desktop-only"], apps: ["PoemmaApp"] },
      { id: "25", title: "Professional Worlds", cat: "business", file: "25-professional-worlds.md", tagline: "Профессиональный слой; пакет Риэлтор — объекты, CRM-lite, playbooks.", highlights: ["Черновики в EWRP", "12 инструментов", "UGS медиа"], apps: ["ProfessionalWorlds"] },
      { id: "26", title: "КИРС", cat: "sites", file: "26-kirs-curation.md", tagline: "Сайт по маркетинг-проекту: куратор + «Мой сайт» для клиента.", highlights: ["≠ личная Студия сайтов", "Handoff checklist", "≠ кабинет заказчика"], apps: ["KirsCuration", "KirsClientSite"] },
      { id: "27", title: "UGS и студии", cat: "creative", file: "27-ugs-creative-studios.md", tagline: "UGS Studio/Хаб, Студия изображений и видео, энергия ⚡.", highlights: ["Очередь и история", "I2V видео", "EWA + CM связи"], apps: ["UGS", "UGSHubApp", "ImageStudio", "VideoStudio"] },
    ];

    const APPS = [
      { name: "Магазин приложений", status: "active", cat: "system", research: "02", desc: "Каталог установки и удаления приложений." },
      { name: "Справочная Навигация", status: "active", cat: "productivity", research: "07", desc: "FAQ и чат с базой знаний продукта." },
      { name: "Файловый менеджер", status: "active", cat: "productivity", research: "04", desc: "Единая библиотека файлов." },
      { name: "Кабинет заказчика", status: "active", cat: "productivity", research: "17", desc: "Сводка и согласование для клиента." },
      { name: "Эксперты", status: "active", cat: "productivity", research: "06", desc: "Инструментальный чат с памятью." },
      { name: "Спутник стола", status: "active", cat: "productivity", research: "05", desc: "EWA companion на рабочем столе." },
      { name: "Зал маркетинга", status: "active", cat: "productivity", research: "03", desc: "Стратегия и кампании на данных проекта." },
      { name: "POEMMA", status: "active", cat: "productivity", research: "24", desc: "Карта бизнеса 90 дней." },
      { name: "Professional Worlds", status: "active", cat: "productivity", research: "25", desc: "Профессиональные среды; Риэлтор." },
      { name: "Редактор документов", status: "active", cat: "productivity", research: "08", desc: "Классический редактор." },
      { name: "Редактор документов V2", status: "active", cat: "productivity", research: "08", desc: "Collab + EWA." },
      { name: "EWRP", status: "active", cat: "productivity", research: "11", desc: "Презентации → PDF." },
      { name: "UGS Studio", status: "active", cat: "productivity", research: "27", desc: "Дашборд UGS." },
      { name: "UGS Хаб", status: "active", cat: "productivity", research: "27", desc: "Очередь и история." },
      { name: "Студия изображений", status: "active", cat: "productivity", research: "27", desc: "T2I и edit." },
      { name: "Студия видео", status: "active", cat: "productivity", research: "27", desc: "Image → video." },
      { name: "Студия ГУ", status: "active", cat: "productivity", research: "22", desc: "Голосовой контур." },
      { name: "Мессенджер", status: "active", cat: "communication", research: "09", desc: "Чаты 1:1." },
      { name: "Связи", status: "active", cat: "communication", research: "09", desc: "Друзья и приватность." },
      { name: "Видеозвонок", status: "active", cat: "communication", research: "09", desc: "Внутренние звонки." },
      { name: "Центр уведомлений", status: "active", cat: "communication", research: "13", desc: "Единая лента событий." },
      { name: "EWDesk", status: "active", cat: "communication", research: "13", desc: "Лента новостей." },
      { name: "Обращения", status: "active", cat: "communication", research: "13", desc: "Идеи и баги." },
      { name: "Музыкальный плеер", status: "active", cat: "home", research: "12", desc: "Библиотека и плейлисты." },
      { name: "Генератор песен", status: "active", cat: "home", research: "12", desc: "Полная муз. студия." },
      { name: "Эволюционная студия", status: "active", cat: "home", research: "12", desc: "Простая форма → трек." },
      { name: "Студия сайтов", status: "active", cat: "developer", research: "10", desc: "Личный сайт." },
      { name: "Контроль сайтов", status: "active", cat: "developer", research: "10", desc: "Оператор сайтов." },
      { name: "КИРС", status: "active", cat: "productivity", research: "26", desc: "Сайт по проекту." },
      { name: "Мой сайт", status: "active", cat: "productivity", research: "26", desc: "Клиент КИРС." },
      { name: "Local Service", status: "active", cat: "developer", research: "20", desc: "Ops iframe." },
      { name: "Буфер обмена", status: "active", cat: "widgets", research: "21", desc: "История Win+V." },
      { name: "Заметки и задачи", status: "active", cat: "productivity", research: "21", desc: "Виджет стола." },
      { name: "Настройки стола", status: "active", cat: "system", research: "01", desc: "Тема и обои." },
      { name: "Системный монитор", status: "active", cat: "system", research: "13", desc: "GPU API снят." },
      { name: "Админ-панель", status: "active", cat: "system", research: "16", desc: "Unified Admin." },
      { name: "На обслуживании", status: "active", cat: "system", research: "23", desc: "Maintenance UI." },
      { name: "Presentations", status: "legacy", cat: "productivity", research: "19", desc: "Алиас EWRP." },
      { name: "Архив презентаций", status: "legacy", cat: "productivity", research: "19", desc: "Алиас EWRP." },
      { name: "ComfyUI", status: "legacy", cat: "developer", research: "15", desc: "→ Image Studio." },
      { name: "Транскрибация", status: "hidden", cat: "productivity", research: "22", desc: "→ Студия ГУ." },
      { name: "Voice Studio", status: "hidden", cat: "productivity", research: "22", desc: "→ Студия ГУ." },
      { name: "Голосовые команды", status: "hidden", cat: "productivity", research: "22", desc: "→ Студия ГУ." },
      { name: "Друзья (legacy)", status: "hidden", cat: "communication", research: "09", desc: "→ Связи." },
      { name: "Профиль (legacy)", status: "hidden", cat: "communication", research: "09", desc: "→ Связи." },
    ];

    const CAT_LABELS = {
      platform: "Платформа", business: "Бизнес", content: "Контент", ai: "ИИ",
      social: "Общение", sites: "Сайты", creative: "Творчество", mobile: "Мобильный",
      hub: "Указатель", ops: "Оператор", legacy: "Legacy",
      system: "Система", productivity: "Продуктивность", communication: "Коммуникации",
      developer: "Разработка", home: "Дом", widgets: "Виджеты", hidden: "Скрытые",
    };

    const VALUES = [
      { t: "Integrated workspace", d: "Один вход: окна, файлы, маркетинг, чаты и ИИ в связке." },
      { t: "Два ИИ-контура", d: "EWA — спутник и действия; Эксперты — инструмент с файлами и Командой." },
      { t: "Маркетинг на своих данных", d: "RAG по vault проекта, не абстрактный интернет-мозг." },
      { t: "Заказчик в контуре", d: "Кабинет заказчика отдельно от кабинета маркетолога." },
      { t: "Мобильный спутник", d: "Android дополняет web, не копирует весь стол." },
    ];

    const ROLES = [
      { role: "Маркетолог", modules: ["03","04","11","17"], text: "Кабинет, материалы, EWRP, работа с заказчиком." },
      { role: "Руководитель", modules: ["03","24","13"], text: "Обзор проекта, POEMMA, дашборды." },
      { role: "Заказчик", modules: ["17","11"], text: "Сводка, согласование, презентации." },
      { role: "Автор", modules: ["04","08","11"], text: "Файлы, редакторы, презентации." },
      { role: "Специалист", modules: ["25","11","10"], text: "Professional Worlds, EWRP, сайты." },
      { role: "Пользователь", modules: ["01","05","06","09","07","13"], text: "Стол, EWA, чат, GAF, справочник." },
      { role: "Оператор сайтов", modules: ["10","26","16"], text: "Контроль сайтов, КИРС, админка." },
      { role: "Мобильный", modules: ["14","09","13"], text: "Лента, GAF, уведомления." },
    ];

    const MOBILE_YES = ["Лента EWDesk", "Мессенджер", "Друзья и профиль", "Push-уведомления", "Часть UGS (чат, картинки, песни)", "Упрощённый пульт стола"];
    const MOBILE_NO = ["Спутник EWA", "Зал маркетинга", "Кабинет заказчика", "POEMMA", "Professional Worlds", "Полный рабочий стол", "Site Studio", "Справочная навигация (нативно)"];

    const LIMITS = [
      {
        title: "У каждого свой набор программ на столе",
        text: "Какие иконки видит человек, зависит от его роли, того, что установлено из магазина приложений, и тарифа организации (в том числе пробного). Это не один фиксированный «коробочный» набор для всех.",
      },
      {
        title: "ИИ ускоряет черновики, а не заменяет эксперта",
        text: "Спутник, умный чат и генерации помогают быстрее готовить текст, картинки и музыку на ваших материалах. Они не подменяют маркетолога, юриста, риэлтора или полноценную CRM.",
      },
      {
        title: "Телефон дополняет браузер, а не копирует весь стол",
        text: "В Android удобны лента, переписка, уведомления и часть генераций. Полный рабочий стол, зал маркетинга, спутник EWA и многие студии — в web-версии.",
      },
      {
        title: "Генерации и сайты зависят от настроек организации",
        text: "Картинки, музыка, видео и публикация сайтов работают, когда подключены нужные сервисы и есть доступная энергия генераций. В другой среде набор возможностей может отличаться.",
      },
      {
        title: "Похожие названия — разные продукты",
        text: "POEMMA — карта бизнеса на 90 дней, это не зал маркетинга. КИРС — сайт по маркетинг-проекту для клиента, не личная студия сайтов. Кабинет заказчика — согласование с клиентом, это не КИРС.",
      },
      {
        title: "Системный монитор без live-метрик GPU",
        text: "Виджет «Системный монитор» на столе есть, но живые показатели видеокарты в интерфейсе сейчас не выводятся — только общий статус и заглушка по GPU.",
      },
    ];

    const ECO_NODES = [
      { id: "01", x: 700, y: 400, r: 38, label: "Стол" },
      { id: "02", x: 700, y: 105, r: 22, label: "Магазин" },
      { id: "03", x: 980, y: 250, r: 28, label: "Маркетинг" },
      { id: "04", x: 480, y: 360, r: 28, label: "Файлы" },
      { id: "05", x: 860, y: 390, r: 26, label: "EWA" },
      { id: "06", x: 580, y: 460, r: 26, label: "Эксперты" },
      { id: "07", x: 620, y: 230, r: 24, label: "Справочная навигация" },
      { id: "08", x: 420, y: 500, r: 24, label: "Редактор" },
      { id: "09", x: 1020, y: 480, r: 26, label: "Мессенджер" },
      { id: "10", x: 1140, y: 520, r: 24, label: "Сайты" },
      { id: "11", x: 720, y: 580, r: 24, label: "EWRP" },
      { id: "12", x: 300, y: 520, r: 24, label: "Музыка" },
      { id: "13", x: 820, y: 210, r: 22, label: "Уведом." },
      { id: "14", x: 700, y: 700, r: 26, label: "Mobile" },
      { id: "15", x: 340, y: 240, r: 20, label: "UGS hub", meta: true },
      { id: "16", x: 1220, y: 160, r: 22, label: "Админ", ops: true },
      { id: "17", x: 1140, y: 300, r: 24, label: "Заказчик" },
      { id: "18", x: 200, y: 220, r: 18, label: "Legacy", legacy: true },
      { id: "19", x: 360, y: 640, r: 18, label: "Pres.*", legacy: true },
      { id: "20", x: 1260, y: 620, r: 18, label: "Local", ops: true },
      { id: "21", x: 500, y: 180, r: 22, label: "Буфер" },
      { id: "22", x: 520, y: 580, r: 24, label: "Студия ГУ" },
      { id: "23", x: 980, y: 110, r: 18, label: "Maint.", ops: true },
      { id: "24", x: 900, y: 620, r: 24, label: "POEMMA" },
      { id: "25", x: 820, y: 660, r: 24, label: "Prof.W." },
      { id: "26", x: 1080, y: 420, r: 24, label: "КИРС" },
      { id: "27", x: 220, y: 400, r: 30, label: "UGS" },
    ];
    const ECO_HUB_LINKS = ECO_NODES.filter(n => n.id !== "01").map(n => ["01", n.id]);
    const ECO_CROSS_LINKS = [
      ["04", "03"], ["04", "08"], ["04", "12"], ["04", "24"],
      ["05", "27"], ["05", "08"], ["06", "03"], ["06", "04"], ["06", "07"], ["06", "22"],
      ["03", "17"], ["03", "11"], ["03", "26"], ["03", "10"],
      ["08", "04"], ["11", "03"], ["11", "17"],
      ["09", "13"], ["13", "07"],
      ["10", "26"], ["10", "17"], ["10", "16"],
      ["14", "09"], ["14", "13"],
      ["22", "13"], ["24", "03"], ["25", "04"], ["25", "11"], ["26", "03"], ["26", "17"],
      ["15", "27"], ["15", "12"], ["15", "25"],
      ["16", "27"], ["16", "05"], ["19", "11"], ["18", "09"], ["02", "23"],
    ];
    const ECO_UGS_LINKS = [
      ["01", "27"], ["04", "27"], ["05", "27"], ["12", "27"], ["11", "27"],
      ["25", "27"], ["14", "27"], ["27", "15"],
    ];

    // --- Render helpers ---
    function badgeClass(status) {
      if (status === "legacy") return "legacy";
      if (status === "hidden") return "hidden";
      return "active";
    }

    if (typeof marked !== "undefined") {
      marked.setOptions({ gfm: true, breaks: false });
    }

    function replayModalAnim() {
      ["modalTitle", "modalMeta", "modalBody"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.animation = "none";
        void el.offsetHeight;
        el.style.animation = "";
      });
    }

    function openModalShell(title, meta) {
      const m = document.getElementById("modal");
      document.getElementById("modalTitle").textContent = title;
      document.getElementById("modalMeta").textContent = meta || "";
      m.classList.add("open");
      document.body.style.overflow = "hidden";
      m.querySelector(".modal").scrollTop = 0;
      requestAnimationFrame(replayModalAnim);
    }

    function renderMarkdown(md) {
      if (typeof marked !== "undefined") {
        return marked.parse(md);
      }
      return `<pre>${md.replace(/</g, "&lt;")}</pre>`;
    }

    async function fetchResearchMarkdown(filename) {
      if (window.RESEARCH_CONTENT?.[filename]) {
        return window.RESEARCH_CONTENT[filename];
      }
      try {
        const res = await fetch(`research/${filename}`);
        if (res.ok) return await res.text();
      } catch (_) {
        /* file:// or offline */
      }
      return null;
    }

    async function openModuleModal(mod, metaExtra = "") {
      const apps = mod.apps?.length ? ` · apps: ${mod.apps.join(", ")}` : "";
      const meta = `research/${mod.file}${metaExtra ? ` · ${metaExtra}` : ""}${apps}`;
      openModalShell(mod.title, meta);
      const bodyEl = document.getElementById("modalBody");
      bodyEl.innerHTML = `<div class="md-loading">Загрузка отчёта…</div>`;

      const md = await fetchResearchMarkdown(mod.file);
      if (!md) {
        bodyEl.innerHTML = `
          <p>Не удалось загрузить <code>research/${mod.file}</code>.</p>
          <p>${mod.tagline}</p>
          <ul>${mod.highlights.map(h => `<li>${h}</li>`).join("")}</ul>
          <p><em>Research markdown soft-retired; use frozen <code>research-content.bundle.js</code>. Rebuild scripts live under <code>trash/20260812-154629/…/eliteew-product-card/</code> after restore of research sources.</em></p>`;
        return;
      }
      bodyEl.innerHTML = `<div class="md-body">${renderMarkdown(md)}</div>`;
    }

    function openModal(data) {
      openModalShell(data.title, data.meta || "");
      document.getElementById("modalBody").innerHTML = data.body;
    }

    function closeModal() {
      document.getElementById("modal").classList.remove("open");
      document.body.style.overflow = "";
    }

    function moduleCard(m, index) {
      const el = document.createElement("article");
      el.className = "card";
      el.style.setProperty("--i", String(index));
      el.dataset.cat = m.cat;
      el.dataset.search = (m.title + " " + m.tagline + " " + m.highlights.join(" ")).toLowerCase();
      el.innerHTML = `
        <div class="card-top">
          <span class="card-id">#${m.id}</span>
          <span class="badge platform">${CAT_LABELS[m.cat] || m.cat}</span>
        </div>
        <h3>${m.title}</h3>
        <p>${m.tagline}</p>
        <div class="card-tags">${m.highlights.map(h => `<span class="tag">${h}</span>`).join("")}</div>
      `;
      el.addEventListener("click", () => openModuleModal(m));
      return el;
    }

    function appCard(a, index) {
      const el = document.createElement("article");
      el.className = "card";
      el.style.setProperty("--i", String(index));
      el.dataset.cat = a.cat;
      el.dataset.status = a.status;
      el.dataset.search = (a.name + " " + a.desc).toLowerCase();
      el.innerHTML = `
        <div class="card-top">
          <span class="card-id">#${a.research}</span>
          <span class="badge ${badgeClass(a.status)}">${a.status === "active" ? "активно" : a.status === "legacy" ? "legacy" : "скрыто"}</span>
        </div>
        <h3>${a.name}</h3>
        <p>${a.desc}</p>
        <div class="card-tags"><span class="tag">${CAT_LABELS[a.cat]}</span></div>
      `;
      const mod = MODULES.find(x => x.id === a.research);
      el.addEventListener("click", () => {
        if (mod) openModuleModal(mod, a.name);
        else openModal({ title: a.name, meta: `research #${a.research}`, body: `<p>${a.desc}</p>` });
      });
      return el;
    }

    // Init nav
    const sections = [
      { id: "top", label: "Старт" },
      { id: "value", label: "Ценность" },
      { id: "roles", label: "Роли" },
      { id: "ecosystem", label: "Схема" },
      { id: "modules", label: "27 модулей" },
      { id: "apps", label: "47 apps" },
      { id: "mobile", label: "Mobile" },
      { id: "limits", label: "Важно" },
    ];
    const nav = document.getElementById("navLinks");
    sections.forEach((s, i) => {
      const a = document.createElement("a");
      a.href = `#${s.id}`;
      a.textContent = s.label;
      a.style.setProperty("--ni", String(i));
      nav.appendChild(a);
    });

    // Value grid
    const vg = document.getElementById("valueGrid");
    VALUES.forEach((v, i) => {
      const d = document.createElement("div");
      d.className = "value-card";
      d.style.setProperty("--i", String(i));
      d.innerHTML = `<strong>${v.t}</strong><span>${v.d}</span>`;
      vg.appendChild(d);
    });

    // Roles
    const rt = document.querySelector("#rolesTable tbody");
    ROLES.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.style.setProperty("--i", String(i));
      tr.innerHTML = `<td><strong>${r.role}</strong></td><td>${r.text}</td>`;
      tr.addEventListener("click", () => {
        document.getElementById("moduleSearch").value = "";
        filterModules("all", "");
        r.modules.forEach((mid, i) => {
          setTimeout(() => {
            const card = [...document.querySelectorAll("#moduleGrid .card")].find(c => c.querySelector(".card-id")?.textContent === `#${mid}`);
            if (card) {
              card.style.outline = "2px solid var(--accent2)";
              if (i === 0) card.scrollIntoView({ behavior: "smooth", block: "center" });
              setTimeout(() => { card.style.outline = ""; }, 2500);
            }
          }, i * 200);
        });
        document.getElementById("modules").scrollIntoView({ behavior: "smooth" });
      });
      rt.appendChild(tr);
    });

    // Mobile lists
    MOBILE_YES.forEach((t, i) => {
      const li = document.createElement("li");
      li.style.setProperty("--i", String(i));
      li.textContent = t;
      document.getElementById("mobileYes").appendChild(li);
    });
    MOBILE_NO.forEach((t, i) => {
      const li = document.createElement("li");
      li.style.setProperty("--i", String(i));
      li.textContent = t;
      document.getElementById("mobileNo").appendChild(li);
    });
    LIMITS.forEach((item, i) => {
      const li = document.createElement("li");
      li.style.setProperty("--i", String(i));
      li.innerHTML = `<strong>${item.title}</strong><span>${item.text}</span>`;
      document.getElementById("limitsList").appendChild(li);
    });

    // Module grid + filters
    const mg = document.getElementById("moduleGrid");
    MODULES.forEach((m, i) => mg.appendChild(moduleCard(m, i)));

    const mf = document.getElementById("moduleFilters");
    ["all", ...new Set(MODULES.map(m => m.cat))].forEach(c => {
      const p = document.createElement("button");
      p.type = "button";
      p.className = "pill" + (c === "all" ? " active" : "");
      p.textContent = c === "all" ? "Все" : (CAT_LABELS[c] || c);
      p.dataset.filter = c;
      p.addEventListener("click", () => {
        mf.querySelectorAll(".pill").forEach(x => x.classList.remove("active"));
        p.classList.add("active");
        filterModules(c, document.getElementById("moduleSearch").value);
      });
      mf.appendChild(p);
    });

    function filterModules(cat, q) {
      const ql = (q || "").toLowerCase().trim();
      mg.querySelectorAll(".card").forEach(card => {
        const okCat = cat === "all" || card.dataset.cat === cat;
        const okQ = !ql || card.dataset.search.includes(ql);
        card.style.display = okCat && okQ ? "" : "none";
      });
    }
    document.getElementById("moduleSearch").addEventListener("input", e => {
      const active = mf.querySelector(".pill.active")?.dataset.filter || "all";
      filterModules(active, e.target.value);
    });

    // App grid
    const ag = document.getElementById("appGrid");
    APPS.forEach((a, i) => ag.appendChild(appCard(a, i)));

    const af = document.getElementById("appFilters");
    ["all", "active", "legacy", "hidden"].forEach(c => {
      const p = document.createElement("button");
      p.type = "button";
      p.className = "pill" + (c === "all" ? " active" : "");
      p.textContent = c === "all" ? "Все" : (c === "active" ? "Активные" : c === "legacy" ? "Legacy" : "Скрытые");
      p.dataset.filter = c;
      p.addEventListener("click", () => {
        af.querySelectorAll(".pill").forEach(x => x.classList.remove("active"));
        p.classList.add("active");
        filterApps(c, document.getElementById("appSearch").value);
      });
      af.appendChild(p);
    });

    function filterApps(st, q) {
      const ql = (q || "").toLowerCase().trim();
      ag.querySelectorAll(".card").forEach(card => {
        const okSt = st === "all" || card.dataset.status === st;
        const okQ = !ql || card.dataset.search.includes(ql);
        card.style.display = okSt && okQ ? "" : "none";
      });
    }
    document.getElementById("appSearch").addEventListener("input", e => {
      const active = af.querySelector(".pill.active")?.dataset.filter || "all";
      filterApps(active, e.target.value);
    });

    // Ecosystem SVG
    const svg = document.getElementById("ecoSvg");
    const ns = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(ns, "defs");
    defs.innerHTML = `
      <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.95"/>
      </radialGradient>
      <radialGradient id="nodeGrad" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#312e81" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0.98"/>
      </radialGradient>
      <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.15"/>
        <stop offset="50%" stop-color="#22d3ee" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.15"/>
      </linearGradient>
      <linearGradient id="ugsGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.85"/>
      </linearGradient>
      <filter id="ecoGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    `;
    svg.appendChild(defs);

    const hub = ECO_NODES.find(n => n.id === "01");
    if (hub) {
      const pulse = document.createElementNS(ns, "circle");
      pulse.setAttribute("cx", hub.x); pulse.setAttribute("cy", hub.y); pulse.setAttribute("r", String(hub.r + 18));
      pulse.setAttribute("fill", "none");
      pulse.setAttribute("stroke", "rgba(34,211,238,0.25)");
      pulse.setAttribute("stroke-width", "2");
      const animR = document.createElementNS(ns, "animate");
      animR.setAttribute("attributeName", "r");
      animR.setAttribute("values", `${hub.r + 14};${hub.r + 28};${hub.r + 14}`);
      animR.setAttribute("dur", "4s");
      animR.setAttribute("repeatCount", "indefinite");
      const animO = document.createElementNS(ns, "animate");
      animO.setAttribute("attributeName", "opacity");
      animO.setAttribute("values", "0.5;0.15;0.5");
      animO.setAttribute("dur", "4s");
      animO.setAttribute("repeatCount", "indefinite");
      pulse.appendChild(animR);
      pulse.appendChild(animO);
      svg.appendChild(pulse);
    }

    const ecoLinkSeen = new Set();
    function addEcoLinks(pairs, kind, overlay = false) {
      pairs.forEach(([a, b], li) => {
        const key = [a, b].sort().join("-");
        if (!overlay && ecoLinkSeen.has(key)) return;
        if (!overlay) ecoLinkSeen.add(key);
        const n1 = ECO_NODES.find(n => n.id === a);
        const n2 = ECO_NODES.find(n => n.id === b);
        if (!n1 || !n2) return;
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", n1.x); line.setAttribute("y1", n1.y);
        line.setAttribute("x2", n2.x); line.setAttribute("y2", n2.y);
        line.classList.add("eco-link");
        if (kind === "ugs") {
          line.setAttribute("stroke", "url(#ugsGrad)");
          line.classList.add("eco-link-ugs");
        } else {
          line.setAttribute("stroke", "url(#linkGrad)");
          line.classList.add(kind === "hub" ? "eco-link-hub" : "eco-link-cross");
          if (kind === "cross") line.setAttribute("stroke-dasharray", "7 5");
        }
        line.style.setProperty("--li", String(li));
        svg.appendChild(line);
      });
    }
    addEcoLinks(ECO_HUB_LINKS, "hub");
    addEcoLinks(ECO_CROSS_LINKS, "cross");
    addEcoLinks(ECO_UGS_LINKS, "ugs", true);
    ECO_NODES.forEach((n, ni) => {
      const g = document.createElementNS(ns, "g");
      g.classList.add("eco-node");
      if (n.legacy) g.classList.add("eco-legacy");
      if (n.ops) g.classList.add("eco-ops");
      if (n.meta) g.classList.add("eco-meta");
      g.style.setProperty("--ni", String(ni));
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", n.x); circle.setAttribute("cy", n.y); circle.setAttribute("r", n.r);
      circle.setAttribute("fill", n.id === "01" ? "url(#hubGrad)" : "url(#nodeGrad)");
      const stroke = n.id === "01"
        ? "rgba(34,211,238,0.7)"
        : n.id === "27"
          ? "rgba(34,211,238,0.85)"
          : "rgba(139,92,246,0.55)";
      circle.setAttribute("stroke", stroke);
      circle.setAttribute("stroke-width", n.id === "01" || n.id === "27" ? "3" : "2");
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", n.x);
      label.setAttribute("y", n.y + (n.label.length > 9 ? 1 : 3));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", "#e8edf7");
      const fs = n.id === "01" ? 11 : (n.label.length > 9 ? 8.5 : 9.5);
      label.setAttribute("font-size", String(fs));
      label.setAttribute("font-family", "Manrope, sans-serif");
      label.setAttribute("font-weight", "700");
      label.textContent = n.label;
      const idTag = document.createElementNS(ns, "text");
      idTag.setAttribute("x", n.x);
      idTag.setAttribute("y", n.y + (n.r > 22 ? 15 : 13));
      idTag.setAttribute("text-anchor", "middle");
      idTag.setAttribute("fill", "rgba(34,211,238,0.75)");
      idTag.setAttribute("font-size", "7.5");
      idTag.setAttribute("font-family", "JetBrains Mono, monospace");
      idTag.textContent = `#${n.id}`;
      g.appendChild(circle);
      g.appendChild(label);
      g.appendChild(idTag);
      g.addEventListener("click", () => {
        const mod = MODULES.find(m => m.id === n.id);
        if (mod) openModuleModal(mod);
      });
      svg.appendChild(g);
    });

    // Intersection observer
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const t = en.target;
        if (t.classList.contains("card") || t.classList.contains("value-card")) {
          t.classList.add("visible");
        } else {
          t.classList.add("in-view");
        }
        if (t.dataset.count !== undefined && !t.dataset.done) {
          t.dataset.done = "1";
          animateCount(t);
        }
        if (t.classList.contains("eco-wrap")) {
          document.getElementById("ecoSvg")?.classList.add("eco-live");
        }
        io.unobserve(t);
      });
    }, { threshold: 0.12 });

    document.querySelectorAll(".card, .value-card").forEach(el => io.observe(el));
    document.querySelectorAll(".reveal-block, .reveal-fade").forEach(el => io.observe(el));
    document.querySelectorAll(".roles-table tbody tr").forEach(el => io.observe(el));
    document.querySelectorAll(".stat .num[data-count]").forEach(el => io.observe(el));
    document.querySelector(".eco-wrap") && io.observe(document.querySelector(".eco-wrap"));

    function animateCount(el) {
      const target = +el.dataset.count;
      let cur = 0;
      const step = Math.max(1, Math.ceil(target / 45));
      el.classList.add("counting");
      const t = setInterval(() => {
        cur += step;
        if (cur >= target) {
          cur = target;
          clearInterval(t);
          el.classList.remove("counting");
        }
        el.textContent = cur;
      }, 28);
    }

    requestAnimationFrame(() => document.body.classList.add("loaded"));

    // Progress + nav active
    const prog = document.getElementById("progress");
    const topNav = document.querySelector("nav.top-nav");
    window.addEventListener("scroll", () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (window.scrollY / h * 100) + "%";
      topNav?.classList.toggle("scrolled", window.scrollY > 24);
      const y = window.scrollY + 120;
      let current = sections[0].id;
      sections.forEach(s => {
        const el = document.getElementById(s.id);
        if (el && el.offsetTop <= y) current = s.id;
      });
      nav.querySelectorAll("a").forEach(a => {
        a.classList.toggle("active", a.getAttribute("href") === `#${current}`);
      });
    });

    // Presentation mode
    let presOn = false;
    let presIdx = 0;
    const presSections = [...document.querySelectorAll(".snap-section")];
    document.getElementById("presToggle").addEventListener("click", () => {
      presOn = !presOn;
      document.documentElement.classList.toggle("presentation-mode", presOn);
      document.getElementById("presToggle").textContent = presOn ? "⏸ Выход" : "▶ Презентация";
      if (presOn) presSections[presIdx]?.scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("exploreBtn").addEventListener("click", () => {
      document.getElementById("modules").scrollIntoView({ behavior: "smooth" });
    });

    document.addEventListener("keydown", e => {
      if (!presOn) return;
      if (document.getElementById("modal").classList.contains("open")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        presIdx = Math.min(presIdx + 1, presSections.length - 1);
        presSections[presIdx].scrollIntoView({ behavior: "smooth" });
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        presIdx = Math.max(presIdx - 1, 0);
        presSections[presIdx].scrollIntoView({ behavior: "smooth" });
      }
      if (e.key === "Escape") document.getElementById("presToggle").click();
    });

    // Modal
    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && document.getElementById("modal").classList.contains("open")) {
        closeModal();
      }
    });

    // Particle canvas
    const canvas = document.getElementById("bg-canvas");
    const ctx = canvas.getContext("2d");
    let particles = [];
    let mouse = { x: -9999, y: -9999 };
    window.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    window.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = Array.from({ length: Math.min(90, Math.floor(window.innerWidth / 14)) }, (_, i) => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.6 + 0.4,
        hue: i % 2 === 0 ? 265 : 190,
      }));
    }
    function drawParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        const dxm = mouse.x - p.x;
        const dym = mouse.y - p.y;
        const md = Math.hypot(dxm, dym);
        if (md < 140 && md > 0) {
          p.vx -= (dxm / md) * 0.015;
          p.vy -= (dym / md) * 0.015;
        }
        p.vx *= 0.995;
        p.vy *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 68%, 0.38)`;
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            ctx.strokeStyle = `hsla(200, 80%, 62%, ${0.14 * (1 - dist / 130)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      });
      requestAnimationFrame(drawParticles);
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) drawParticles();
