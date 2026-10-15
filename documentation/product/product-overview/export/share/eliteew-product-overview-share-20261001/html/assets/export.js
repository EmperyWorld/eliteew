/**
 * EliteEW product-overview export — HTML primary interactions.
 * Layering mechanics, sticky chrome, fade-in.
 * Labels stay neutral — not landing pilot claims.
 */
(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function nestDepth() {
    var depth = 0;
    var w = window;
    while (w && w.parent && w !== w.parent) {
      depth += 1;
      try {
        void w.parent.document.documentElement;
        w = w.parent;
      } catch (_err) {
        break;
      }
      if (depth > 16) break;
    }
    return depth;
  }

  function eggHost() {
    var w = window;
    try {
      while (w.parent && w !== w.parent) {
        void w.parent.document.documentElement;
        w = w.parent;
      }
    } catch (_err) {
      /* stay at current */
    }
    return w;
  }

  function runNestSalute(depth, copy) {
    var host = eggHost();
    var doc = host.document;
    if (!doc || !doc.body) return;
    var existing = doc.getElementById("ly-nest-egg");
    if (existing) existing.remove();

    var wrap = doc.createElement("div");
    wrap.id = "ly-nest-egg";
    wrap.className = "ly-nest-egg";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML =
      '<canvas class="ly-nest-canvas" aria-hidden="true"></canvas>' +
      '<div class="ly-nest-card">' +
      '<p class="ly-nest-kicker">' +
      copy.eggKicker +
      "</p>" +
      '<p class="ly-nest-title">' +
      copy.eggTitle +
      "</p>" +
      '<p class="ly-nest-body">' +
      copy.eggBody +
      "</p>" +
      '<p class="ly-nest-stack"><b>' +
      String(depth + 1) +
      "</b> · " +
      copy.eggLayers +
      "</p>" +
      '<button type="button" class="ly-nest-close">' +
      copy.eggClose +
      "</button>" +
      "</div>";
    doc.body.appendChild(wrap);

    var canvas = wrap.querySelector(".ly-nest-canvas");
    var closeBtn = wrap.querySelector(".ly-nest-close");
    var reduce =
      host.matchMedia &&
      host.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var burstN = Math.min(10, 3 + depth * 2);
    var particleN = Math.min(160, 48 + depth * 28);
    var raf = 0;
    var closed = false;

    function closeEgg() {
      if (closed) return;
      closed = true;
      if (raf) host.cancelAnimationFrame(raf);
      wrap.classList.add("is-out");
      host.setTimeout(function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }, 380);
    }

    if (closeBtn) closeBtn.addEventListener("click", closeEgg);
    wrap.addEventListener("click", function (ev) {
      if (ev.target === wrap) closeEgg();
    });

    if (!canvas || reduce || !canvas.getContext) {
      wrap.classList.add("is-on");
      return;
    }

    var ctx = canvas.getContext("2d");
    var w = 0;
    var h = 0;
    var rockets = [];
    var sparks = [];
    var colors = ["#22d3ee", "#67e8f9", "#2dd4bf", "#a78bfa", "#fbbf24", "#fb7185", "#f0abfc"];

    function resize() {
      w = host.innerWidth || doc.documentElement.clientWidth || 800;
      h = host.innerHeight || doc.documentElement.clientHeight || 600;
      canvas.width = w;
      canvas.height = h;
    }
    resize();
    host.addEventListener("resize", resize);

    function boom(x, y) {
      var c = colors[(Math.random() * colors.length) | 0];
      var n = particleN;
      for (var i = 0; i < n; i++) {
        var ang = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        var sp = 1.6 + Math.random() * (2.8 + depth * 0.35);
        sparks.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life: 55 + ((Math.random() * 35) | 0),
          color: c,
          g: 0.035 + Math.random() * 0.02,
        });
      }
    }

    function launch() {
      rockets.push({
        x: w * (0.15 + Math.random() * 0.7),
        y: h + 8,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -(6.2 + Math.random() * 3.2 + depth * 0.35),
        color: colors[(Math.random() * colors.length) | 0],
      });
    }

    var launched = 0;
    var tick = 0;
    function frame() {
      tick += 1;
      ctx.clearRect(0, 0, w, h);
      if (launched < burstN && tick % Math.max(8, 18 - depth * 2) === 0) {
        launch();
        launched += 1;
      }
      for (var r = rockets.length - 1; r >= 0; r--) {
        var rk = rockets[r];
        rk.x += rk.vx;
        rk.y += rk.vy;
        rk.vy += 0.055;
        ctx.beginPath();
        ctx.fillStyle = rk.color;
        ctx.arc(rk.x, rk.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (rk.vy >= -0.8 || rk.y < h * (0.18 + Math.random() * 0.2)) {
          boom(rk.x, rk.y);
          rockets.splice(r, 1);
        }
      }
      for (var s = sparks.length - 1; s >= 0; s--) {
        var p = sparks[s];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.g;
        p.vx *= 0.985;
        p.life -= 1;
        ctx.globalAlpha = Math.max(0, p.life / 70);
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (p.life <= 0) sparks.splice(s, 1);
      }
      if (!closed && (tick < 220 || rockets.length || sparks.length)) {
        raf = host.requestAnimationFrame(frame);
      }
    }

    wrap.classList.add("is-on");
    raf = host.requestAnimationFrame(frame);
    host.setTimeout(closeEgg, 7000 + depth * 600);
  }

  function initLayering(root) {
    if (!root) return;
    var chaosBtn = qs('[data-stage="chaos"]', root);
    var domeBtn = qs('[data-stage="dome"]', root);
    var toggle = qs("[data-ly-toggle]", root);
    var riskPanel = qs("[data-ly-risk]", root);
    var riskText = qs("[data-ly-risk-text]", root);
    var chaosLayer = qs(".ly-chaos", root);
    var domeLayer = qs(".ly-dome", root);
    var badge = qs("[data-ly-badge]", root);
    var frame = qs("[data-ly-ov-frame]", root);
    var ovLabel = qs("[data-ly-ov-label]", root);
    var ovOpen = qs(".ly-ov-open", root);
    var stage = qs("[data-ly-desk-stage]", root);
    var tasksEl = qs("[data-ly-tasks]", root);
    var startMenu = qs("[data-ly-start-menu]", root);
    var startToggle = qs("[data-ly-start-toggle]", root);
    var clockEl = qs("[data-ly-clock]", root);
    var snapGuide = qs("[data-ly-snap]", root);
    var ctxMenu = qs("[data-ly-ctx]", root);
    var toastStack = qs("[data-ly-toasts]", root);
    var qsPanel = qs("[data-ly-qs]", root);
    var keysPanel = qs("[data-ly-keys]", root);
    var switcherEl = qs("[data-ly-switcher]", root);
    var tasksPanel = qs("[data-ly-tasks-panel]", root);
    var paletteEl = qs("[data-ly-palette]", root);
    var bootEl = qs("[data-ly-boot]", root);
    var notifPanel = qs("[data-ly-notif]", root);
    var snapLayouts = qs("[data-ly-snap-layouts]", root);
    var isEn = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0;
    var zTop = 6;
    var cycleIdx = -1;
    var recentApps = [];
    var deskHiddenIds = [];
    var closedStack = [];
    var notifItems = [];
    var visitedChapters = {};
    var glowTheme = "cyan";
    var sessionStartedAt = 0;
    var paletteIndex = 0;
    var paletteItems = [];
    var layoutTargetId = "";
    var unreadNotifs = 0;
    var GLOW_ORDER = ["cyan", "teal", "amber"];
    var RECENT_KEY = "ly-desk-recent-" + (isEn ? "en" : "ru");
    var STAR_KEY = "ly-desk-stars-" + (isEn ? "en" : "ru");
    var RAIL_KEY = "ly-desk-rail-" + (isEn ? "en" : "ru");
    var THEME_KEY = "ly-desk-theme-" + (isEn ? "en" : "ru");
    var VISIT_KEY = "ly-desk-visit-" + (isEn ? "en" : "ru");
    var TRAIL_KEY = "ly-desk-trail-" + (isEn ? "en" : "ru");
    var STEM_KEY = "ly-desk-stem-" + (isEn ? "en" : "ru");
    var GEO_KEY = "ly-desk-geo-" + (isEn ? "en" : "ru");
    var starredChapters = [];
    var chapterTrail = [];
    var currentOvStem = "";
    var jumpEl = qs("[data-ly-jump]", root);
    var frameFadeTimer = 0;
    var starFilterOn = false;
    var geoStore = {};
    var completionFired = false;
    var historyEl = qs("[data-ly-history]", root);
    var readMode = false;
    var READ_KEY = "ly-desk-read-" + (isEn ? "en" : "ru");
    var APP_ORDER = ["overview", "desk", "files", "chat", "roles"];
    var APP_TITLES = isEn
      ? { overview: "Overview", desk: "Desk", files: "Files", chat: "Comms", roles: "Roles" }
      : { overview: "Обзор", desk: "Стол", files: "Файлы", chat: "Связь", roles: "Роли" };

    var COPY = isEn
      ? {
          toggleOn: "Remove dome · chaos again",
          toggleOff: "Enable work layer",
          badgeOn: "stage B · dome active",
          badgeOff: "stage A · no work layer",
          riskFallback:
            "Mixing personal and work on one screen — a typical Shadow IT risk.",
          ovPrefix: "Overview · ",
          focusOn: "Exit full browser",
          focusOff: "Full browser",
          eggKicker: "Nested desk · easter egg",
          eggTitle: "You nested the work layer",
          eggBody:
            "Thanks for poking at the metaphor this deep. The nesting bug stays — curiosity gets fireworks.",
          eggLayers: "layer stack",
          eggClose: "Nice · continue",
          toastOn: "Work layer session is active",
          toastArranged: "Windows arranged",
          toastWallpaper: "Desk glow refreshed",
          toastRestored: "Windows restored",
          toastClosed: "Window closed",
          toastSnapped: "Window snapped",
          toastTheme: "Glow theme",
          qsMeta: "Nest depth",
          qsOpen: "Open windows",
          showDesk: "Show desktop",
          restoreDesk: "Restore windows",
          tasksEmpty: "No open windows",
          tasksFocus: "Focus",
          tasksClose: "Close",
          toastPinned: "Window pinned",
          toastUnpinned: "Pin removed",
          toastShake: "Other windows minimized",
          paletteApp: "App",
          paletteAction: "Action",
          paletteChapter: "Chapter",
          actArrange: "Arrange windows",
          actDesktop: "Show desktop",
          actTheme: "Cycle glow theme",
          actTasks: "Task manager",
          actKeys: "Keyboard shortcuts",
          actFocus: "Full browser",
          actExit: "Remove work layer",
          actUnread: "Next unread chapter",
          actLayout: "Reset window layout",
          pinLabel: "Pin on top",
          unpinLabel: "Unpin",
          notifEmpty: "No notifications yet",
          notifTip: "Tip · Ctrl+K opens the command palette",
          notifContour: "Work layer is active · personal apps stay outside",
          toastRestoredWin: "Window restored",
          toastNoRestore: "Nothing to restore",
          sessionSummary: "Session · {m} min · {c} chapters · {s} starred",
          starOn: "Star chapter",
          starOff: "Unstar chapter",
          railHide: "Hide contents",
          railShow: "Show contents",
          paletteStar: "Starred",
          toastCopied: "Chapter link copied",
          toastCopyFail: "Could not copy link",
          toastStarred: "Chapter starred",
          toastUnstarred: "Star removed",
          recentLabel: "Recent",
          jumpFocus: "Focus",
          jumpMin: "Minimize",
          jumpClose: "Close",
          jumpChapters: "Recent chapters",
          jumpEmpty: "No recent chapters",
          crumbCover: "Cover",
          toastResume: "Continue · {title}",
          toastPartDone: "Part complete",
          starFilterOn: "Show all chapters",
          starFilterOff: "Starred only",
          partsProgress: "Parts progress",
          etaLeft: "~{n} min left",
          etaDone: "Caught up",
          toastComplete: "Overview complete · all chapters opened",
          toastLayoutReset: "Window layout reset",
          toastNoUnread: "No unread chapters",
          historyTitle: "Opened this session",
          historyEmpty: "No chapters yet",
          historyHint: "Click progress for history",
          actRead: "Toggle reading mode",
          actReplay: "Replay overview",
          readOn: "Exit reading mode",
          readOff: "Reading mode",
          toastReadOn: "Reading mode on",
          toastReadOff: "Reading mode off",
          toastReplay: "Progress cleared · starting over",
        }
      : {
          toggleOn: "Снять купол · снова хаос",
          toggleOff: "Включить рабочий слой",
          badgeOn: "этап B · купол активен",
          badgeOff: "этап A · без рабочего слоя",
          riskFallback:
            "Смешение личного и рабочего на одном экране — типичный риск Shadow IT.",
          ovPrefix: "Обзор · ",
          focusOn: "Свернуть с экрана",
          focusOff: "На весь экран",
          eggKicker: "Стол в столе · пасхалка",
          eggTitle: "Ты вложил рабочий слой в рабочий слой",
          eggBody:
            "Спасибо, что копнул метафору так глубоко. Баг вложенности остаётся — любопытство получает салют.",
          eggLayers: "стек слоёв",
          eggClose: "Красиво · дальше",
          toastOn: "Сессия рабочего слоя активна",
          toastArranged: "Окна упорядочены",
          toastWallpaper: "Свечение стола обновлено",
          toastRestored: "Окна восстановлены",
          toastClosed: "Окно закрыто",
          toastSnapped: "Окно привязано",
          toastTheme: "Тема свечения",
          qsMeta: "Глубина вложения",
          qsOpen: "Открытых окон",
          showDesk: "Показать стол",
          restoreDesk: "Вернуть окна",
          tasksEmpty: "Нет открытых окон",
          tasksFocus: "Фокус",
          tasksClose: "Закрыть",
          toastPinned: "Окно закреплено",
          toastUnpinned: "Закрепление снято",
          toastShake: "Остальные окна свёрнуты",
          paletteApp: "Приложение",
          paletteAction: "Действие",
          paletteChapter: "Глава",
          actArrange: "Упорядочить окна",
          actDesktop: "Показать стол",
          actTheme: "Сменить свечение",
          actTasks: "Диспетчер окон",
          actKeys: "Горячие клавиши",
          actFocus: "На весь экран",
          actExit: "Снять рабочий слой",
          actUnread: "Следующая непрочитанная",
          actLayout: "Сбросить раскладку окон",
          pinLabel: "Закрепить сверху",
          unpinLabel: "Открепить",
          notifEmpty: "Пока нет уведомлений",
          notifTip: "Подсказка · Ctrl+K открывает палитру команд",
          notifContour: "Рабочий слой активен · личное остаётся снаружи",
          toastRestoredWin: "Окно возвращено",
          toastNoRestore: "Нечего возвращать",
          sessionSummary: "Сессия · {m} мин · {c} глав · {s} в избранном",
          starOn: "В избранное",
          starOff: "Убрать из избранного",
          railHide: "Скрыть содержание",
          railShow: "Показать содержание",
          paletteStar: "Избранное",
          toastCopied: "Ссылка на главу скопирована",
          toastCopyFail: "Не удалось скопировать",
          toastStarred: "Глава в избранном",
          toastUnstarred: "Звезда снята",
          recentLabel: "Недавние",
          jumpFocus: "Фокус",
          jumpMin: "Свернуть",
          jumpClose: "Закрыть",
          jumpChapters: "Недавние главы",
          jumpEmpty: "Нет недавних глав",
          crumbCover: "Обложка",
          toastResume: "Продолжить · {title}",
          toastPartDone: "Часть прочитана",
          starFilterOn: "Показать все главы",
          starFilterOff: "Только избранное",
          partsProgress: "Прогресс по частям",
          etaLeft: "~{n} мин осталось",
          etaDone: "Всё открыто",
          toastComplete: "Обзор пройден · все главы открыты",
          toastLayoutReset: "Раскладка окон сброшена",
          toastNoUnread: "Непрочитанных глав нет",
          historyTitle: "Открыто в этой сессии",
          historyEmpty: "Пока нет глав",
          historyHint: "Клик по прогрессу — история",
          actRead: "Режим чтения",
          actReplay: "Пройти обзор заново",
          readOn: "Выйти из чтения",
          readOff: "Режим чтения",
          toastReadOn: "Режим чтения включён",
          toastReadOff: "Режим чтения выключен",
          toastReplay: "Прогресс сброшен · сначала",
        };

    try {
      var storedRecent = window.sessionStorage.getItem(RECENT_KEY);
      if (storedRecent) {
        recentApps = JSON.parse(storedRecent).filter(function (id) {
          return APP_ORDER.indexOf(id) !== -1;
        }).slice(0, 4);
      }
    } catch (_err) {
      recentApps = [];
    }
    try {
      var storedStars = window.sessionStorage.getItem(STAR_KEY);
      if (storedStars) {
        starredChapters = JSON.parse(storedStars).filter(function (x) {
          return typeof x === "string" && x;
        }).slice(0, 16);
      }
    } catch (_err2) {
      starredChapters = [];
    }
    try {
      var storedVisit = window.sessionStorage.getItem(VISIT_KEY);
      if (storedVisit) {
        var visitObj = JSON.parse(storedVisit);
        if (visitObj && typeof visitObj === "object") {
          Object.keys(visitObj).forEach(function (k) {
            if (k && visitObj[k]) visitedChapters[k] = true;
          });
        }
      }
    } catch (_err3) {
      /* ignore */
    }
    try {
      var storedTrail = window.sessionStorage.getItem(TRAIL_KEY);
      if (storedTrail) {
        chapterTrail = JSON.parse(storedTrail)
          .filter(function (x) {
            return x && typeof x.stem === "string" && x.stem;
          })
          .slice(0, 6);
      }
    } catch (_err4) {
      chapterTrail = [];
    }
    try {
      var storedStem = window.sessionStorage.getItem(STEM_KEY);
      if (storedStem) currentOvStem = storedStem;
    } catch (_err5) {
      /* ignore */
    }
    try {
      var storedGeo = window.sessionStorage.getItem(GEO_KEY);
      if (storedGeo) {
        var parsedGeo = JSON.parse(storedGeo);
        if (parsedGeo && typeof parsedGeo === "object") geoStore = parsedGeo;
      }
    } catch (_err6) {
      geoStore = {};
    }

    function wins() {
      return qsa(".ly-win", root);
    }

    function winById(id) {
      return qs('.ly-win[data-win="' + id + '"]', root);
    }

    function rememberRecent(id) {
      if (!id) return;
      recentApps = [id].concat(recentApps.filter(function (x) { return x !== id; })).slice(0, 4);
      try {
        window.sessionStorage.setItem(RECENT_KEY, JSON.stringify(recentApps));
      } catch (_err) {
        /* ignore */
      }
    }

    function setGlowTheme(theme, opts) {
      if (GLOW_ORDER.indexOf(theme) === -1) theme = "cyan";
      glowTheme = theme;
      var wall = qs(".ly-desk-wallpaper", root);
      if (wall) {
        wall.setAttribute("data-glow", theme);
      }
      var desk = qs("[data-ly-desk]", root);
      if (desk) desk.setAttribute("data-glow", theme);
      qsa("[data-theme]", root).forEach(function (btn) {
        btn.classList.toggle("is-on", btn.getAttribute("data-theme") === theme);
      });
      try {
        window.sessionStorage.setItem(THEME_KEY, theme);
      } catch (_err) {
        /* ignore */
      }
      if (opts && opts.toast) {
        pushToast(COPY.toastTheme + " · " + theme);
      }
    }

    function cycleGlowTheme() {
      var idx = GLOW_ORDER.indexOf(glowTheme);
      setGlowTheme(GLOW_ORDER[(idx + 1) % GLOW_ORDER.length], { toast: true });
      refreshWallpaper(true);
    }

    function renderRecent() {
      var wrap = qs("[data-ly-start-recent]", root);
      var list = qs("[data-ly-start-recent-list]", root);
      if (!wrap || !list) return;
      list.innerHTML = "";
      if (!recentApps.length) {
        wrap.hidden = true;
        return;
      }
      wrap.hidden = false;
      recentApps.forEach(function (id) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-open-win", id);
        btn.innerHTML =
          "<em>•</em><strong>" +
          (APP_TITLES[id] || id) +
          "</strong><span>" +
          id +
          "</span>";
        btn.addEventListener("click", function () {
          if (!root.classList.contains("is-dome")) return;
          openWin(id);
        });
        list.appendChild(btn);
      });
    }

    function setStartOpen(open) {
      if (!startMenu || !startToggle) return;
      startMenu.hidden = !open;
      startToggle.setAttribute("aria-expanded", open ? "true" : "false");
      startToggle.setAttribute("aria-pressed", open ? "true" : "false");
      startToggle.classList.toggle("is-on", open);
      if (open) {
        setQsOpen(false);
        setKeysOpen(false);
        setSwitcherOpen(false);
        setTasksOpen(false);
        setPaletteOpen(false);
        setNotifOpen(false);
        hideCtx();
        renderRecent();
        var search = qs("[data-ly-start-search]", root);
        if (search) {
          search.value = "";
          qsa(".ly-start-apps button", root).forEach(function (btn) {
            btn.hidden = false;
          });
          window.setTimeout(function () {
            try {
              search.focus();
            } catch (_err) {
              /* ignore */
            }
          }, 30);
        }
      }
    }

    function setQsOpen(open) {
      if (!qsPanel) return;
      qsPanel.hidden = !open;
      if (open) {
        setStartOpen(false);
        setKeysOpen(false);
        setSwitcherOpen(false);
        setTasksOpen(false);
        setPaletteOpen(false);
        setNotifOpen(false);
        hideCtx();
        var status = qs("[data-ly-qs-status]", root);
        var meta = qs("[data-ly-qs-meta]", root);
        var openCount = 0;
        wins().forEach(function (w) {
          if (w.classList.contains("is-open") && !w.hidden) openCount += 1;
        });
        if (status) {
          status.textContent = isEn ? "Session · active" : "Сессия · активна";
        }
        if (meta) {
          var uptime = "";
          if (sessionStartedAt) {
            var mins = Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 60000));
            uptime = isEn ? " · " + mins + " min" : " · " + mins + " мин";
          }
          meta.textContent =
            COPY.qsMeta +
            " · " +
            String(nestDepth()) +
            " · " +
            COPY.qsOpen +
            " · " +
            String(openCount) +
            uptime;
        }
        renderQsCalendar();
      }
    }

    function renderQsCalendar() {
      var cal = qs("[data-ly-qs-cal]", root);
      if (!cal) return;
      var now = new Date();
      var y = now.getFullYear();
      var m = now.getMonth();
      var today = now.getDate();
      var first = new Date(y, m, 1);
      var start = (first.getDay() + 6) % 7;
      var days = new Date(y, m + 1, 0).getDate();
      var months = isEn
        ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        : ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
      var html = "<p class=\"ly-qs-cal-title\">" + months[m] + " " + y + "</p><div class=\"ly-qs-cal-grid\">";
      var labels = isEn ? ["M", "T", "W", "T", "F", "S", "S"] : ["п", "в", "с", "ч", "п", "с", "в"];
      labels.forEach(function (l) {
        html += "<span class=\"ly-qs-cal-dow\">" + l + "</span>";
      });
      var i;
      for (i = 0; i < start; i += 1) html += "<span></span>";
      for (i = 1; i <= days; i += 1) {
        html +=
          "<span class=\"ly-qs-cal-day" +
          (i === today ? " is-today" : "") +
          "\">" +
          i +
          "</span>";
      }
      html += "</div>";
      cal.innerHTML = html;
    }

    function setKeysOpen(open) {
      if (!keysPanel) return;
      keysPanel.hidden = !open;
      if (open) {
        setStartOpen(false);
        setQsOpen(false);
        setSwitcherOpen(false);
        setTasksOpen(false);
        setPaletteOpen(false);
        setNotifOpen(false);
        hideCtx();
      }
    }

    function setSwitcherOpen(open) {
      if (!switcherEl) return;
      switcherEl.hidden = !open;
      if (!open) {
        switcherEl.innerHTML = "";
        return;
      }
      setStartOpen(false);
      setQsOpen(false);
      setKeysOpen(false);
      setTasksOpen(false);
      setPaletteOpen(false);
      setNotifOpen(false);
      hideCtx();
    }

    function setTasksOpen(open) {
      if (!tasksPanel) return;
      tasksPanel.hidden = !open;
      if (open) {
        setStartOpen(false);
        setQsOpen(false);
        setKeysOpen(false);
        setSwitcherOpen(false);
        setPaletteOpen(false);
        setNotifOpen(false);
        hideCtx();
        renderTasksPanel();
      }
    }

    function setPaletteOpen(open) {
      if (!paletteEl) return;
      paletteEl.hidden = !open;
      if (!open) {
        paletteItems = [];
        paletteIndex = 0;
        return;
      }
      setStartOpen(false);
      setQsOpen(false);
      setKeysOpen(false);
      setSwitcherOpen(false);
      setTasksOpen(false);
      setNotifOpen(false);
      hideCtx();
      var input = qs("[data-ly-palette-input]", root);
      if (input) {
        input.value = "";
        window.setTimeout(function () {
          try {
            input.focus();
          } catch (_err) {
            /* ignore */
          }
        }, 20);
      }
      renderPalette("");
    }

    function setNotifOpen(open) {
      if (!notifPanel) return;
      notifPanel.hidden = !open;
      var toggle = qs("[data-ly-notif-toggle]", root);
      if (toggle) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.classList.toggle("is-on", open);
      }
      if (open) {
        setStartOpen(false);
        setQsOpen(false);
        setKeysOpen(false);
        setSwitcherOpen(false);
        setTasksOpen(false);
        setPaletteOpen(false);
        hideCtx();
        hideSnapLayouts();
        unreadNotifs = 0;
        syncNotifBadge();
        renderNotifs();
      }
    }

    function syncNotifBadge() {
      var badge = qs("[data-ly-notif-badge]", root);
      if (!badge) return;
      if (unreadNotifs > 0) {
        badge.hidden = false;
        badge.textContent = String(Math.min(9, unreadNotifs));
      } else {
        badge.hidden = true;
      }
    }

    function rememberNotif(msg) {
      if (!msg) return;
      notifItems = [{ text: msg, at: Date.now() }].concat(notifItems).slice(0, 12);
      if (!notifPanel || notifPanel.hidden) {
        unreadNotifs += 1;
        syncNotifBadge();
      }
    }

    function renderNotifs() {
      var list = qs("[data-ly-notif-list]", root);
      if (!list) return;
      list.innerHTML = "";
      if (!notifItems.length) {
        var empty = document.createElement("p");
        empty.className = "ly-notif-empty";
        empty.textContent = COPY.notifEmpty;
        list.appendChild(empty);
        return;
      }
      notifItems.forEach(function (item) {
        var row = document.createElement("div");
        row.className = "ly-notif-row";
        var d = new Date(item.at);
        var hh = d.getHours();
        var mm = d.getMinutes();
        var time =
          (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
        row.innerHTML = "<strong>" + item.text + "</strong><span>" + time + "</span>";
        list.appendChild(row);
      });
    }

    function renderTasksPanel() {
      var list = qs("[data-ly-tasks-list]", root);
      if (!list) return;
      list.innerHTML = "";
      var rows = [];
      wins().forEach(function (win) {
        var open = win.classList.contains("is-open") && !win.hidden;
        var minimized = win.classList.contains("is-min");
        if (!open && !minimized) return;
        rows.push(win);
      });
      if (!rows.length) {
        var empty = document.createElement("p");
        empty.className = "ly-tasks-empty";
        empty.textContent = COPY.tasksEmpty;
        list.appendChild(empty);
        return;
      }
      rows.forEach(function (win) {
        var id = win.getAttribute("data-win") || "";
        var row = document.createElement("div");
        row.className =
          "ly-tasks-row" + (win.classList.contains("is-focus") && !win.hidden ? " is-active" : "");
        row.innerHTML =
          "<strong>" +
          (win.getAttribute("data-win-title") || APP_TITLES[id] || id) +
          "</strong><span>" +
          (win.classList.contains("is-min") ? "min" : id) +
          '</span><div class="ly-tasks-row-actions">' +
          '<button type="button" data-task-act="focus">' +
          COPY.tasksFocus +
          '</button><button type="button" data-task-act="close">' +
          COPY.tasksClose +
          "</button></div>";
        row.querySelector('[data-task-act="focus"]').addEventListener("click", function () {
          openWin(id);
          setTasksOpen(false);
        });
        row.querySelector('[data-task-act="close"]').addEventListener("click", function () {
          closeWin(id);
          renderTasksPanel();
        });
        list.appendChild(row);
      });
    }

    function renderSwitcher(activeId) {
      if (!switcherEl) return;
      switcherEl.innerHTML = "";
      var open = [];
      wins().forEach(function (w) {
        if (w.classList.contains("is-open") && !w.hidden) open.push(w);
      });
      open.forEach(function (win) {
        var id = win.getAttribute("data-win") || "";
        var btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("role", "option");
        btn.className = "ly-switcher-item" + (id === activeId ? " is-on" : "");
        btn.innerHTML =
          "<em></em><strong>" +
          (win.getAttribute("data-win-title") || APP_TITLES[id] || id) +
          "</strong>";
        btn.addEventListener("click", function () {
          openWin(id);
          setSwitcherOpen(false);
        });
        switcherEl.appendChild(btn);
      });
      setSwitcherOpen(true);
    }

    function buildPaletteCatalog() {
      var items = [];
      APP_ORDER.forEach(function (id) {
        items.push({
          kind: "app",
          label: APP_TITLES[id] || id,
          hint: COPY.paletteApp,
          run: function () {
            openWin(id);
          },
        });
      });
      items.push(
        {
          kind: "action",
          label: COPY.actArrange,
          hint: COPY.paletteAction,
          run: function () {
            arrangeWindows();
          },
        },
        {
          kind: "action",
          label: COPY.actUnread,
          hint: COPY.paletteAction,
          run: function () {
            stepOverviewUnread(1);
          },
        },
        {
          kind: "action",
          label: COPY.actRead,
          hint: COPY.paletteAction,
          run: function () {
            setReadMode(!readMode);
          },
        },
        {
          kind: "action",
          label: COPY.actReplay,
          hint: COPY.paletteAction,
          run: function () {
            replayOverview();
          },
        },
        {
          kind: "action",
          label: COPY.actLayout,
          hint: COPY.paletteAction,
          run: function () {
            resetWindowLayout();
          },
        },
        {
          kind: "action",
          label: COPY.actDesktop,
          hint: COPY.paletteAction,
          run: function () {
            showDesktop();
          },
        },
        {
          kind: "action",
          label: COPY.actTheme,
          hint: COPY.paletteAction,
          run: function () {
            cycleGlowTheme();
          },
        },
        {
          kind: "action",
          label: COPY.actTasks,
          hint: COPY.paletteAction,
          run: function () {
            setTasksOpen(true);
          },
        },
        {
          kind: "action",
          label: COPY.actKeys,
          hint: COPY.paletteAction,
          run: function () {
            setKeysOpen(true);
          },
        },
        {
          kind: "action",
          label: COPY.actFocus,
          hint: COPY.paletteAction,
          run: function () {
            setFocusMode(true);
          },
        },
        {
          kind: "action",
          label: COPY.actExit,
          hint: COPY.paletteAction,
          run: function () {
            setDome(false);
          },
        }
      );
      qsa(".ly-ov-link", root).forEach(function (link) {
        var stem = link.getAttribute("data-ov-stem") || "";
        var label = (link.textContent || "").trim();
        if (!stem || !label) return;
        var starred = starredChapters.indexOf(stem) !== -1;
        items.push({
          kind: starred ? "star" : "chapter",
          label: (starred ? "★ " : "") + label,
          hint: starred ? COPY.paletteStar : COPY.paletteChapter,
          stem: stem,
          run: function () {
            openWin("overview");
            setOverviewStem(stem, label);
          },
        });
      });
      items.sort(function (a, b) {
        if (a.kind === "star" && b.kind !== "star") return -1;
        if (b.kind === "star" && a.kind !== "star") return 1;
        return 0;
      });
      return items;
    }

    function renderPalette(query) {
      var list = qs("[data-ly-palette-list]", root);
      if (!list) return;
      var q = (query || "").trim().toLowerCase();
      var all = buildPaletteCatalog();
      if (q) {
        paletteItems = all.filter(function (item) {
          return (item.label + " " + item.hint).toLowerCase().indexOf(q) !== -1;
        });
      } else {
        var appsActions = all.filter(function (item) {
          return item.kind !== "chapter" && item.kind !== "star";
        });
        var stars = all.filter(function (item) {
          return item.kind === "star";
        });
        var chapters = all.filter(function (item) {
          return item.kind === "chapter";
        }).slice(0, 8);
        paletteItems = appsActions.concat(stars).concat(chapters);
      }
      list.innerHTML = "";
      paletteIndex = 0;
      paletteItems.forEach(function (item, idx) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("role", "option");
        btn.className = "ly-palette-item" + (idx === 0 ? " is-on" : "");
        btn.innerHTML =
          "<strong>" +
          item.label +
          "</strong><span>" +
          item.hint +
          "</span>";
        btn.addEventListener("click", function () {
          runPaletteItem(idx);
        });
        list.appendChild(btn);
      });
    }

    function runPaletteItem(idx) {
      var item = paletteItems[idx];
      if (!item) return;
      setPaletteOpen(false);
      item.run();
    }

    function movePalette(delta) {
      if (!paletteItems.length) return;
      paletteIndex = (paletteIndex + delta + paletteItems.length) % paletteItems.length;
      qsa(".ly-palette-item", root).forEach(function (el, i) {
        el.classList.toggle("is-on", i === paletteIndex);
      });
      var on = qs(".ly-palette-item.is-on", root);
      if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
    }

    function showBootSplash() {
      if (!bootEl) return;
      bootEl.hidden = false;
      bootEl.classList.remove("is-out");
      window.setTimeout(function () {
        bootEl.classList.add("is-out");
      }, 700);
      window.setTimeout(function () {
        bootEl.hidden = true;
        bootEl.classList.remove("is-out");
      }, 1100);
    }

    function restackPins() {
      wins().forEach(function (w) {
        if (
          w.classList.contains("is-pinned") &&
          w.classList.contains("is-open") &&
          !w.hidden
        ) {
          zTop += 1;
          w.style.zIndex = String(zTop);
        }
      });
    }

    function togglePin(id) {
      var win = winById(id);
      if (!win) return;
      var on = !win.classList.contains("is-pinned");
      win.classList.toggle("is-pinned", on);
      var pinBtn = qs("[data-win-pin]", win);
      if (pinBtn) {
        pinBtn.classList.toggle("is-on", on);
        pinBtn.setAttribute("aria-pressed", on ? "true" : "false");
        pinBtn.title = on ? COPY.unpinLabel : COPY.pinLabel;
        pinBtn.setAttribute("aria-label", on ? COPY.unpinLabel : COPY.pinLabel);
      }
      if (on) restackPins();
      pushToast(on ? COPY.toastPinned : COPY.toastUnpinned);
    }

    function shakeMinimizeOthers(keepId) {
      var did = false;
      wins().forEach(function (win) {
        var id = win.getAttribute("data-win") || "";
        if (id === keepId) return;
        if (win.classList.contains("is-pinned")) return;
        if (win.classList.contains("is-open") && !win.hidden) {
          minWin(id);
          did = true;
        }
      });
      if (did) pushToast(COPY.toastShake);
    }

    function syncShowDeskBtn() {
      var btn = qs("[data-ly-show-desk]", root);
      if (!btn) return;
      var restoring = deskHiddenIds.length > 0;
      btn.classList.toggle("is-armed", restoring);
      btn.title = restoring ? COPY.restoreDesk : COPY.showDesk;
      btn.setAttribute("aria-label", restoring ? COPY.restoreDesk : COPY.showDesk);
    }

    function syncWinDim() {
      var openCount = 0;
      wins().forEach(function (w) {
        if (w.classList.contains("is-open") && !w.hidden && !w.classList.contains("is-min")) {
          openCount += 1;
        }
      });
      wins().forEach(function (w) {
        var open =
          w.classList.contains("is-open") &&
          !w.hidden &&
          !w.classList.contains("is-min");
        w.classList.toggle(
          "is-dim",
          openCount > 1 && open && !w.classList.contains("is-focus")
        );
      });
    }

    function chapterLabelShort() {
      if (!currentOvStem) return "";
      var link = qs('.ly-ov-link[data-ov-stem="' + currentOvStem + '"]', root);
      var t = link ? (link.textContent || "").trim() : currentOvStem;
      if (t.length > 26) t = t.slice(0, 24) + "…";
      return t;
    }

    function syncOverviewChromeTitle(label) {
      var win = winById("overview");
      if (!win) return;
      var titleEl = qs(".ly-win-title", win);
      if (!titleEl) return;
      var base = APP_TITLES.overview || "Overview";
      var bit = (label || chapterLabelShort() || "").trim();
      titleEl.textContent = bit ? base + " · " + bit : base + (isEn ? " · pack" : " · пакет");
    }

    function syncTasks() {
      if (!tasksEl) return;
      tasksEl.innerHTML = "";
      wins().forEach(function (win) {
        var open = win.classList.contains("is-open") && !win.hidden;
        var minimized = win.classList.contains("is-min");
        if (!open && !minimized) return;
        var id = win.getAttribute("data-win") || "";
        var title = win.getAttribute("data-win-title") || id;
        var sub = id === "overview" ? chapterLabelShort() : "";
        var unread = 0;
        if (id === "overview") {
          var totalCh = qsa(".ly-ov-link", root).length;
          var seenCh = 0;
          Object.keys(visitedChapters).forEach(function (k) {
            if (k) seenCh += 1;
          });
          unread = Math.max(0, totalCh - seenCh);
        }
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "ly-task" +
          (win.classList.contains("is-focus") && open ? " is-active" : "") +
          (minimized ? " is-min" : "") +
          (sub ? " has-sub" : "");
        btn.setAttribute("data-task", id);
        btn.setAttribute("role", "listitem");
        var badge =
          unread > 0
            ? '<b class="ly-task-badge" aria-label="' + unread + '">' + (unread > 99 ? "99+" : String(unread)) + "</b>"
            : "";
        if (sub) {
          btn.title = title + " · " + sub;
          btn.innerHTML =
            '<i aria-hidden="true"></i><span class="ly-task-text"><strong>' +
            title +
            "</strong><em>" +
            sub +
            "</em></span>" +
            badge;
        } else {
          btn.title = title;
          btn.innerHTML = '<i aria-hidden="true"></i><span>' + title + "</span>" + badge;
        }
        btn.addEventListener("click", function () {
          hideJump();
          if (minimized || !win.classList.contains("is-focus")) {
            openWin(id);
          } else {
            minWin(id);
          }
        });
        btn.addEventListener("auxclick", function (ev) {
          if (ev.button !== 1) return;
          ev.preventDefault();
          closeWin(id);
        });
        btn.addEventListener("mousedown", function (ev) {
          if (ev.button === 1) ev.preventDefault();
        });
        btn.addEventListener("pointerenter", function () {
          wins().forEach(function (w) {
            w.classList.toggle("is-peek", (w.getAttribute("data-win") || "") === id);
          });
        });
        btn.addEventListener("pointerleave", function () {
          wins().forEach(function (w) {
            w.classList.remove("is-peek");
          });
        });
        btn.addEventListener("contextmenu", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          showJump(id, ev.clientX, ev.clientY);
        });
        tasksEl.appendChild(btn);
      });
      syncIcons();
      syncWinDim();
    }

    function syncIcons() {
      qsa(".ly-desk-icon[data-open-win]", root).forEach(function (icon) {
        var id = icon.getAttribute("data-open-win") || "";
        var win = winById(id);
        var live =
          !!win &&
          ((win.classList.contains("is-open") && !win.hidden) ||
            win.classList.contains("is-min"));
        icon.classList.toggle("is-live", live);
      });
    }

    function persistGeometry() {
      wins().forEach(function (win) {
        var id = win.getAttribute("data-win") || "";
        if (!id) return;
        geoStore[id] = {
          left: win.style.left || "",
          top: win.style.top || "",
          width: win.style.width || "",
          height: win.style.height || "",
          placed: win.getAttribute("data-placed") === "1",
          max: win.classList.contains("is-max"),
          restore: win.getAttribute("data-restore") || "",
        };
      });
      try {
        window.sessionStorage.setItem(GEO_KEY, JSON.stringify(geoStore));
      } catch (_err) {
        /* ignore */
      }
    }

    function applyStoredGeometry(win) {
      var id = win.getAttribute("data-win") || "";
      var g = geoStore[id];
      if (!g || !g.left) return false;
      win.style.left = g.left;
      win.style.top = g.top || "8%";
      win.style.width = g.width || "54%";
      win.style.height = g.height || "62%";
      if (g.restore) win.setAttribute("data-restore", g.restore);
      else win.removeAttribute("data-restore");
      win.classList.toggle("is-max", !!g.max);
      if (g.max) {
        win.style.left = "1.2%";
        win.style.top = "1.5%";
        win.style.width = "97.6%";
        win.style.height = "96.5%";
      }
      win.setAttribute("data-placed", "1");
      return true;
    }

    function cascadeWin(win) {
      if (!stage || win.getAttribute("data-placed") === "1") return;
      if (applyStoredGeometry(win)) return;
      var n = 0;
      wins().forEach(function (w) {
        if (w !== win && w.getAttribute("data-placed") === "1") n += 1;
      });
      var left = 10 + (n % 5) * 4;
      var top = 8 + (n % 5) * 5;
      win.style.left = left + "%";
      win.style.top = top + "%";
      if (!win.style.width) win.style.width = "54%";
      if (!win.style.height) win.style.height = "62%";
      win.setAttribute("data-placed", "1");
      persistGeometry();
    }

    function saveRestore(win) {
      win.setAttribute(
        "data-restore",
        [
          win.style.left || "",
          win.style.top || "",
          win.style.width || "",
          win.style.height || "",
        ].join("|")
      );
    }

    function applyRestore(win) {
      var raw = win.getAttribute("data-restore") || "";
      var parts = raw.split("|");
      if (parts.length === 4 && parts[0]) {
        win.style.left = parts[0];
        win.style.top = parts[1];
        win.style.width = parts[2];
        win.style.height = parts[3];
      }
      win.classList.remove("is-max");
    }

    function maxWin(id) {
      var win = winById(id);
      if (!win) return;
      if (win.classList.contains("is-max")) {
        applyRestore(win);
      } else {
        saveRestore(win);
        win.classList.add("is-max");
        win.style.left = "1.2%";
        win.style.top = "1.5%";
        win.style.width = "97.6%";
        win.style.height = "96.5%";
      }
      persistGeometry();
      focusWin(id);
    }

    function focusWin(id, opts) {
      var win = winById(id);
      if (!win) return;
      wins().forEach(function (w) {
        w.classList.remove("is-focus");
      });
      win.classList.add("is-focus");
      zTop += 1;
      win.style.zIndex = String(zTop);
      restackPins();
      if (opts && opts.pulse) {
        win.classList.remove("is-cycle-pulse");
        void win.offsetWidth;
        win.classList.add("is-cycle-pulse");
        window.setTimeout(function () {
          win.classList.remove("is-cycle-pulse");
        }, 420);
      }
      syncTasks();
      syncWinDim();
    }

    function openWin(id) {
      var win = winById(id);
      if (!win) return;
      var wasClosed = win.hidden && !win.classList.contains("is-min");
      win.hidden = false;
      win.classList.add("is-open");
      win.classList.remove("is-min");
      if (wasClosed) cascadeWin(win);
      win.classList.add("is-enter");
      window.setTimeout(function () {
        win.classList.remove("is-enter");
      }, 220);
      deskHiddenIds = deskHiddenIds.filter(function (x) { return x !== id; });
      syncShowDeskBtn();
      rememberRecent(id);
      setStartOpen(false);
      setQsOpen(false);
      setSwitcherOpen(false);
      setTasksOpen(false);
      setPaletteOpen(false);
      focusWin(id);
    }

    function closeWin(id) {
      var win = winById(id);
      if (!win) return;
      if (win.classList.contains("is-open") || win.classList.contains("is-min")) {
        closedStack = [id].concat(closedStack.filter(function (x) { return x !== id; })).slice(0, 8);
      }
      win.classList.remove("is-open", "is-focus", "is-min", "is-max", "is-pinned");
      win.hidden = true;
      win.removeAttribute("data-placed");
      var pinBtn = qs("[data-win-pin]", win);
      if (pinBtn) {
        pinBtn.classList.remove("is-on");
        pinBtn.setAttribute("aria-pressed", "false");
      }
      deskHiddenIds = deskHiddenIds.filter(function (x) { return x !== id; });
      syncShowDeskBtn();
      var next = null;
      wins().forEach(function (w) {
        if (w.classList.contains("is-open") && !w.hidden) next = w;
      });
      if (next) focusWin(next.getAttribute("data-win") || "");
      else syncTasks();
    }

    function restoreClosedWin() {
      if (!closedStack.length) {
        pushToast(COPY.toastNoRestore);
        return;
      }
      var id = closedStack.shift();
      openWin(id);
      pushToast(COPY.toastRestoredWin);
    }

    function minWin(id) {
      var win = winById(id);
      if (!win) return;
      win.classList.add("is-min");
      win.classList.remove("is-focus");
      win.classList.remove("is-open");
      win.hidden = true;
      var next = null;
      wins().forEach(function (w) {
        if (w.classList.contains("is-open") && !w.hidden) next = w;
      });
      if (next) focusWin(next.getAttribute("data-win") || "");
      else syncTasks();
    }

    function focusedWinId() {
      var focused = qs(".ly-win.is-focus.is-open", root);
      if (focused && !focused.hidden) return focused.getAttribute("data-win") || "";
      return "";
    }

    function showDesktop() {
      if (deskHiddenIds.length) {
        var restore = deskHiddenIds.slice();
        deskHiddenIds = [];
        syncShowDeskBtn();
        restore.forEach(function (id) {
          openWin(id);
        });
        pushToast(COPY.toastRestored);
        return;
      }
      var ids = [];
      wins().forEach(function (win) {
        var id = win.getAttribute("data-win") || "";
        if (win.classList.contains("is-open") && !win.hidden) {
          ids.push(id);
          minWin(id);
        }
      });
      deskHiddenIds = ids;
      syncShowDeskBtn();
      setStartOpen(false);
      setQsOpen(false);
    }

    function pushToast(msg) {
      if (!msg) return;
      rememberNotif(msg);
      if (!toastStack) return;
      var el = document.createElement("div");
      el.className = "ly-desk-toast";
      el.textContent = msg;
      el.setAttribute("role", "status");
      el.addEventListener("click", function () {
        el.classList.add("is-out");
        window.setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 220);
      });
      toastStack.appendChild(el);
      window.setTimeout(function () {
        el.classList.add("is-out");
      }, 2400);
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 2900);
    }

    function hideSnapLayouts() {
      if (!snapLayouts) return;
      snapLayouts.hidden = true;
      layoutTargetId = "";
    }

    function showSnapLayouts(win) {
      if (!snapLayouts || !stage || !win) return;
      layoutTargetId = win.getAttribute("data-win") || "";
      var winRect = win.getBoundingClientRect();
      var stageRect = stage.getBoundingClientRect();
      var maxBtn = qs("[data-win-max]", win);
      var anchor = maxBtn ? maxBtn.getBoundingClientRect() : winRect;
      var left = anchor.right - stageRect.left - 148;
      var top = anchor.bottom - stageRect.top + 6;
      left = Math.min(Math.max(8, left), stageRect.width - 156);
      top = Math.min(Math.max(8, top), stageRect.height - 90);
      snapLayouts.style.left = left + "px";
      snapLayouts.style.top = top + "px";
      snapLayouts.hidden = false;
    }

    function applyLayout(id, layout) {
      var win = winById(id);
      if (!win) return;
      openWin(id);
      if (layout === "full") {
        if (!win.classList.contains("is-max")) maxWin(id);
        hideSnapLayouts();
        return;
      }
      if (layout === "cols") {
        applySnap(win, "left");
        var other = null;
        wins().forEach(function (w) {
          var wid = w.getAttribute("data-win") || "";
          if (wid !== id && w.classList.contains("is-open") && !w.hidden) other = w;
        });
        if (other) applySnap(other, "right");
        else {
          var fallback = APP_ORDER.filter(function (x) { return x !== id; })[0];
          if (fallback) {
            openWin(fallback);
            applySnap(winById(fallback), "right");
          }
        }
        focusWin(id);
        hideSnapLayouts();
        return;
      }
      applySnap(win, layout);
      focusWin(id);
      hideSnapLayouts();
    }

    function setSnap(side) {
      if (!snapGuide) return;
      if (!side) {
        snapGuide.hidden = true;
        snapGuide.className = "ly-snap-guide";
        return;
      }
      snapGuide.hidden = false;
      snapGuide.className = "ly-snap-guide is-" + side;
    }

    function applySnap(win, side) {
      win.classList.remove("is-max");
      if (side === "left") {
        win.style.left = "1%";
        win.style.top = "1.5%";
        win.style.width = "48.5%";
        win.style.height = "96.5%";
      } else if (side === "right") {
        win.style.left = "50.5%";
        win.style.top = "1.5%";
        win.style.width = "48.5%";
        win.style.height = "96.5%";
      } else if (side === "tl") {
        win.style.left = "1%";
        win.style.top = "1.5%";
        win.style.width = "48.5%";
        win.style.height = "47.5%";
      } else if (side === "tr") {
        win.style.left = "50.5%";
        win.style.top = "1.5%";
        win.style.width = "48.5%";
        win.style.height = "47.5%";
      } else if (side === "bl") {
        win.style.left = "1%";
        win.style.top = "50.5%";
        win.style.width = "48.5%";
        win.style.height = "47.5%";
      } else if (side === "br") {
        win.style.left = "50.5%";
        win.style.top = "50.5%";
        win.style.width = "48.5%";
        win.style.height = "47.5%";
      } else if (side === "up") {
        maxWin(win.getAttribute("data-win") || "");
        setSnap(null);
        return;
      } else if (side === "down") {
        minWin(win.getAttribute("data-win") || "");
        setSnap(null);
        return;
      } else {
        setSnap(null);
        return;
      }
      win.setAttribute("data-placed", "1");
      setSnap(null);
      persistGeometry();
      pushToast(COPY.toastSnapped);
    }

    function snapFocused(side) {
      var id = focusedWinId();
      var win = winById(id);
      if (!win || win.hidden) return;
      if (side === "up") {
        if (win.classList.contains("is-max")) return;
        maxWin(id);
        return;
      }
      if (side === "down") {
        if (win.classList.contains("is-max")) {
          applyRestore(win);
          focusWin(id);
          return;
        }
        minWin(id);
        return;
      }
      applySnap(win, side);
      focusWin(id);
    }

    function arrangeWindows(opts) {
      var open = [];
      wins().forEach(function (w) {
        if (w.classList.contains("is-open") && !w.hidden) open.push(w);
      });
      if (!open.length) return;
      open.forEach(function (win, i) {
        win.classList.remove("is-max");
        var cols = Math.min(3, open.length);
        var col = i % cols;
        var row = Math.floor(i / cols);
        var rows = Math.ceil(open.length / cols);
        var w = 94 / cols;
        var h = 90 / rows;
        win.style.left = 3 + col * (w + 1) + "%";
        win.style.top = 4 + row * (h + 2) + "%";
        win.style.width = w + "%";
        win.style.height = h + "%";
        win.setAttribute("data-placed", "1");
        win.style.zIndex = String(4 + i);
      });
      zTop = 4 + open.length;
      focusWin(open[open.length - 1].getAttribute("data-win") || "");
      persistGeometry();
      if (!(opts && opts.silent)) pushToast(COPY.toastArranged);
    }

    function resetWindowLayout() {
      geoStore = {};
      try {
        window.sessionStorage.removeItem(GEO_KEY);
      } catch (_err) {
        /* ignore */
      }
      wins().forEach(function (win) {
        win.removeAttribute("data-placed");
        win.removeAttribute("data-restore");
        win.classList.remove("is-max");
      });
      var openCount = 0;
      wins().forEach(function (w) {
        if (w.classList.contains("is-open") && !w.hidden) openCount += 1;
      });
      if (openCount) arrangeWindows({ silent: true });
      else persistGeometry();
      pushToast(COPY.toastLayoutReset);
    }

    function setReadMode(on, opts) {
      opts = opts || {};
      readMode = !!on;
      var ov = qs("[data-ly-overview]", root);
      var desk = qs("[data-ly-desk]", root);
      var btn = qs("[data-ly-ov-read]", root);
      if (ov) ov.classList.toggle("is-reading", readMode);
      if (desk) desk.classList.toggle("is-reading-desk", readMode);
      if (btn) {
        btn.classList.toggle("is-on", readMode);
        btn.setAttribute("aria-pressed", readMode ? "true" : "false");
        btn.title = readMode ? COPY.readOn : COPY.readOff;
      }
      if (readMode) {
        openWin("overview");
        setRailCollapsed(true);
        hideHistory();
      }
      try {
        window.sessionStorage.setItem(READ_KEY, readMode ? "1" : "0");
      } catch (_err) {
        /* ignore */
      }
      if (opts.toast !== false) {
        pushToast(readMode ? COPY.toastReadOn : COPY.toastReadOff);
      }
    }

    function replayOverview() {
      visitedChapters = {};
      completionFired = false;
      chapterTrail = [];
      currentOvStem = "";
      try {
        window.sessionStorage.removeItem(VISIT_KEY);
        window.sessionStorage.removeItem(TRAIL_KEY);
        window.sessionStorage.removeItem(STEM_KEY);
      } catch (_err) {
        /* ignore */
      }
      openWin("overview");
      setReadMode(false, { toast: false });
      var first = qs(".ly-ov-link", root);
      if (first) {
        setOverviewStem(
          first.getAttribute("data-ov-stem") || "",
          (first.textContent || "").trim(),
          { skipFade: true }
        );
      } else {
        persistReading();
        syncOvProgress();
        syncStars();
        renderRecentStrip();
      }
      pushToast(COPY.toastReplay);
    }

    function refreshWallpaper(silent) {
      var glow = qs(".ly-desk-glow", root);
      if (!glow) return;
      glow.classList.remove("is-pulse");
      void glow.offsetWidth;
      glow.classList.add("is-pulse");
      if (!silent) pushToast(COPY.toastWallpaper);
    }

    function hideCtx() {
      if (ctxMenu) ctxMenu.hidden = true;
    }

    function hideJump() {
      if (jumpEl) jumpEl.hidden = true;
    }

    function hideHistory() {
      if (historyEl) historyEl.hidden = true;
    }

    function showHistoryNear(anchor) {
      if (!historyEl || !stage) return;
      hideJump();
      hideCtx();
      setStartOpen(false);
      setQsOpen(false);
      historyEl.innerHTML = "";
      var head = document.createElement("p");
      head.className = "ly-history-title";
      head.textContent = COPY.historyTitle;
      historyEl.appendChild(head);
      var stems = Object.keys(visitedChapters).filter(function (k) { return k; });
      if (!stems.length) {
        var empty = document.createElement("p");
        empty.className = "ly-history-empty";
        empty.textContent = COPY.historyEmpty;
        historyEl.appendChild(empty);
      } else {
        var ordered = chapterTrail
          .map(function (x) { return x.stem; })
          .filter(function (s, i, a) { return s && a.indexOf(s) === i && visitedChapters[s]; });
        stems.forEach(function (s) {
          if (ordered.indexOf(s) === -1) ordered.push(s);
        });
        ordered.slice(0, 12).forEach(function (stem) {
          var link = qs('.ly-ov-link[data-ov-stem="' + stem + '"]', root);
          var label = link ? (link.textContent || "").trim() : stem;
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          if (stem === currentOvStem) b.classList.add("is-on");
          b.addEventListener("click", function () {
            hideHistory();
            openWin("overview");
            setOverviewStem(stem, label);
          });
          historyEl.appendChild(b);
        });
      }
      historyEl.hidden = false;
      var rect = stage.getBoundingClientRect();
      var ar = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
      var x = ar ? ar.left + ar.width / 2 : rect.left + rect.width / 2;
      var y = ar ? ar.bottom + 6 : rect.top + 80;
      placeFloatMenu(historyEl, x, y);
    }

    function celebrateCompletion() {
      var desk = qs("[data-ly-desk]", root);
      if (desk) {
        desk.classList.add("is-complete");
        window.setTimeout(function () {
          desk.classList.remove("is-complete");
        }, 1400);
      }
      refreshWallpaper(true);
      pushToast(COPY.toastComplete);
      rememberNotif(COPY.toastComplete);
      window.setTimeout(function () {
        rememberNotif(COPY.actReplay + " · Ctrl+Shift+0");
      }, 400);
    }

    function placeFloatMenu(el, x, y) {
      if (!el || !stage) return;
      var stageRect = stage.getBoundingClientRect();
      var left = x - stageRect.left;
      var top = y - stageRect.top;
      var menuW = el.offsetWidth || 200;
      var menuH = el.offsetHeight || 160;
      left = Math.min(Math.max(8, left), stageRect.width - menuW - 8);
      top = Math.min(Math.max(8, top), stageRect.height - menuH - 8);
      el.style.left = left + "px";
      el.style.top = top + "px";
    }

    function showJump(id, x, y) {
      if (!jumpEl || !stage || !id) return;
      hideCtx();
      setStartOpen(false);
      setQsOpen(false);
      setSwitcherOpen(false);
      setTasksOpen(false);
      setPaletteOpen(false);
      setNotifOpen(false);
      jumpEl.innerHTML = "";
      var addItem = function (label, run, opts) {
        opts = opts || {};
        if (opts.sep) {
          var sep = document.createElement("div");
          sep.className = "ly-jump-sep";
          sep.setAttribute("role", "separator");
          if (label) {
            sep.textContent = label;
            sep.classList.add("is-label");
          }
          jumpEl.appendChild(sep);
          return;
        }
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("role", "menuitem");
        b.textContent = label;
        b.addEventListener("click", function () {
          hideJump();
          if (typeof run === "function") run();
        });
        jumpEl.appendChild(b);
      };
      addItem(COPY.jumpFocus, function () { openWin(id); });
      addItem(COPY.jumpMin, function () { minWin(id); });
      addItem(COPY.jumpClose, function () {
        closeWin(id);
        pushToast(COPY.toastClosed);
      });
      if (id === "overview") {
        addItem(COPY.jumpChapters, null, { sep: true });
        var items = chapterTrail.slice(0, 5);
        if (!items.length) {
          var empty = document.createElement("button");
          empty.type = "button";
          empty.disabled = true;
          empty.className = "is-muted";
          empty.textContent = COPY.jumpEmpty;
          jumpEl.appendChild(empty);
        } else {
          items.forEach(function (item) {
            addItem(item.label, function () {
              openWin("overview");
              setOverviewStem(item.stem, item.label);
            });
          });
        }
      }
      jumpEl.hidden = false;
      placeFloatMenu(jumpEl, x, y);
    }

    function showCtx(x, y) {
      if (!ctxMenu || !stage) return;
      hideJump();
      setStartOpen(false);
      setSwitcherOpen(false);
      setTasksOpen(false);
      ctxMenu.hidden = false;
      placeFloatMenu(ctxMenu, x, y);
    }

    function cycleWindows(dir) {
      dir = dir === -1 ? -1 : 1;
      var open = [];
      wins().forEach(function (w) {
        if (w.classList.contains("is-open") && !w.hidden) open.push(w);
      });
      if (open.length < 1) return;
      if (cycleIdx < 0 || cycleIdx >= open.length) {
        var fid = focusedWinId();
        cycleIdx = 0;
        open.forEach(function (w, i) {
          if ((w.getAttribute("data-win") || "") === fid) cycleIdx = i;
        });
      }
      if (open.length === 1) {
        focusWin(open[0].getAttribute("data-win") || "", { pulse: true });
        renderSwitcher(open[0].getAttribute("data-win") || "");
        return;
      }
      cycleIdx = (cycleIdx + dir + open.length) % open.length;
      var id = open[cycleIdx].getAttribute("data-win") || "";
      focusWin(id, { pulse: true });
      renderSwitcher(id);
    }

    function filterStartApps(q) {
      q = (q || "").trim().toLowerCase();
      qsa(".ly-start-apps button", root).forEach(function (btn) {
        var hay = (btn.textContent || "").toLowerCase();
        btn.hidden = !!(q && hay.indexOf(q) === -1);
      });
      qsa(".ly-start-recent-list button", root).forEach(function (btn) {
        var hay = (btn.textContent || "").toLowerCase();
        btn.hidden = !!(q && hay.indexOf(q) === -1);
      });
    }

    function dismissOverlays() {
      var closed = false;
      if (snapLayouts && !snapLayouts.hidden) {
        hideSnapLayouts();
        closed = true;
      }
      if (notifPanel && !notifPanel.hidden) {
        setNotifOpen(false);
        closed = true;
      }
      if (paletteEl && !paletteEl.hidden) {
        setPaletteOpen(false);
        closed = true;
      }
      if (switcherEl && !switcherEl.hidden) {
        setSwitcherOpen(false);
        closed = true;
      }
      if (tasksPanel && !tasksPanel.hidden) {
        setTasksOpen(false);
        closed = true;
      }
      if (keysPanel && !keysPanel.hidden) {
        setKeysOpen(false);
        closed = true;
      }
      if (startMenu && !startMenu.hidden) {
        setStartOpen(false);
        closed = true;
      }
      if (qsPanel && !qsPanel.hidden) {
        setQsOpen(false);
        closed = true;
      }
      if (ctxMenu && !ctxMenu.hidden) {
        hideCtx();
        closed = true;
      }
      if (jumpEl && !jumpEl.hidden) {
        hideJump();
        closed = true;
      }
      if (historyEl && !historyEl.hidden) {
        hideHistory();
        closed = true;
      }
      return closed;
    }

    function ovLinks() {
      return qsa(".ly-ov-link:not([hidden])", root);
    }

    function currentOvIndex() {
      var links = ovLinks();
      var i = 0;
      for (; i < links.length; i += 1) {
        if (links[i].classList.contains("is-on")) return i;
      }
      return -1;
    }

    function stepOverview(delta) {
      var links = ovLinks();
      if (!links.length) return;
      var idx = currentOvIndex();
      if (idx < 0) idx = 0;
      else idx = (idx + delta + links.length) % links.length;
      var btn = links[idx];
      openWin("overview");
      setOverviewStem(
        btn.getAttribute("data-ov-stem") || "",
        (btn.textContent || "").trim()
      );
    }

    function stepOverviewUnread(delta) {
      var links = qsa(".ly-ov-link", root);
      if (!links.length) return;
      var start = 0;
      var i = 0;
      for (; i < links.length; i += 1) {
        var stemI = links[i].getAttribute("data-ov-stem") || "";
        if ((currentOvStem && stemI === currentOvStem) || links[i].classList.contains("is-on")) {
          start = i;
          break;
        }
      }
      var dir = delta < 0 ? -1 : 1;
      var n = 1;
      for (; n <= links.length; n += 1) {
        var idx = (start + dir * n + links.length * 8) % links.length;
        var link = links[idx];
        var stem = link.getAttribute("data-ov-stem") || "";
        if (stem && !visitedChapters[stem]) {
          openWin("overview");
          setOverviewStem(stem, (link.textContent || "").trim());
          return;
        }
      }
      pushToast(COPY.toastNoUnread);
    }

    function overviewParts() {
      return qsa(".ly-ov-part:not([hidden])", root);
    }

    function currentPartIndex() {
      var parts = overviewParts();
      var link = currentOvStem
        ? qs('.ly-ov-link[data-ov-stem="' + currentOvStem + '"]', root)
        : qs(".ly-ov-link.is-on", root);
      if (!link) return -1;
      var part = link.closest ? link.closest(".ly-ov-part") : null;
      if (!part) {
        var p = link.parentNode;
        while (p && p !== root) {
          if (p.classList && p.classList.contains("ly-ov-part")) {
            part = p;
            break;
          }
          p = p.parentNode;
        }
      }
      var i = 0;
      for (; i < parts.length; i += 1) {
        if (parts[i] === part) return i;
      }
      return -1;
    }

    function stepOverviewPart(delta) {
      var parts = overviewParts();
      if (!parts.length) return;
      var idx = currentPartIndex();
      if (idx < 0) idx = 0;
      else idx = (idx + delta + parts.length) % parts.length;
      var first = qs(".ly-ov-link:not([hidden])", parts[idx]);
      if (!first) return;
      openWin("overview");
      setOverviewStem(
        first.getAttribute("data-ov-stem") || "",
        (first.textContent || "").trim()
      );
    }

    function persistReading() {
      try {
        window.sessionStorage.setItem(VISIT_KEY, JSON.stringify(visitedChapters));
        window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify(chapterTrail.slice(0, 6)));
        if (currentOvStem) {
          window.sessionStorage.setItem(STEM_KEY, currentOvStem);
        }
      } catch (_err) {
        /* ignore */
      }
    }

    function syncPartDone() {
      qsa(".ly-ov-part", root).forEach(function (part) {
        var links = part.querySelectorAll(".ly-ov-link");
        var all = links.length > 0;
        Array.prototype.forEach.call(links, function (a) {
          var stem = a.getAttribute("data-ov-stem") || "";
          if (!stem || !visitedChapters[stem]) all = false;
        });
        part.classList.toggle("is-done", all);
      });
    }

    function ensureResizeHandles(win) {
      if (qs(".ly-win-resize", win)) return;
      ["n", "e", "s", "w", "ne", "nw", "se", "sw"].forEach(function (dir) {
        var h = document.createElement("div");
        h.className = "ly-win-resize ly-win-resize--" + dir;
        h.setAttribute("data-resize", dir);
        win.appendChild(h);
      });
    }

    function persistStars() {
      try {
        window.sessionStorage.setItem(STAR_KEY, JSON.stringify(starredChapters));
      } catch (_err) {
        /* ignore */
      }
    }

    function toggleStar(stem) {
      if (!stem) return;
      var wasOn = starredChapters.indexOf(stem) !== -1;
      if (wasOn) {
        starredChapters = starredChapters.filter(function (x) { return x !== stem; });
      } else {
        starredChapters = [stem].concat(starredChapters).slice(0, 16);
      }
      persistStars();
      syncStars();
      return !wasOn;
    }

    function syncStarCur() {
      var curBtn = qs("[data-ly-ov-star-cur]", root);
      if (curBtn) {
        var on = !!(currentOvStem && starredChapters.indexOf(currentOvStem) !== -1);
        curBtn.classList.toggle("is-on", on);
        curBtn.textContent = on ? "★" : "☆";
        curBtn.title = on ? COPY.starOff : COPY.starOn;
        curBtn.setAttribute("aria-pressed", on ? "true" : "false");
        curBtn.disabled = !currentOvStem;
      }
      var copyEl = qs("[data-ly-ov-copy]", root);
      if (copyEl) copyEl.disabled = !currentOvStem;
    }

    function pushChapterTrail(stem, label) {
      if (!stem) return;
      chapterTrail = chapterTrail.filter(function (x) { return x.stem !== stem; });
      chapterTrail.unshift({ stem: stem, label: label || stem });
      chapterTrail = chapterTrail.slice(0, 6);
      renderRecentStrip();
    }

    function renderRecentStrip() {
      var el = qs("[data-ly-ov-recent]", root);
      if (!el) return;
      el.innerHTML = "";
      if (chapterTrail.length < 2) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      var label = document.createElement("span");
      label.className = "ly-ov-recent-label";
      label.textContent = COPY.recentLabel;
      el.appendChild(label);
      chapterTrail.forEach(function (item) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "ly-ov-recent-chip";
        if (item.stem === currentOvStem) b.classList.add("is-on");
        b.textContent = item.label;
        b.title = item.label;
        b.addEventListener("click", function () {
          openWin("overview");
          setOverviewStem(item.stem, item.label);
        });
        el.appendChild(b);
      });
    }

    function copyChapterLink() {
      if (!currentOvStem) return;
      var href = "";
      try {
        href = new URL("book.html#" + currentOvStem, window.location.href).href;
      } catch (_err) {
        href = "book.html#" + currentOvStem;
      }
      var done = function (ok) {
        pushToast(ok ? COPY.toastCopied : COPY.toastCopyFail);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(href).then(function () { done(true); }, function () { done(false); });
        return;
      }
      try {
        var ta = document.createElement("textarea");
        ta.value = href;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        done(!!ok);
      } catch (_err2) {
        done(false);
      }
    }

    function setRailCollapsed(on) {
      var ov = qs("[data-ly-overview]", root);
      var railToggle = qs("[data-ly-ov-rail-toggle]", root);
      if (!ov) return;
      ov.classList.toggle("is-rail-collapsed", !!on);
      if (railToggle) {
        railToggle.setAttribute("aria-pressed", on ? "true" : "false");
        railToggle.title = on ? COPY.railShow : COPY.railHide;
      }
      try {
        window.sessionStorage.setItem(RAIL_KEY, on ? "1" : "0");
      } catch (_err) {
        /* ignore */
      }
    }

    function syncStars() {
      qsa("[data-ov-star]", root).forEach(function (btn) {
        var stem = btn.getAttribute("data-ov-star") || "";
        var on = starredChapters.indexOf(stem) !== -1;
        btn.classList.toggle("is-on", on);
        btn.textContent = on ? "★" : "☆";
        btn.title = on ? COPY.starOff : COPY.starOn;
        btn.setAttribute("aria-label", on ? COPY.starOff : COPY.starOn);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
      qsa(".ly-ov-link", root).forEach(function (link) {
        var stem = link.getAttribute("data-ov-stem") || "";
        link.classList.toggle("is-starred", starredChapters.indexOf(stem) !== -1);
        link.classList.toggle("is-visited", !!visitedChapters[stem]);
      });
      syncStarCur();
      syncSessionChip();
      if (starFilterOn) filterRail();
    }

    function enhanceOvLinks() {
      qsa(".ly-ov-link", root).forEach(function (link) {
        if (link.parentNode && link.parentNode.classList.contains("ly-ov-row")) return;
        var stem = link.getAttribute("data-ov-stem") || "";
        var row = document.createElement("div");
        row.className = "ly-ov-row";
        link.parentNode.insertBefore(row, link);
        var star = document.createElement("button");
        star.type = "button";
        star.className = "ly-ov-star";
        star.setAttribute("data-ov-star", stem);
        star.textContent = "☆";
        star.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          toggleStar(stem);
        });
        row.appendChild(star);
        row.appendChild(link);
      });
      syncStars();
    }

    function ensurePinButton(win) {
      var actions = qs(".ly-win-actions", win);
      if (!actions || qs("[data-win-pin]", win)) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-win-pin", "");
      btn.setAttribute("aria-pressed", "false");
      btn.title = COPY.pinLabel;
      btn.setAttribute("aria-label", COPY.pinLabel);
      btn.textContent = "⌖";
      actions.insertBefore(btn, actions.firstChild);
    }

    function setOverviewStem(stem, label, opts) {
      if (!stem) return;
      opts = opts || {};
      var prevStem = currentOvStem;
      currentOvStem = stem;
      var href = "book.html?embed=1#" + stem;
      if (frame) {
        var applyNav = function () {
          try {
            var cur = frame.getAttribute("src") || "";
            if (cur.indexOf("book.html") === 0 && frame.contentWindow) {
              frame.contentWindow.location.replace(href);
            } else {
              frame.setAttribute("src", href);
            }
          } catch (_err) {
            frame.setAttribute("src", href);
          }
          frame.classList.remove("is-fade");
        };
        if (prevStem && prevStem !== stem && !opts.skipFade) {
          var reduceMotion =
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (reduceMotion) {
            applyNav();
          } else {
            frame.classList.add("is-fade");
            if (frameFadeTimer) window.clearTimeout(frameFadeTimer);
            frameFadeTimer = window.setTimeout(applyNav, 120);
          }
        } else {
          applyNav();
        }
      }
      if (ovLabel) ovLabel.textContent = COPY.ovPrefix + (label || stem);
      if (ovOpen) ovOpen.setAttribute("href", "book.html#" + stem);
      qsa(".ly-ov-link", root).forEach(function (b) {
        b.classList.toggle("is-on", b.getAttribute("data-ov-stem") === stem);
      });
      var onLink = qs(".ly-ov-link.is-on", root);
      var partEl = null;
      if (onLink) {
        partEl = onLink.closest ? onLink.closest(".ly-ov-part") : null;
        if (!partEl) {
          var pp = onLink.parentNode;
          while (pp && pp !== root) {
            if (pp.classList && pp.classList.contains("ly-ov-part")) {
              partEl = pp;
              break;
            }
            pp = pp.parentNode;
          }
        }
      }
      var partDoneBefore = !!(partEl && partEl.classList.contains("is-done"));
      var wasVisited = !!visitedChapters[stem];
      visitedChapters[stem] = true;
      pushChapterTrail(stem, label || stem);
      persistReading();
      syncOvProgress();
      syncStars();
      syncPartDone();
      if (onLink && typeof onLink.scrollIntoView === "function") {
        try {
          onLink.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (_err2) {
          /* ignore */
        }
      }
      if (!wasVisited && partEl && !partDoneBefore && partEl.classList.contains("is-done")) {
        pushToast(COPY.toastPartDone);
      }
      syncOverviewChromeTitle(label || stem);
      filterRail();
    }

    function filterRail() {
      var ovSearch = qs("[data-ly-ov-search]", root);
      var q = ovSearch ? (ovSearch.value || "").trim().toLowerCase() : "";
      qsa(".ly-ov-part", root).forEach(function (part) {
        var links = part.querySelectorAll(".ly-ov-link");
        var any = false;
        Array.prototype.forEach.call(links, function (a) {
          var stem = a.getAttribute("data-ov-stem") || "";
          var hay =
            ((a.textContent || "") + " " + stem).toLowerCase();
          var matchQ = !q || hay.indexOf(q) !== -1;
          var matchStar = !starFilterOn || starredChapters.indexOf(stem) !== -1;
          var show = matchQ && matchStar;
          a.hidden = !show;
          if (a.parentNode && a.parentNode.classList.contains("ly-ov-row")) {
            a.parentNode.hidden = !show;
          }
          if (show) any = true;
        });
        part.hidden = !any;
      });
    }

    function setStarFilter(on) {
      starFilterOn = !!on;
      var btn = qs("[data-ly-ov-star-filter]", root);
      if (btn) {
        btn.classList.toggle("is-on", starFilterOn);
        btn.setAttribute("aria-pressed", starFilterOn ? "true" : "false");
        btn.title = starFilterOn ? COPY.starFilterOn : COPY.starFilterOff;
      }
      filterRail();
    }

    function syncPartDots() {
      var wrap = qs("[data-ly-ov-parts]", root);
      if (!wrap) return;
      wrap.innerHTML = "";
      var parts = qsa(".ly-ov-part", root);
      if (!parts.length) {
        wrap.hidden = true;
        return;
      }
      wrap.hidden = false;
      wrap.setAttribute("aria-label", COPY.partsProgress);
      var curIdx = currentPartIndex();
      parts.forEach(function (part, idx) {
        var links = part.querySelectorAll(".ly-ov-link");
        var total = links.length;
        var seen = 0;
        Array.prototype.forEach.call(links, function (a) {
          var stem = a.getAttribute("data-ov-stem") || "";
          if (stem && visitedChapters[stem]) seen += 1;
        });
        var titleEl = qs(".ly-ov-part-title", part);
        var title = titleEl ? (titleEl.textContent || "").trim() : String(idx + 1);
        var b = document.createElement("button");
        b.type = "button";
        b.className = "ly-ov-part-dot";
        if (part.classList.contains("is-done")) b.classList.add("is-done");
        if (idx === curIdx) b.classList.add("is-on");
        var pct = total ? Math.round((seen / total) * 100) : 0;
        b.title = title + " · " + seen + "/" + total;
        b.setAttribute("aria-label", b.title);
        b.innerHTML = "<i style=\"--p:" + pct + "%\"></i>";
        b.addEventListener("click", function () {
          var first = qs(".ly-ov-link:not([hidden])", part) || qs(".ly-ov-link", part);
          if (!first) return;
          openWin("overview");
          setOverviewStem(
            first.getAttribute("data-ov-stem") || "",
            (first.textContent || "").trim()
          );
        });
        wrap.appendChild(b);
      });
    }

    function syncOvProgress() {
      var el = qs("[data-ly-ov-progress]", root);
      var total = qsa(".ly-ov-link", root).length;
      var seen = 0;
      Object.keys(visitedChapters).forEach(function (k) {
        if (k) seen += 1;
      });
      if (el) {
        el.textContent = seen + "/" + total;
        el.title = COPY.historyHint;
      }
      var bar = qs("[data-ly-ov-bar]", root);
      if (bar) {
        var pct = total ? Math.min(100, Math.round((seen / total) * 100)) : 0;
        bar.style.width = pct + "%";
      }
      syncOvCrumb();
      syncOvEta();
      syncSessionChip();
      syncPartDone();
      syncPartDots();
      if (total > 0 && seen >= total) {
        if (!completionFired && sessionStartedAt) {
          celebrateCompletion();
        }
        completionFired = true;
      }
    }

    function syncOvCrumb() {
      var crumb = qs("[data-ly-ov-crumb]", root);
      if (!crumb) return;
      if (!currentOvStem) {
        crumb.textContent = COPY.crumbCover;
        return;
      }
      var link = qs('.ly-ov-link[data-ov-stem="' + currentOvStem + '"]', root);
      var partTitle = "";
      if (link) {
        var part = link.closest ? link.closest(".ly-ov-part") : null;
        if (!part) {
          var p = link.parentNode;
          while (p && p !== root) {
            if (p.classList && p.classList.contains("ly-ov-part")) {
              part = p;
              break;
            }
            p = p.parentNode;
          }
        }
        if (part) {
          var t = qs(".ly-ov-part-title", part);
          if (t) partTitle = (t.textContent || "").trim();
        }
      }
      var chapter = link ? (link.textContent || "").trim() : currentOvStem;
      crumb.textContent = partTitle ? partTitle + " · " + chapter : chapter;
    }

    function syncOvEta() {
      var el = qs("[data-ly-ov-eta]", root);
      if (!el) return;
      var total = qsa(".ly-ov-link", root).length;
      var seen = 0;
      Object.keys(visitedChapters).forEach(function (k) {
        if (k) seen += 1;
      });
      var left = Math.max(0, total - seen);
      if (!total) {
        el.textContent = "";
        return;
      }
      if (left === 0) {
        el.textContent = COPY.etaDone;
        el.classList.add("is-done");
      } else {
        el.textContent = COPY.etaLeft.replace("{n}", String(left * 2));
        el.classList.remove("is-done");
      }
    }

    function syncSessionChip() {
      var el = qs(".ly-session", root);
      if (!el) return;
      var seen = 0;
      Object.keys(visitedChapters).forEach(function (k) {
        if (k) seen += 1;
      });
      var stars = starredChapters.length;
      el.textContent = isEn
        ? "Session · " + seen + " ch · " + stars + "★"
        : "Сессия · " + seen + " гл · " + stars + "★";
      el.title = COPY.sessionSummary
        .replace("{m}", sessionStartedAt ? String(Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 60000))) : "0")
        .replace("{c}", String(seen))
        .replace("{s}", String(stars));
    }

    function clearRisk() {
      if (riskPanel) riskPanel.classList.remove("is-on");
      qsa(".ly-photo, .ly-chat, .ly-toast, .ly-file", root).forEach(function (t) {
        t.setAttribute("aria-pressed", "false");
      });
    }

    function setDome(on) {
      var wasDome = root.classList.contains("is-dome");
      root.classList.toggle("is-dome", on);
      if (chaosBtn) chaosBtn.setAttribute("aria-pressed", on ? "false" : "true");
      if (domeBtn) domeBtn.setAttribute("aria-pressed", on ? "true" : "false");
      if (chaosLayer) chaosLayer.setAttribute("aria-hidden", on ? "true" : "false");
      if (domeLayer) domeLayer.setAttribute("aria-hidden", on ? "false" : "true");
      if (toggle) {
        toggle.textContent = on ? COPY.toggleOn : COPY.toggleOff;
      }
      if (badge) {
        badge.textContent = on ? COPY.badgeOn : COPY.badgeOff;
        badge.classList.toggle("is-safe", on);
      }
      clearRisk();
      setStartOpen(false);
      setQsOpen(false);
      setKeysOpen(false);
      setSwitcherOpen(false);
      setTasksOpen(false);
      setPaletteOpen(false);
      setNotifOpen(false);
      hideSnapLayouts();
      hideJump();
      hideHistory();
      deskHiddenIds = [];
      syncShowDeskBtn();
      if (on) {
        if (!wasDome) {
          sessionStartedAt = Date.now();
          showBootSplash();
          window.setTimeout(function () {
            pushToast(COPY.notifTip);
            rememberNotif(COPY.notifContour);
          }, 1200);
        }
        openWin("overview");
        var resumeStem = currentOvStem;
        var resumeLabel = "";
        if (resumeStem) {
          var resumeLink = qs('.ly-ov-link[data-ov-stem="' + resumeStem + '"]', root);
          if (resumeLink) {
            resumeLabel = (resumeLink.textContent || "").trim();
            setOverviewStem(resumeStem, resumeLabel, { skipFade: true });
            if (!wasDome) {
              window.setTimeout(function () {
                pushToast(COPY.toastResume.replace("{title}", resumeLabel || resumeStem));
              }, 1500);
            }
          } else {
            pushToast(COPY.toastOn);
          }
        } else {
          pushToast(COPY.toastOn);
        }
        var depth = nestDepth();
        if (!wasDome && depth >= 1) {
          runNestSalute(depth, COPY);
        }
      } else if (wasDome) {
        var mins = sessionStartedAt
          ? Math.max(1, Math.floor((Date.now() - sessionStartedAt) / 60000))
          : 0;
        var ch = 0;
        Object.keys(visitedChapters).forEach(function (k) {
          if (k) ch += 1;
        });
        pushToast(
          COPY.sessionSummary
            .replace("{m}", String(mins))
            .replace("{c}", String(ch))
            .replace("{s}", String(starredChapters.length))
        );
        sessionStartedAt = 0;
      }
    }

    if (chaosBtn) chaosBtn.addEventListener("click", function () { setDome(false); });
    if (domeBtn) domeBtn.addEventListener("click", function () { setDome(true); });
    if (toggle) {
      toggle.addEventListener("click", function () {
        setDome(!root.classList.contains("is-dome"));
      });
    }

    qsa(".ly-photo, .ly-chat, .ly-toast, .ly-file", root).forEach(function (tile) {
      tile.addEventListener("click", function () {
        if (root.classList.contains("is-dome")) return;
        var selected = tile.getAttribute("aria-pressed") === "true";
        clearRisk();
        if (!selected) {
          tile.setAttribute("aria-pressed", "true");
          if (riskText) {
            riskText.textContent =
              tile.getAttribute("data-risk") || COPY.riskFallback;
          }
          if (riskPanel) riskPanel.classList.add("is-on");
        }
      });
    });

    qsa("[data-open-win]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!root.classList.contains("is-dome")) return;
        openWin(btn.getAttribute("data-open-win") || "overview");
      });
    });

    wins().forEach(function (win) {
      var id = win.getAttribute("data-win") || "";
      if (win.classList.contains("is-open")) win.setAttribute("data-placed", "1");
      ensureResizeHandles(win);
      ensurePinButton(win);
      var bar = qs("[data-win-drag]", win);
      var minBtn = qs("[data-win-min]", win);
      var maxBtn = qs("[data-win-max]", win);
      var closeBtn = qs("[data-win-close]", win);
      var pinBtn = qs("[data-win-pin]", win);
      if (minBtn) {
        minBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          minWin(id);
        });
      }
      if (maxBtn) {
        maxBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          hideSnapLayouts();
          maxWin(id);
        });
        var layoutTimer = null;
        maxBtn.addEventListener("mouseenter", function () {
          if (!root.classList.contains("is-dome")) return;
          window.clearTimeout(layoutTimer);
          layoutTimer = window.setTimeout(function () {
            showSnapLayouts(win);
          }, 220);
        });
        maxBtn.addEventListener("mouseleave", function () {
          window.clearTimeout(layoutTimer);
          layoutTimer = window.setTimeout(function () {
            if (snapLayouts && snapLayouts.matches(":hover")) return;
            hideSnapLayouts();
          }, 280);
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          closeWin(id);
        });
      }
      if (pinBtn) {
        pinBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          togglePin(id);
        });
      }
      win.addEventListener("mousedown", function () {
        if (win.classList.contains("is-open")) focusWin(id);
      });
      if (bar && stage) {
        var drag = null;
        var lastTap = 0;
        var snapSide = null;
        var shake = { lastX: 0, dir: 0, flips: 0, armed: false };
        bar.addEventListener("dblclick", function (ev) {
          if (ev.target.closest("button")) return;
          maxWin(id);
        });
        bar.addEventListener("pointerdown", function (ev) {
          if (ev.button !== 0) return;
          if (ev.target.closest("button")) return;
          focusWin(id);
          hideCtx();
          if (win.classList.contains("is-max")) return;
          var now = Date.now();
          if (now - lastTap < 280) {
            lastTap = 0;
            maxWin(id);
            return;
          }
          lastTap = now;
          var rect = win.getBoundingClientRect();
          var stageRect = stage.getBoundingClientRect();
          drag = {
            pointerId: ev.pointerId,
            ox: ev.clientX,
            oy: ev.clientY,
            left: rect.left - stageRect.left,
            top: rect.top - stageRect.top,
            w: rect.width,
            h: rect.height,
            sw: stageRect.width,
            sh: stageRect.height,
          };
          snapSide = null;
          shake = { lastX: ev.clientX, dir: 0, flips: 0, armed: false };
          bar.setPointerCapture(ev.pointerId);
          win.classList.add("is-dragging");
          if (stage) stage.classList.add("is-drag-scrim");
          hideSnapLayouts();
        });
        bar.addEventListener("pointermove", function (ev) {
          if (!drag || drag.pointerId !== ev.pointerId) return;
          var nx = drag.left + (ev.clientX - drag.ox);
          var ny = drag.top + (ev.clientY - drag.oy);
          var maxX = Math.max(0, drag.sw - drag.w);
          var maxY = Math.max(0, drag.sh - drag.h - 8);
          nx = Math.min(maxX, Math.max(0, nx));
          ny = Math.min(maxY, Math.max(0, ny));
          win.style.left = (nx / drag.sw) * 100 + "%";
          win.style.top = (ny / drag.sh) * 100 + "%";
          win.style.width = (drag.w / drag.sw) * 100 + "%";
          win.style.height = (drag.h / drag.sh) * 100 + "%";
          var dx = ev.clientX - shake.lastX;
          if (Math.abs(dx) > 14) {
            var dir = dx > 0 ? 1 : -1;
            if (shake.dir && dir !== shake.dir) shake.flips += 1;
            shake.dir = dir;
            shake.lastX = ev.clientX;
            if (shake.flips >= 4 && !shake.armed) {
              shake.armed = true;
              shakeMinimizeOthers(id);
            }
          }
          var edge = 28;
          var corner = 56;
          var stageBox = stage.getBoundingClientRect();
          var nearLeft = ev.clientX <= stageBox.left + edge;
          var nearRight = ev.clientX >= stageBox.right - edge;
          var nearTop = ev.clientY <= stageBox.top + edge;
          var nearBottom = ev.clientY >= stageBox.bottom - edge;
          snapSide = null;
          if (nearLeft && nearTop && ev.clientY <= stageBox.top + corner) snapSide = "tl";
          else if (nearRight && nearTop && ev.clientY <= stageBox.top + corner) snapSide = "tr";
          else if (nearLeft && nearBottom && ev.clientY >= stageBox.bottom - corner) snapSide = "bl";
          else if (nearRight && nearBottom && ev.clientY >= stageBox.bottom - corner) snapSide = "br";
          else if (nearLeft) snapSide = "left";
          else if (nearRight) snapSide = "right";
          else if (nearTop) snapSide = "up";
          setSnap(snapSide);
        });
        function endDrag(ev) {
          if (!drag || drag.pointerId !== ev.pointerId) return;
          drag = null;
          win.classList.remove("is-dragging");
          if (stage) stage.classList.remove("is-drag-scrim");
          if (snapSide) applySnap(win, snapSide);
          snapSide = null;
          setSnap(null);
          persistGeometry();
        }
        bar.addEventListener("pointerup", endDrag);
        bar.addEventListener("pointercancel", endDrag);
      }
      qsa("[data-resize]", win).forEach(function (handle) {
        var resize = null;
        handle.addEventListener("pointerdown", function (ev) {
          if (ev.button !== 0) return;
          if (win.classList.contains("is-max")) return;
          ev.stopPropagation();
          focusWin(id);
          var rect = win.getBoundingClientRect();
          var stageRect = stage.getBoundingClientRect();
          resize = {
            pointerId: ev.pointerId,
            dir: handle.getAttribute("data-resize") || "se",
            ox: ev.clientX,
            oy: ev.clientY,
            left: rect.left - stageRect.left,
            top: rect.top - stageRect.top,
            w: rect.width,
            h: rect.height,
            sw: stageRect.width,
            sh: stageRect.height,
          };
          handle.setPointerCapture(ev.pointerId);
          win.classList.add("is-resizing");
        });
        handle.addEventListener("pointermove", function (ev) {
          if (!resize || resize.pointerId !== ev.pointerId) return;
          var dx = ev.clientX - resize.ox;
          var dy = ev.clientY - resize.oy;
          var left = resize.left;
          var top = resize.top;
          var w = resize.w;
          var h = resize.h;
          if (resize.dir.indexOf("e") !== -1) w = resize.w + dx;
          if (resize.dir.indexOf("s") !== -1) h = resize.h + dy;
          if (resize.dir.indexOf("w") !== -1) {
            w = resize.w - dx;
            left = resize.left + dx;
          }
          if (resize.dir.indexOf("n") !== -1) {
            h = resize.h - dy;
            top = resize.top + dy;
          }
          if (w < 200) {
            if (resize.dir.indexOf("w") !== -1) left = resize.left + resize.w - 200;
            w = 200;
          }
          if (h < 140) {
            if (resize.dir.indexOf("n") !== -1) top = resize.top + resize.h - 140;
            h = 140;
          }
          if (left < 0) {
            w += left;
            left = 0;
          }
          if (top < 0) {
            h += top;
            top = 0;
          }
          if (left + w > resize.sw - 8) w = resize.sw - 8 - left;
          if (top + h > resize.sh - 8) h = resize.sh - 8 - top;
          w = Math.max(200, w);
          h = Math.max(140, h);
          win.style.left = (left / resize.sw) * 100 + "%";
          win.style.top = (top / resize.sh) * 100 + "%";
          win.style.width = (w / resize.sw) * 100 + "%";
          win.style.height = (h / resize.sh) * 100 + "%";
          win.setAttribute("data-placed", "1");
        });
        function endResize(ev) {
          if (!resize || resize.pointerId !== ev.pointerId) return;
          resize = null;
          win.classList.remove("is-resizing");
          persistGeometry();
        }
        handle.addEventListener("pointerup", endResize);
        handle.addEventListener("pointercancel", endResize);
      });
    });

    if (startToggle) {
      startToggle.addEventListener("click", function () {
        if (!root.classList.contains("is-dome")) return;
        hideCtx();
        setQsOpen(false);
        setStartOpen(!!startMenu && startMenu.hidden);
      });
    }
    var startSearch = qs("[data-ly-start-search]", root);
    if (startSearch) {
      startSearch.addEventListener("input", function () {
        filterStartApps(startSearch.value);
      });
      startSearch.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter") return;
        var first = qs(".ly-start-apps button:not([hidden])", root);
        if (!first) return;
        ev.preventDefault();
        openWin(first.getAttribute("data-open-win") || "overview");
      });
    }
    var showDeskBtn = qs("[data-ly-show-desk]", root);
    if (showDeskBtn) {
      showDeskBtn.addEventListener("click", function () {
        if (!root.classList.contains("is-dome")) return;
        showDesktop();
      });
    }
    qsa("[data-ly-qs-toggle]", root).forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        if (!root.classList.contains("is-dome")) return;
        ev.stopPropagation();
        setQsOpen(!!qsPanel && qsPanel.hidden);
      });
    });
    if (qsPanel) {
      qsa("[data-qs]", qsPanel).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var act = btn.getAttribute("data-qs");
          setQsOpen(false);
          if (act === "overview") openWin("overview");
          else if (act === "arrange") arrangeWindows();
          else if (act === "layout") resetWindowLayout();
          else if (act === "read") setReadMode(!readMode);
          else if (act === "replay") replayOverview();
          else if (act === "desktop") showDesktop();
          else if (act === "wallpaper") refreshWallpaper();
          else if (act === "tasks") setTasksOpen(true);
          else if (act === "keys") setKeysOpen(true);
        });
      });
    }
    qsa("[data-theme]", root).forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        setGlowTheme(btn.getAttribute("data-theme") || "cyan", { toast: true });
        refreshWallpaper(true);
      });
    });
    qsa("[data-ly-keys-open]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!root.classList.contains("is-dome")) return;
        setKeysOpen(true);
      });
    });
    qsa("[data-ly-keys-close]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        setKeysOpen(false);
      });
    });
    qsa("[data-ly-tasks-close]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTasksOpen(false);
      });
    });
    qsa("[data-ly-power]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var act = btn.getAttribute("data-ly-power");
        setStartOpen(false);
        if (act === "palette") setPaletteOpen(true);
        else if (act === "tasks") setTasksOpen(true);
        else if (act === "focus") setFocusMode(true);
        else if (act === "exit") setDome(false);
      });
    });
    var paletteInput = qs("[data-ly-palette-input]", root);
    if (paletteInput) {
      paletteInput.addEventListener("input", function () {
        renderPalette(paletteInput.value);
      });
    }
    if (snapLayouts) {
      snapLayouts.addEventListener("mouseleave", function () {
        hideSnapLayouts();
      });
      qsa("[data-layout]", snapLayouts).forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          applyLayout(layoutTargetId || focusedWinId(), btn.getAttribute("data-layout") || "full");
        });
      });
    }
    var notifToggle = qs("[data-ly-notif-toggle]", root);
    if (notifToggle) {
      notifToggle.addEventListener("click", function (ev) {
        if (!root.classList.contains("is-dome")) return;
        ev.stopPropagation();
        setNotifOpen(!!notifPanel && notifPanel.hidden);
      });
    }
    qsa("[data-ly-notif-close]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        setNotifOpen(false);
      });
    });
    qsa("[data-ly-notif-clear]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        notifItems = [];
        unreadNotifs = 0;
        syncNotifBadge();
        renderNotifs();
      });
    });
    if (stage) {
      stage.addEventListener("click", function (ev) {
        hideCtx();
        if (jumpEl && !jumpEl.hidden) {
          if (!ev.target.closest("[data-ly-jump], [data-task]")) hideJump();
        }
        if (historyEl && !historyEl.hidden) {
          if (!ev.target.closest("[data-ly-history], [data-ly-ov-progress]")) hideHistory();
        }
        if (snapLayouts && !snapLayouts.hidden) {
          if (!ev.target.closest("[data-ly-snap-layouts], [data-win-max]")) hideSnapLayouts();
        }
        if (notifPanel && !notifPanel.hidden) {
          if (!ev.target.closest("[data-ly-notif], [data-ly-notif-toggle]")) setNotifOpen(false);
        }
        if (paletteEl && !paletteEl.hidden) {
          if (!ev.target.closest("[data-ly-palette]")) setPaletteOpen(false);
        }
        if (switcherEl && !switcherEl.hidden) {
          if (!ev.target.closest("[data-ly-switcher]")) setSwitcherOpen(false);
        }
        if (tasksPanel && !tasksPanel.hidden) {
          if (!ev.target.closest("[data-ly-tasks-panel]")) setTasksOpen(false);
        }
        if (keysPanel && !keysPanel.hidden) {
          if (!ev.target.closest("[data-ly-keys], [data-ly-keys-open]")) setKeysOpen(false);
        }
        if (qsPanel && !qsPanel.hidden) {
          if (!ev.target.closest("[data-ly-qs], [data-ly-qs-toggle]")) setQsOpen(false);
        }
        if (!startMenu || startMenu.hidden) return;
        if (ev.target.closest("[data-ly-start-menu], [data-ly-start-toggle]")) return;
        setStartOpen(false);
      });
      stage.addEventListener("dblclick", function (ev) {
        if (!root.classList.contains("is-dome")) return;
        if (ev.target.closest(".ly-win, .ly-desk-icon, .ly-start-menu, .ly-taskbar, .ly-qs, .ly-keys, .ly-tasks-panel, .ly-switcher, .ly-palette, .ly-notif, .ly-ctx, .ly-jump, .ly-history, .ly-boot, .ly-snap-layouts")) {
          return;
        }
        showDesktop();
      });
      stage.addEventListener("contextmenu", function (ev) {
        if (!root.classList.contains("is-dome")) return;
        if (ev.target.closest(".ly-win, .ly-start-menu, .ly-taskbar, .ly-qs, .ly-keys, .ly-tasks-panel, .ly-switcher, .ly-palette, .ly-notif, .ly-snap-layouts, .ly-jump, .ly-history")) return;
        ev.preventDefault();
        setQsOpen(false);
        setKeysOpen(false);
        setSwitcherOpen(false);
        setTasksOpen(false);
        setPaletteOpen(false);
        setNotifOpen(false);
        hideSnapLayouts();
        showCtx(ev.clientX, ev.clientY);
      });
    }
    if (ctxMenu) {
      qsa("[data-ctx]", ctxMenu).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var act = btn.getAttribute("data-ctx");
          hideCtx();
          if (act === "overview") openWin("overview");
          else if (act === "arrange") arrangeWindows();
          else if (act === "desktop") showDesktop();
          else if (act === "theme") cycleGlowTheme();
          else if (act === "palette") setPaletteOpen(true);
          else if (act === "tasks") setTasksOpen(true);
          else if (act === "keys") setKeysOpen(true);
        });
      });
    }
    enhanceOvLinks();
    qsa(".ly-ov-link", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!root.classList.contains("is-dome")) return;
        openWin("overview");
        setOverviewStem(
          btn.getAttribute("data-ov-stem") || "",
          (btn.textContent || "").trim()
        );
      });
    });

    var railToggle = qs("[data-ly-ov-rail-toggle]", root);
    if (railToggle) {
      railToggle.addEventListener("click", function () {
        var ov = qs("[data-ly-overview]", root);
        if (!ov) return;
        setRailCollapsed(!ov.classList.contains("is-rail-collapsed"));
      });
    }

    var homeBtn = qs("[data-ly-ov-home]", root);
    if (homeBtn && frame) {
      homeBtn.addEventListener("click", function () {
        if (!root.classList.contains("is-dome")) return;
        openWin("overview");
        currentOvStem = "";
        frame.setAttribute("src", "index.html");
        if (ovLabel) {
          ovLabel.textContent = isEn ? "Overview · cover (nested)" : "Обзор · обложка (вложение)";
        }
        if (ovOpen) ovOpen.setAttribute("href", "index.html");
        qsa(".ly-ov-link", root).forEach(function (b) {
          b.classList.remove("is-on");
        });
        syncStarCur();
        syncOvCrumb();
        renderRecentStrip();
      });
    }
    var ovPrev = qs("[data-ly-ov-prev]", root);
    var ovNext = qs("[data-ly-ov-next]", root);
    var ovPartPrev = qs("[data-ly-ov-part-prev]", root);
    var ovPartNext = qs("[data-ly-ov-part-next]", root);
    if (ovPrev) {
      ovPrev.addEventListener("click", function (ev) {
        if (!root.classList.contains("is-dome")) return;
        if (ev.shiftKey) stepOverviewUnread(-1);
        else stepOverview(-1);
      });
    }
    if (ovNext) {
      ovNext.addEventListener("click", function (ev) {
        if (!root.classList.contains("is-dome")) return;
        if (ev.shiftKey) stepOverviewUnread(1);
        else stepOverview(1);
      });
    }
    if (ovPartPrev) {
      ovPartPrev.addEventListener("click", function () {
        if (!root.classList.contains("is-dome")) return;
        stepOverviewPart(-1);
      });
    }
    if (ovPartNext) {
      ovPartNext.addEventListener("click", function () {
        if (!root.classList.contains("is-dome")) return;
        stepOverviewPart(1);
      });
    }

    var progressBtn = qs("[data-ly-ov-progress]", root);
    if (progressBtn) {
      var openHist = function (ev) {
        if (!root.classList.contains("is-dome")) return;
        ev.preventDefault();
        if (historyEl && !historyEl.hidden) hideHistory();
        else showHistoryNear(progressBtn);
      };
      progressBtn.addEventListener("click", openHist);
      progressBtn.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") openHist(ev);
      });
    }

    var starCurBtn = qs("[data-ly-ov-star-cur]", root);
    if (starCurBtn) {
      starCurBtn.addEventListener("click", function () {
        if (!root.classList.contains("is-dome") || !currentOvStem) return;
        var on = toggleStar(currentOvStem);
        pushToast(on ? COPY.toastStarred : COPY.toastUnstarred);
      });
    }
    var readBtn = qs("[data-ly-ov-read]", root);
    if (readBtn) {
      readBtn.addEventListener("click", function () {
        if (!root.classList.contains("is-dome")) return;
        setReadMode(!readMode);
      });
    }
    var copyBtn = qs("[data-ly-ov-copy]", root);
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        if (!root.classList.contains("is-dome") || !currentOvStem) return;
        copyChapterLink();
      });
    }

    if (clockEl) {
      var clockTime = qs("[data-ly-clock-time]", root) || clockEl;
      var clockDate = qs("[data-ly-clock-date]", root);
      var tickClock = function () {
        var d = new Date();
        var hh = d.getHours();
        var mm = d.getMinutes();
        var time =
          (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
        clockTime.textContent = time;
        if (clockDate) {
          var months = isEn
            ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            : ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
          clockDate.textContent = d.getDate() + " " + months[d.getMonth()];
        }
        clockEl.setAttribute(
          "title",
          time + (isEn ? " · quick settings" : " · быстрые настройки")
        );
      };
      tickClock();
      window.setInterval(tickClock, 30000);
    }

    var ovSearch = qs("[data-ly-ov-search]", root);
    if (ovSearch) {
      ovSearch.addEventListener("input", function () {
        filterRail();
      });
    }
    var starFilterBtn = qs("[data-ly-ov-star-filter]", root);
    if (starFilterBtn) {
      starFilterBtn.addEventListener("click", function () {
        setStarFilter(!starFilterOn);
      });
    }

    document.addEventListener(
      "keydown",
      function (ev) {
        if (!root.classList.contains("is-dome")) return;
        var inField =
          ev.target &&
          ev.target.closest &&
          ev.target.closest("input, textarea, [contenteditable]");

        if (ev.key === "Escape") {
          if (dismissOverlays()) {
            ev.preventDefault();
            return;
          }
          if (starFilterOn) {
            ev.preventDefault();
            setStarFilter(false);
            return;
          }
          if (document.body.classList.contains("is-ly-focus")) {
            ev.preventDefault();
            setFocusMode(false);
            return;
          }
          return;
        }

        if (ev.key === "F1") {
          ev.preventDefault();
          setKeysOpen(!!keysPanel && keysPanel.hidden);
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && (ev.key === "k" || ev.key === "K")) {
          ev.preventDefault();
          setPaletteOpen(!!paletteEl && paletteEl.hidden);
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === "t" || ev.key === "T")) {
          ev.preventDefault();
          restoreClosedWin();
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === "s" || ev.key === "S")) {
          if (!root.classList.contains("is-dome")) return;
          if (!currentOvStem) {
            var onLink = qs(".ly-ov-link.is-on", root);
            if (onLink) currentOvStem = onLink.getAttribute("data-ov-stem") || "";
          }
          if (!currentOvStem) return;
          ev.preventDefault();
          openWin("overview");
          var starred = toggleStar(currentOvStem);
          pushToast(starred ? COPY.toastStarred : COPY.toastUnstarred);
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && (ev.key === "f" || ev.key === "F") && !ev.shiftKey) {
          var searchEl = qs("[data-ly-ov-search]", root);
          if (!searchEl || !root.classList.contains("is-dome")) return;
          ev.preventDefault();
          openWin("overview");
          setRailCollapsed(false);
          window.setTimeout(function () {
            searchEl.focus();
            if (typeof searchEl.select === "function") searchEl.select();
          }, 0);
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === "r" || ev.key === "R")) {
          if (!root.classList.contains("is-dome")) return;
          ev.preventDefault();
          setReadMode(!readMode);
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key === "0") {
          if (!root.classList.contains("is-dome")) return;
          ev.preventDefault();
          replayOverview();
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === "f" || ev.key === "F")) {
          if (!root.classList.contains("is-dome")) return;
          ev.preventDefault();
          openWin("overview");
          setRailCollapsed(false);
          setStarFilter(!starFilterOn);
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && (ev.key === "l" || ev.key === "L") && !ev.shiftKey) {
          if (!root.classList.contains("is-dome") || !currentOvStem) return;
          ev.preventDefault();
          openWin("overview");
          copyChapterLink();
          return;
        }

        if (paletteEl && !paletteEl.hidden) {
          if (ev.key === "ArrowDown") {
            ev.preventDefault();
            movePalette(1);
            return;
          }
          if (ev.key === "ArrowUp") {
            ev.preventDefault();
            movePalette(-1);
            return;
          }
          if (ev.key === "Enter") {
            ev.preventDefault();
            runPaletteItem(paletteIndex);
            return;
          }
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.key === "Escape") {
          if (ev.shiftKey) {
            ev.preventDefault();
            setTasksOpen(!!tasksPanel && tasksPanel.hidden);
            return;
          }
          ev.preventDefault();
          hideCtx();
          setQsOpen(false);
          setKeysOpen(false);
          setSwitcherOpen(false);
          setTasksOpen(false);
          setPaletteOpen(false);
          setNotifOpen(false);
          setStartOpen(!!startMenu && startMenu.hidden);
          return;
        }

        if (inField) {
          if (paletteEl && !paletteEl.hidden && ev.target && ev.target.matches && ev.target.matches("[data-ly-palette-input]")) {
            return;
          }
          return;
        }

        if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && /^[1-5]$/.test(ev.key)) {
          var trailItem = chapterTrail[parseInt(ev.key, 10) - 1];
          if (trailItem && trailItem.stem) {
            ev.preventDefault();
            openWin("overview");
            setOverviewStem(trailItem.stem, trailItem.label || trailItem.stem);
            return;
          }
        }

        if (ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.key === "Enter") {
          var maxId = focusedWinId();
          if (maxId) {
            ev.preventDefault();
            maxWin(maxId);
            return;
          }
        }

        if (switcherEl && !switcherEl.hidden && ev.key === "Enter") {
          ev.preventDefault();
          var onItem = qs(".ly-switcher-item.is-on", switcherEl);
          if (onItem) onItem.click();
          else setSwitcherOpen(false);
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && (ev.key === "w" || ev.key === "W")) {
          var closeId = focusedWinId();
          if (!closeId) return;
          ev.preventDefault();
          closeWin(closeId);
          pushToast(COPY.toastClosed);
          return;
        }

        if (ev.altKey && ev.key === "F4") {
          var closeAlt = focusedWinId();
          if (!closeAlt) return;
          ev.preventDefault();
          closeWin(closeAlt);
          pushToast(COPY.toastClosed);
          return;
        }

        if (ev.ctrlKey && !ev.metaKey && !ev.altKey && /^[1-5]$/.test(ev.key)) {
          ev.preventDefault();
          openWin(APP_ORDER[Number(ev.key) - 1]);
          return;
        }

        if (ev.ctrlKey && !ev.altKey && (ev.key === "ArrowLeft" || ev.key === "ArrowRight" || ev.key === "ArrowUp" || ev.key === "ArrowDown")) {
          ev.preventDefault();
          if (ev.key === "ArrowLeft") snapFocused("left");
          else if (ev.key === "ArrowRight") snapFocused("right");
          else if (ev.key === "ArrowUp") snapFocused("up");
          else snapFocused("down");
          return;
        }

        if ((ev.altKey && !ev.ctrlKey && !ev.metaKey) && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
          var ovWin = winById("overview");
          if (ovWin && ovWin.classList.contains("is-open") && !ovWin.hidden) {
            ev.preventDefault();
            stepOverview(ev.key === "ArrowLeft" ? -1 : 1);
            return;
          }
        }

        if (ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.key === "Home") {
          var linksHome = ovLinks();
          if (linksHome.length && root.classList.contains("is-dome")) {
            ev.preventDefault();
            openWin("overview");
            setOverviewStem(
              linksHome[0].getAttribute("data-ov-stem") || "",
              (linksHome[0].textContent || "").trim()
            );
            return;
          }
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.altKey && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
          if (!root.classList.contains("is-dome")) return;
          ev.preventDefault();
          stepOverviewPart(ev.key === "ArrowLeft" ? -1 : 1);
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
          if (!root.classList.contains("is-dome")) return;
          ev.preventDefault();
          stepOverviewUnread(ev.key === "ArrowLeft" ? -1 : 1);
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.key === "End") {
          var linksEnd = ovLinks();
          if (linksEnd.length && root.classList.contains("is-dome")) {
            ev.preventDefault();
            var last = linksEnd[linksEnd.length - 1];
            openWin("overview");
            setOverviewStem(
              last.getAttribute("data-ov-stem") || "",
              (last.textContent || "").trim()
            );
            return;
          }
        }

        if (ev.ctrlKey && (ev.key === "d" || ev.key === "D")) {
          ev.preventDefault();
          showDesktop();
          return;
        }

        if (!(ev.key === "`" || ev.code === "Backquote")) return;
        if (ev.ctrlKey || ev.metaKey) {
          ev.preventDefault();
          cycleWindows(ev.altKey ? -1 : 1);
          return;
        }
        if (ev.altKey && !ev.ctrlKey && !ev.metaKey) {
          ev.preventDefault();
          cycleWindows(-1);
        }
      },
      true
    );

    syncTasks();
    syncShowDeskBtn();
    try {
      var storedTheme = window.sessionStorage.getItem(THEME_KEY);
      if (storedTheme && GLOW_ORDER.indexOf(storedTheme) !== -1) {
        setGlowTheme(storedTheme);
      } else {
        setGlowTheme("cyan");
      }
    } catch (_themeErr) {
      setGlowTheme("cyan");
    }
    syncOvProgress();
    try {
      if (window.sessionStorage.getItem(RAIL_KEY) === "1") {
        setRailCollapsed(true);
      }
    } catch (_railErr) {
      /* ignore */
    }
    try {
      if (window.sessionStorage.getItem(READ_KEY) === "1") {
        setReadMode(true, { toast: false });
      }
    } catch (_readErr) {
      /* ignore */
    }
    var firstStem = qs(".ly-ov-link.is-on", root) || qs(".ly-ov-link", root);
    if (currentOvStem) {
      var savedLink = qs('.ly-ov-link[data-ov-stem="' + currentOvStem + '"]', root);
      if (savedLink) firstStem = savedLink;
    }
    if (firstStem) {
      var fs = firstStem.getAttribute("data-ov-stem") || "";
      var fl = (firstStem.textContent || "").trim() || fs;
      currentOvStem = fs;
      visitedChapters[fs] = true;
      if (!chapterTrail.length) pushChapterTrail(fs, fl);
      else renderRecentStrip();
      syncOvProgress();
      syncStars();
      syncPartDone();
    }

    if (stage) {
      stage.addEventListener("pointermove", function (ev) {
        if (!root.classList.contains("is-dome")) return;
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          return;
        }
        var glow = qs(".ly-desk-glow", root);
        if (!glow) return;
        var r = stage.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var nx = (ev.clientX - r.left) / r.width - 0.5;
        var ny = (ev.clientY - r.top) / r.height - 0.5;
        glow.style.setProperty("--ly-px", (nx * 10).toFixed(2) + "%");
        glow.style.setProperty("--ly-py", (ny * 8).toFixed(2) + "%");
      });
    }

    root._lyCloseStart = function () {
      setStartOpen(false);
      setQsOpen(false);
      setKeysOpen(false);
      setSwitcherOpen(false);
      setTasksOpen(false);
      setPaletteOpen(false);
      setNotifOpen(false);
      hideSnapLayouts();
      hideJump();
      hideHistory();
      hideCtx();
    };
    var depthNow = nestDepth();
    if (depthNow >= 1) {
      root.classList.add("is-nested");
      root.setAttribute("data-nest-depth", String(depthNow));
      var bezel = qs(".ly-bezel", root);
      if (bezel && !qs(".ly-nest-chip", bezel)) {
        var chip = document.createElement("span");
        chip.className = "ly-nest-chip";
        chip.textContent = (isEn ? "nested · " : "вложение · ") + String(depthNow);
        bezel.appendChild(chip);
      }
    }

    var focusBtn = qs("[data-ly-focus]", root);
    var focusLabel = qs("[data-ly-focus-label]", root);

    function setFocusMode(on) {
      document.body.classList.toggle("is-ly-focus", on);
      root.classList.toggle("is-focus", on);
      if (focusBtn) {
        focusBtn.setAttribute("aria-pressed", on ? "true" : "false");
        focusBtn.classList.toggle("is-on", on);
      }
      if (focusLabel) {
        focusLabel.textContent = on ? COPY.focusOn : COPY.focusOff;
      }
      if (on) {
        setDome(true);
        try {
          root.scrollIntoView({ block: "start", behavior: "auto" });
        } catch (_err) {
          /* ignore */
        }
        window.scrollTo(0, 0);
      }
    }

    if (focusBtn) {
      focusBtn.addEventListener("click", function () {
        setFocusMode(!document.body.classList.contains("is-ly-focus"));
      });
    }

    var firstOv = qs('.ly-ov-link[data-ov-stem="01-what-is-eliteew"]', root) || qs(".ly-ov-link", root);
    if (firstOv) firstOv.classList.add("is-on");

    root._lySetFocusMode = setFocusMode;
  }

  function initReveal() {
    var nodes = qsa(".reveal");
    if (!nodes.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    nodes.forEach(function (n) { io.observe(n); });
  }

  function initChrome() {
    var top = qs(".site-top");
    var back = qs("[data-back-top]");
    var onScroll = function () {
      var y = window.scrollY || 0;
      if (top) top.classList.toggle("is-scrolled", y > 8);
      if (back) back.classList.toggle("is-on", y > 480);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    if (back) {
      back.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    var toggle = qs("[data-nav-toggle]");
    var nav = qs(".nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  }

  function initSideRail() {
    var links = qsa(".side-rail a[href^='#']");
    if (!links.length) return;
    var map = new Map();
    links.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (el) map.set(el, a);
    });
    if (!map.size) return;
    var ratios = new Map();
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        var best = null;
        var bestR = 0;
        ratios.forEach(function (r, el) {
          if (r > bestR) {
            bestR = r;
            best = el;
          }
        });
        links.forEach(function (a) { a.classList.remove("is-active"); });
        if (best && bestR > 0 && map.get(best)) {
          map.get(best).classList.add("is-active");
        }
      },
      { rootMargin: "-18% 0px -55% 0px", threshold: [0, 0.12, 0.3, 0.5] }
    );
    map.forEach(function (_a, el) { io.observe(el); });
  }

  var BADGE_CLASS = {
    Present: "pill-fact",
    "Present:": "pill-fact",
    "Есть": "pill-fact",
    "Есть:": "pill-fact",
    "Not promised": "pill-hyp",
    "Not promised:": "pill-hyp",
    "Не обещаем": "pill-hyp",
    "Не обещаем:": "pill-hyp",
    Checked: "pill-op",
    "Checked:": "pill-op",
    "Проверено": "pill-op",
    "Проверено:": "pill-op",
    Historical: "pill-ill",
    "История": "pill-ill",
    "Not positioned": "pill-pos",
    "Не позиционируем": "pill-pos",
    Positioning: "pill-pos",
    Illustrative: "pill-ill",
    // legacy keys (older exports / cached HTML)
    Fact: "pill-fact",
    "Fact:": "pill-fact",
    Hypothesis: "pill-hyp",
    "Operator-verified": "pill-op",
    "Operator-verified:": "pill-op",
  };

  function initBadgePills() {
    qsa("article.chapter strong").forEach(function (el) {
      var text = (el.textContent || "").trim();
      var cls = BADGE_CLASS[text];
      if (!cls) return;
      var pill = document.createElement("span");
      pill.className = "pill " + cls;
      pill.textContent = text;
      pill.setAttribute("data-badge", text);
      el.replaceWith(pill);
    });
  }

  function initTableScroll() {
    qsa("article.chapter table").forEach(function (table) {
      if (table.parentElement && table.parentElement.classList.contains("table-scroll")) {
        return;
      }
      var wrap = document.createElement("div");
      wrap.className = "table-scroll";
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", "Таблица — прокрутка по горизонтали");
      wrap.tabIndex = 0;
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  function initProgress() {
    var bar = qs("[data-progress]");
    if (!bar) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var update = function () {
      var doc = document.documentElement;
      var max = Math.max(doc.scrollHeight - window.innerHeight, 1);
      var pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
      if (reduce) {
        bar.style.width = pct + "%";
      } else {
        bar.style.transform = "scaleX(" + pct / 100 + ")";
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
  }

  function initLangSwitch() {
    qsa("[data-lang-switch]").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        var base = a.getAttribute("href");
        if (!base) return;
        var hash = window.location.hash || "";
        if (!hash) return;
        ev.preventDefault();
        window.location.href = base.split("#")[0] + hash;
      });
    });
  }

  function initHashTarget() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    var id = decodeURIComponent(hash.slice(1));
    var el = document.getElementById(id);
    if (!el) return;
    // After layout (fonts/mermaid), nudge into view under sticky chrome.
    window.setTimeout(function () {
      el.scrollIntoView({ block: "start", behavior: "auto" });
      el.classList.add("is-hash-target");
    }, 60);
  }

  function initBookSearch() {
    var input = qs("[data-book-search]");
    if (!input) return;
    var empty = qs("[data-book-search-empty]");
    var parts = qsa(".side-rail .sr-part");
    var apply = function () {
      var q = (input.value || "").trim().toLowerCase();
      var any = false;
      parts.forEach(function (part) {
        var links = part.querySelectorAll("a");
        var partAny = false;
        links.forEach(function (a) {
          var hay = ((a.textContent || "") + " " + (a.getAttribute("href") || "")).toLowerCase();
          var show = !q || hay.indexOf(q) !== -1;
          a.hidden = !show;
          if (show) partAny = true;
        });
        part.hidden = !partAny;
        if (partAny) any = true;
      });
      if (empty) empty.hidden = !q || any;
    };
    input.addEventListener("input", apply);
    input.addEventListener("search", apply);
  }

  function initEmbedMode() {
    var params = new URLSearchParams(window.location.search || "");
    if (params.get("embed") !== "1") return;
    document.documentElement.classList.add("is-embed");
    document.body.classList.add("is-embed");
  }

  function setRailOpen(open) {
    var rail = qs(".side-rail");
    var scrim = qs("[data-rail-scrim]");
    var fab = qs("[data-rail-toggle]");
    if (!rail) return;
    rail.classList.toggle("is-open", open);
    if (scrim) {
      scrim.classList.toggle("is-on", open);
      scrim.hidden = !open;
    }
    if (fab) fab.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("rail-drawer-open", open);
  }

  function initRailDrawer() {
    var rail = qs(".side-rail");
    var fab = qs("[data-rail-toggle]");
    var scrim = qs("[data-rail-scrim]");
    if (!rail || !fab) return;
    fab.addEventListener("click", function () {
      setRailOpen(!rail.classList.contains("is-open"));
    });
    if (scrim) {
      scrim.addEventListener("click", function () {
        setRailOpen(false);
      });
    }
    qsa(".side-rail a[href^='#']").forEach(function (a) {
      a.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 979px)").matches) {
          setRailOpen(false);
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initEmbedMode();
    qsa("[data-layering]").forEach(initLayering);
    initBadgePills();
    initTableScroll();
    initReveal();
    initChrome();
    initSideRail();
    initRailDrawer();
    initProgress();
    initLangSwitch();
    initHashTarget();
    initBookSearch();
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    var nav = qs(".nav");
    var toggle = qs("[data-nav-toggle]");
    if (nav && nav.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      return;
    }
    if (document.body.classList.contains("rail-drawer-open")) {
      setRailOpen(false);
      return;
    }
    var egg = document.getElementById("ly-nest-egg");
    if (egg) {
      var close = egg.querySelector(".ly-nest-close");
      if (close) close.click();
      return;
    }
    var lyOpen = qs("[data-layering].is-dome");
    if (lyOpen && typeof lyOpen._lyCloseStart === "function") {
      var menu = qs("[data-ly-start-menu]", lyOpen);
      if (menu && !menu.hidden) {
        lyOpen._lyCloseStart();
        return;
      }
    }
    if (document.body.classList.contains("is-ly-focus")) {
      var ly = qs("[data-layering]");
      if (ly && typeof ly._lySetFocusMode === "function") {
        ly._lySetFocusMode(false);
      } else {
        document.body.classList.remove("is-ly-focus");
        qsa("[data-layering]").forEach(function (el) {
          el.classList.remove("is-focus");
        });
      }
    }
  });
})();
