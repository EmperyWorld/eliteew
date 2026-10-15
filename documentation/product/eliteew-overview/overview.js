/**
 * EliteEW product overview — GitHub-style catalog (user + tech).
 * Visual shell mirrors eliteew-product-card presentation; content is living product fact, not investor deck.
 */
(function () {
  "use strict";

  const AREAS = [
    {
      id: "desktop-shell",
      cat: "platform",
      title: "Рабочий стол",
      summary: "Оконная оболочка в браузере: Пуск, панель задач, виджеты, горячие клавиши.",
      user: [
        "Открывает приложения в окнах на одном столе под своей учёткой.",
        "Настраивает тему, обои, quiet mode, сценарии и виджеты.",
        "Горячие клавиши Win+S / W / I / V — поиск, окна, настройки, буфер.",
      ],
      tech: [
        "SPA shell: `shared/web/frontend` desktop runtime + window manager.",
        "Состояние стола: `/api/v1/desktop/*` (items, shell_state, widgets).",
        "Canon: `documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md`.",
      ],
    },
    {
      id: "app-store",
      cat: "platform",
      title: "Магазин приложений",
      summary: "Каталог установки программ с учётом роли и install-profile.",
      user: [
        "Смотрит доступные приложения, ставит и снимает их со стола.",
        "Видит только то, что разрешено организацией и профилем поставки.",
      ],
      tech: [
        "Каталог `desktop_app_catalog` + `GET/POST /desktop/store|installed`.",
        "Фильтр: install-profile (`enabled_app_components`) ∪ RBAC.",
        "Манифесты: `shared/apps/*/app.manifest.yaml`. Canon: `DESKTOP-API-AND-APPS.md`, `DESKTOP-APP-STORE.md`.",
      ],
    },
    {
      id: "auth",
      cat: "platform",
      title: "Вход и сессия",
      summary: "Единый OIDC-вход организации; сессия связывает web, desktop-client и mobile.",
      user: [
        "Входит один раз — получает доступ к столу, файлам, чатам и ИИ по правам роли.",
        "Не настраивает Keycloak вручную: учётку выдаёт организация.",
      ],
      tech: [
        "Keycloak / OIDC (realm empery), browser BFF / PKCE по клиенту.",
        "API: OAuth2 resource protection на stack0; cookie/token contract в FE auth.",
        "Canon: `FRONTEND-AUTH.md`, `platform/docker-re_doc/KEYCLOAK-ELITEEW.md`.",
      ],
    },
    {
      id: "content-manager",
      cat: "content",
      title: "Файловый менеджер",
      summary: "Единая библиотека файлов: папки, версии, доступ, handoff в редакторы и маркетинг.",
      user: [
        "Хранит материалы проекта и личные файлы в одной библиотеке.",
        "Открывает документы в редакторе, шарит доступ, связывает с vault маркетинга.",
      ],
      tech: [
        "Content / blob APIs + ACL; интеграции с Doc Editor, EWRP, Marketing vault.",
        "Canon: `CONTENT-MANAGER.md`.",
      ],
    },
    {
      id: "doc-editor",
      cat: "content",
      title: "Редактор документов",
      summary: "Классический редактор и V2 с совместной работой и сопровождением EWA.",
      user: [
        "Пишет и правит документы; V2 — совместное редактирование и ИИ рядом.",
        "Импорт/экспорт и handoff из файлового менеджера.",
      ],
      tech: [
        "Ultimate Doc Editor + DocEditorV2 surfaces; collab (Yjs) на V2.",
        "Canon: `ULTIMATE-DOC-EDITOR.md`, `DOCUMENT-EDITOR-V2.md`, `DOC-EDITOR-COLLABORATION.md`.",
      ],
    },
    {
      id: "ewrp",
      cat: "content",
      title: "EWRP — презентации",
      summary: "Тема → слайды с иллюстрациями → PDF для встреч и заказчика.",
      user: [
        "Собирает презентацию из темы, правит слайды, выгружает PDF.",
        "Использует в маркетинге и кабинете заказчика.",
      ],
      tech: [
        "Генерация + browser render (offline HTML fonts); lifecycle generated files.",
        "Canon: `EWRP-REVOLUTIONARY-PRESENTATIONS.md`, `EWRP-GENERATED-FILES-LIFECYCLE.md`.",
      ],
    },
    {
      id: "marketing",
      cat: "business",
      title: "Зал маркетинга",
      summary: "Компания → проект → стратегия, кампании и исследования на материалах проекта.",
      user: [
        "Ведёт проекты и кампании; получает ответы ИИ по vault проекта, не «из интернета».",
        "Готовит материалы и передаёт заказчику через связанные поверхности.",
      ],
      tech: [
        "Marketing Cabinet + AMKA modules; RAG по project vault.",
        "Canon: `marketing/MARKETING-CABINET.md` (+ `marketing/`). EWA ≠ marketing AMKA.",
      ],
    },
    {
      id: "customer-cabinet",
      cat: "business",
      title: "Кабинет заказчика",
      summary: "Сводка, согласование и переписка с РП для представителя клиента.",
      user: [
        "Смотрит статус, согласует материалы и презентации, пишет РП.",
        "Это не зал маркетинга и не КИРС.",
      ],
      tech: [
        "Desktop app `CustomerCabinet`; отдельные ACL от маркетолога.",
        "Living product docs + desktop app registry.",
      ],
    },
    {
      id: "poemma",
      cat: "business",
      title: "POEMMA",
      summary: "Карта бизнеса на 90 дней: прибыль, команда, идеи — не маркетинг-кабинет.",
      user: [
        "Владелец/команда ведёт операционную карту бизнеса с синхронизацией на сервере.",
      ],
      tech: [
        "`PoemmaApp` + `/desktop` poemma workspace endpoints.",
        "Canon: `DESKTOP-API-AND-APPS.md` §Poemma.",
      ],
    },
    {
      id: "pro-worlds",
      cat: "business",
      title: "Professional Worlds",
      summary: "Профессиональные пакеты (напр. Риэлтор): объекты, клиенты, playbooks.",
      user: [
        "Работает в отраслевом контуре: карточки, клиенты, черновики в EWRP/сайтах.",
      ],
      tech: [
        "Pack manifests + FE surfaces; `PROFESSIONAL-WORLDS.md`, pack contracts.",
      ],
    },
    {
      id: "ewa",
      cat: "ai",
      title: "Ассистент EWA",
      summary: "Компаньон стола: диалог, оркестрация окон/действий, генерации по запросу.",
      user: [
        "Общается со спутником, просит действия на столе, музыку/картинки в рамках прав.",
        "Не путать с инструментальным чатом «Эксперты».",
      ],
      tech: [
        "`ewa_platform` API `/api/v1/ewa/*`, FE `features/ewa/`.",
        "Canon: `documentation/product/ewa/`. Отдельно от marketing AMKA.",
      ],
    },
    {
      id: "experts",
      cat: "ai",
      title: "Эксперты",
      summary: "Инструментальный ИИ-чат: файлы, память, соло или «Команда» экспертов.",
      user: [
        "Ведёт рабочий диалог с вложениями и памятью; может собрать команду экспертов.",
      ],
      tech: [
        "Desktop AI Chat → stack2 llama-chat / tool paths.",
        "Canon: `DESKTOP-LLAMA-CHAT.md`, desktop AI chat docs.",
      ],
    },
    {
      id: "handbook",
      cat: "ai",
      title: "Справочная навигация",
      summary: "FAQ и RAG по продукту EliteEW — помощь «как пользоваться».",
      user: [
        "Спрашивает про функции продукта; получает ответы со ссылками на знания.",
        "При необходимости уходит в Обращения.",
      ],
      tech: [
        "Product Assistant + KB indexing; handbook-user-docs / handbook-kb-articles.",
        "Canon: `SPRAVOCHNIK-AI.md`, `PRODUCT-ASSISTANT-HANDBOOK.md`.",
      ],
    },
    {
      id: "studio-gu",
      cat: "ai",
      title: "Студия ГУ",
      summary: "Голосовой контур: диалог, команды, Live Voice, транскрипция.",
      user: [
        "Работает голосом: диалог, штаб команд, транскрипция — из приложения или виджета.",
      ],
      tech: [
        "`StudioGU` desktop app; заменяет legacy VoiceStudio / отдельные voice apps.",
      ],
    },
    {
      id: "ugs",
      cat: "creative",
      title: "UGS и студии медиа",
      summary: "Очередь генераций, Image Studio, Video Studio, энергия генераций.",
      user: [
        "Запускает текст→картинка, правку по инструкции, картинка→короткое видео.",
        "Смотрит очередь и историю в UGS Hub / Studio.",
      ],
      tech: [
        "UGS workers + Comfy paths; FE stubs Image/Video Studio.",
        "Canon: `UGS-FLOW-AND-CONFIG.md`, `IMAGE-STUDIO.md`, `ugs_frontend_contract…`.",
      ],
    },
    {
      id: "music",
      cat: "creative",
      title: "Музыка",
      summary: "Плеер библиотеки и Music Forge — генерация треков в едином музыкальном контуре.",
      user: [
        "Слушает плейлисты на всём столе; генерирует песни в Forge / эволюционных сценариях.",
      ],
      tech: [
        "Music Player + MusicForge app (legacy MusicGenerator APIs — отдельно).",
        "Canon: `desktop/DESKTOP-MUSIC-PLAYER.md`, `MUSIC-FORGE-APP.md`.",
      ],
    },
    {
      id: "messenger",
      cat: "social",
      title: "Мессенджер, Связи, звонки",
      summary: "Личные чаты 1:1, социальный граф и внутренние видеозвонки.",
      user: [
        "Пишет коллегам, управляет друзьями/приватностью, звонит внутри сервиса.",
      ],
      tech: [
        "GAF Chat + Social Hub + Meet/video call integration.",
        "Canon: `GAF-CHAT-*.md`, `SOCIAL-HUB.md`, `INTERNAL-VIDEO-CALLS.md`.",
      ],
    },
    {
      id: "notifications",
      cat: "social",
      title: "Уведомления, EWDesk, Обращения",
      summary: "Единая лента событий, новости продукта и канал идей/багов.",
      user: [
        "Читает inbox уведомлений, ленту EWDesk, отправляет обращения команде.",
      ],
      tech: [
        "Notifications app + EWDesk + Feedback Hub APIs.",
        "Canon: desktop notifications docs, `FEEDBACK-HUB.md`, EWDesk product docs.",
      ],
    },
    {
      id: "sites",
      cat: "sites",
      title: "Сайты и КИРС",
      summary: "Личная студия сайтов, операторский контроль публикации и сайт по маркетинг-проекту.",
      user: [
        "Пользователь — личный сайт из шаблона; агентство — КИРС по проекту; клиент — «Мой сайт».",
        "Оператор — домены и здоровье публикации в Контроле сайтов.",
      ],
      tech: [
        "Site Studio + Site-Edge Carrier publish path; KIRS curation.",
        "Canon: `SITE-STUDIO.md`, `KIRS-SITE-CURATION.md`, `platform/SITE-EDGE-CARRIER.md`.",
      ],
    },
    {
      id: "mobile",
      cat: "mobile",
      title: "Mobile Android",
      summary: "Компактный спутник web: лента, чат, push, часть генераций — не полный стол.",
      user: [
        "На телефоне: EWDesk, мессенджер, друзья, уведомления, часть UGS.",
        "Нет полного стола, EWA-спутника, зала маркетинга, POEMMA, Site Studio.",
      ],
      tech: [
        "Pack door: `pack-cloud/mobile/`. OTA artifacts на runtime host.",
        "Canon: `mobile/*`, `api/ANDROID-API-CONTRACTS.md`.",
      ],
    },
    {
      id: "desktop-client",
      cat: "mobile",
      title: "Desktop client / FoFline",
      summary: "Нативное оболочное приложение (Tauri): offline / connected / FoFline seat modes.",
      user: [
        "Запускает EliteEW как клиент на устройстве; режим зависит от выданного места.",
        "FoFline — локальный SPA-пакет с обязательным защищённым каналом к API.",
      ],
      tech: [
        "Pack door: `pack-organization/connection-agent/`.",
        "Canon: `DESKTOP-TAURI-CONNECTED-CLIENT.md`, `DESKTOP-FOFLINE-EDITION.md`.",
      ],
    },
    {
      id: "admin",
      cat: "ops",
      title: "Unified Admin",
      summary: "Операторская панель: пользователи, каталог магазина, UGS, EWA, справочник.",
      user: [
        "Для оператора Empery / организации — не пользовательская фича стола.",
      ],
      tech: [
        "Unified Admin shell + companion admin surfaces.",
        "Canon: `platform/UNIFIED-ADMIN-SHELL.md`, docker-re_doc Admin* ops.",
      ],
    },
  ];

  const CAT_LABELS = {
    platform: "Платформа",
    content: "Контент",
    business: "Бизнес",
    ai: "ИИ",
    creative: "Творчество",
    social: "Общение",
    sites: "Сайты",
    mobile: "Клиенты",
    ops: "Оператор",
  };

  const PILLARS = [
    {
      t: "Один workspace",
      d: "Стол, файлы, маркетинг, чаты и ИИ в одной учётке — не набор разрозненных SaaS.",
    },
    {
      t: "Два ИИ-контура",
      d: "EWA — спутник и действия на столе; Эксперты — инструментальный чат с файлами и командой.",
    },
    {
      t: "Данные заказчика",
      d: "Маркетинг и генерации опираются на vault проекта и права доступа, не на «общий интернет-мозг».",
    },
    {
      t: "Платформа + приложения",
      d: "Kernel (shell, auth, registry) и pluggable apps по манифестам; editions: cloud / onprem / client.",
    },
  ];

  const STACK = [
    { k: "Frontend", v: "React SPA · Biome · pnpm · `shared/web/frontend`" },
    { k: "API", v: "FastAPI stack0 · `shared/api` · OAuth2 / Keycloak" },
    { k: "Data", v: "Postgres (stack1 + EWA) · Redis · Qdrant (vector)" },
    { k: "Realtime", v: "Socket.IO / WS · Meet для звонков" },
    { k: "AI", v: "stack2 llama-chat · gpu workers · Comfy / UGS pipelines" },
    { k: "Packs", v: "`shared/*` · `pack-cloud/mobile` · `pack-organization/connection-agent`" },
    { k: "Runtime", v: "Podman stacks · bake on command-center · run on prod-core" },
    { k: "Docs SoT", v: "`documentation/{product,platform,api,database,reference}/`" },
  ];

  const REPO_MAP = [
    { path: "shared/api/", note: "Backend, routers, ewa_platform, workers hooks" },
    { path: "shared/web/frontend/", note: "Desktop SPA, features, shell" },
    { path: "shared/apps/", note: "App manifests (install-profile / catalog)" },
    { path: "pack-cloud/mobile/", note: "Android cloud door" },
    { path: "pack-organization/connection-agent/", note: "Tauri desktop-client / FoFline door" },
    { path: "docker/", note: "Compose, bake, deploy scripts" },
    { path: "documentation/", note: "Living canon (this overview lives under product/)" },
  ];

  const LIMITS = [
    {
      title: "Состав стола не фиксирован",
      text: "Роль, магазин и install-profile определяют набор приложений. Не обещайте «все 40+ иконок всем».",
    },
    {
      title: "ИИ — ускоритель, не замена эксперта",
      text: "Черновики и генерации на ваших данных; не юрист, не полная CRM и не гарантия результата кампании.",
    },
    {
      title: "Mobile и client ≠ полный web-стол",
      text: "Телефон и offline/FoFline клиенты — scoped surfaces. Полный маркетинг, EWA и Site Studio — в web (или явном entitlements-наборе).",
    },
    {
      title: "Похожие имена — разные продукты",
      text: "POEMMA ≠ зал маркетинга. КИРС ≠ личная Site Studio. Кабинет заказчика ≠ КИРС. EWA ≠ marketing AMKA.",
    },
  ];

  /* ——— UI ——— */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let activeCat = "all";
  let query = "";

  function renderPillars() {
    const el = $("#pillars");
    el.innerHTML = PILLARS.map(
      (p) => `<article class="value-card"><h3>${p.t}</h3><p>${p.d}</p></article>`
    ).join("");
  }

  function renderStack() {
    const el = $("#stack-grid");
    el.innerHTML = STACK.map(
      (s) =>
        `<div class="stack-row"><span class="stack-k">${s.k}</span><code class="stack-v">${s.v}</code></div>`
    ).join("");
  }

  function renderRepo() {
    const el = $("#repo-map");
    el.innerHTML = REPO_MAP.map(
      (r) =>
        `<tr><td><code>${r.path}</code></td><td>${r.note}</td></tr>`
    ).join("");
  }

  function renderLimits() {
    const el = $("#limits");
    el.innerHTML = LIMITS.map(
      (l) =>
        `<article class="limit-card"><h3>${l.title}</h3><p>${l.text}</p></article>`
    ).join("");
  }

  function filteredAreas() {
    const q = query.trim().toLowerCase();
    return AREAS.filter((a) => {
      if (activeCat !== "all" && a.cat !== activeCat) return false;
      if (!q) return true;
      const blob = [a.title, a.summary, ...a.user, ...a.tech, CAT_LABELS[a.cat]]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }

  function renderPills() {
    const cats = ["all", ...Object.keys(CAT_LABELS)];
    const el = $("#cat-pills");
    el.innerHTML = cats
      .map((c) => {
        const label = c === "all" ? "Все" : CAT_LABELS[c];
        const count =
          c === "all" ? AREAS.length : AREAS.filter((a) => a.cat === c).length;
        return `<button type="button" class="pill${c === activeCat ? " active" : ""}" data-cat="${c}">${label} <span class="pill-n">${count}</span></button>`;
      })
      .join("");
    el.onclick = (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      activeCat = btn.getAttribute("data-cat");
      renderPills();
      renderCards();
    };
  }

  function renderCards() {
    const list = filteredAreas();
    const el = $("#area-grid");
    $("#area-count").textContent = String(list.length);
    if (!list.length) {
      el.innerHTML = `<p class="empty">Ничего не найдено. Сбросьте фильтр или поиск.</p>`;
      return;
    }
    el.innerHTML = list
      .map(
        (a, i) => `
      <article class="card visible" data-cat="${a.cat}" data-id="${a.id}" style="--i:${i}" tabindex="0" role="button">
        <div class="card-top">
          <span class="tag">${CAT_LABELS[a.cat]}</span>
          <span class="card-id">${a.id}</span>
        </div>
        <h3>${a.title}</h3>
        <p class="tagline">${a.summary}</p>
        <p class="card-hint">Открыть · пользовательский + технический</p>
      </article>`
      )
      .join("");

    el.querySelectorAll(".card").forEach((card) => {
      const open = () => openModal(card.getAttribute("data-id"));
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  }

  function openModal(id) {
    const a = AREAS.find((x) => x.id === id);
    if (!a) return;
    const modal = $("#modal");
    $("#modal-cat").textContent = CAT_LABELS[a.cat];
    $("#modal-title").textContent = a.title;
    $("#modal-summary").textContent = a.summary;
    $("#modal-user").innerHTML = a.user.map((t) => `<li>${t}</li>`).join("");
    $("#modal-tech").innerHTML = a.tech.map((t) => `<li>${t}</li>`).join("");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    $("#modal-close").focus();
  }

  function closeModal() {
    $("#modal").hidden = true;
    document.body.style.overflow = "";
  }

  function bindNav() {
    const nav = $("nav.top-nav");
    const progress = $("#progress");
    const links = $$(".nav-links a");

    const onScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle("scrolled", y > 12);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = max > 0 ? `${(y / max) * 100}%` : "0%";

      let current = links[0];
      for (const a of links) {
        const id = a.getAttribute("href")?.slice(1);
        const sec = id && document.getElementById(id);
        if (sec && sec.getBoundingClientRect().top <= 120) current = a;
      }
      links.forEach((a) => a.classList.toggle("active", a === current));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function init() {
    renderPillars();
    renderStack();
    renderRepo();
    renderLimits();
    renderPills();
    renderCards();
    bindNav();

    $("#search").addEventListener("input", (e) => {
      query = e.target.value;
      renderCards();
    });

    $("#modal-backdrop").addEventListener("click", closeModal);
    $("#modal-close").addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    $("#year").textContent = String(new Date().getFullYear());
  }

  document.addEventListener("DOMContentLoaded", init);
})();
