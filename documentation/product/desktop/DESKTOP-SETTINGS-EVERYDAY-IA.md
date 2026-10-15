# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Living target SoT — Everyday IA for Desktop Settings Center (appearance /
# comfort). Separates user jobs from power-user expansion. Process roadmap:
# solution-readiness `2026-09-06-desktop-settings-everyday-ia-redesign.md`.
# Related:
# - DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md (data map + expansion)
# - DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md (chrome invariants)
# - Interface audit 2026-09-06 (Overall 11; cognitive 6)
# ---

# Desktop Settings — Everyday IA (target SoT)

**Status:** living (Cause waves 1–3 + Measure + Fine-tune Fonts + language RU|EN + morph path 2026-09-06)  
**Edition / pack:** cloud · shared-only (`pages/Desktop` Settings)  
**Product:** `desktop-shell`

## 1. Problem (failure layer)

Settings Center grew as a **control surface** (Visual Studio + expansion + diagnostics) while remaining the everyday entry for «оформление». Tabs exist, but **user jobs collide**: look change, shell behavior, and support diagnostics share equal visual weight. Declutter (no badges/blurbs) improved chrome, not cognitive load.

## 2. User jobs (exactly three everyday)

| Job ID | User sentence | Primary surface |
|--------|---------------|-----------------|
| **J1 Look** | «Хочу другой вид стола» | Tab **Персонализация** |
| **J2 Chrome** | «Хочу другие окна / панель» | Tab **Окна и панель** |
| **J3 Icons / Widgets** | «Иконки / виджеты» | Tabs **Иконки**, **Виджеты** |

Power jobs (not everyday primary):

| Job ID | Surface |
|--------|---------|
| **J4 Behavior** | Advanced → **Поведение** (workspaces, sync, expansion) |
| **J5 Comfort** | Advanced → **Комфорт** (2–3 comfort toggles; metrics = support) |
| **J6 Support** | Nested disclosures only (storage map, JSON packs, diagnostics) |

## 3. Look SoT (no duplicate pickers)

| Control | Single source of truth | Allowed elsewhere |
|---------|------------------------|-------------------|
| Theme, accent, **interface language (RU|EN)**, wallpaper, curated looks | **Personalize** primary | Profile language API when authed; i18n localStorage always |
| Window style, taskbar style | **Chrome** tab grids **and** Visual Studio in-place hotspot popovers (same prefs keys) | Preview footer may still deep-link; no navigate-away on hotspot click |
| Panel opacity, UI scale | Chrome **advanced** disclosure | Preview may adjust opacity only if it does not duplicate a second labeled grid |
| Icon style / size / grid | **Icons** | Preview may show icon style; change → Icons tab or inline only if Icons has no parallel full grid |
| Widget chrome style | **Widgets** | Same rule as icons |
| Typography / scene depth / shell motion knobs | Personalize **Fine-tune** capped (see §4) or Comfort deep-link | Not on primary Personalize column |
| Context Menu Settings Submenu | **All 6 tabs** (`personalize`, `icons`, `chrome`, `widgets`, `shell`, `performance`) | Parity in `createContextMenuItems` + `useDesktopWorkspaceHandleAction` |

**Invariant:** a user must never see two full style-picker grids for the same preference key in one Settings session without an intentional navigate-away.

## 4. Personalize column budget (everyday)

Above the fold / primary scroll (no disclosure required):

1. Sticky live preview — **compact stage** (≈180–220px, `stageDensity=compact` on preview-only). Hotspots open **in-place** popovers; anchors follow stage/legend click. Morph: **window → taskbar** with calm observation cycle (~2.4s hold, not 480ms jitter). Outer stage `motion.div` does not use a destructive composite remount key, preserving child DOM nodes across style tweaks. Motion chip on stage. Language RU|EN as a **strip** under preview (not a full settings card) using resilient `useOptionalAuth`. Try-on Save/Discard lives in the **same** sticky stack (no second sticky offset). i18n immediate; profile persist when authenticated.
2. Curated Empery looks (one-tap apply) — lighter card weight than the Look group.
3. One **Look** group card: theme + accent + wallpaper **CTA + small thumb** (sticky VS remains the wallpaper SoT stage — no second giant preview). Idle: **one** filled primary CTA (`Change wallpaper`); try-on Save when staging.
4. Wallpaper picker: compact modal (`lg`, denser grid) — uploaded images immediately appear in the grid as selectable preview tiles with selection state before apply; removal of user wallpapers safely falls back to current selection.

Behind **one** disclosure «Точная настройка» (Fine-tune), **max three** everyday decisions:

- **Fonts** — one Body \| Display chooser (both prefs settable; one grid visible at a time).
- Scene depth (3 options).
- «Спокойнее анимации» (single reduce-motion style toggle) — fine motion speed/parallax/morph → nested Advanced inside Fine-tune.

Behind **«Мои виды»**:

- User presets + try-on (Save/Discard only on the **same** sticky stack as the live preview — not a second sticky offset).
- JSON import/export → nested **Advanced** only (support dialect).

## 5. Chrome / Icons / Widgets

- **Chrome:** current preview strip + one looks disclosure per window/taskbar; opacity/scale remain advanced.
- **Icons / Widgets:** keep existing primary cards; no taxonomy essays; no cross-links that open parallel full pickers for the same key.
- **Deep-link / storage map / hotspot navigate:** `scrollToSettingsElement` opens ancestor `<details>` (and Fine-tune font pane) before scroll so nested fields are actually visible.

## 6. Advanced (Behavior + Comfort)

- Stay behind Settings Advanced disclosure (existing `ADVANCED_TAB_IDS`).
- **Behavior:** primary = virtual desktops + save workspace (or equivalent 1–2 actions); jump-nav may remain for a11y but must not be required to understand the tab. Discovery / assistant / storage map stay nested (existing power-options / support pattern).
- **Comfort:** primary = animations / less blur / aggressive background (or equivalent 2–3 user-language toggles). FPS, Long tasks, adapters, DevTools marks, soft-blur sampling → **session / support** disclosure only; soft-blur experiment is **nested inside** session-status (not a sibling Comfort disclosure).

## 7. Copy contract

- Primary surfaces: user language for the job («вид», «окна», «если тормозит»).
- Forbidden on primary (must stay support-only): `shell_state`, FPS, Long tasks, adapters, raw JSON schema talk, Telemetry.
- RU/EN parity for every primary string touched in a wave.
- Do not reintroduce card blurbs / persistence badges (`DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md`).

## 8. Success metrics (honest, not vanity)

| Metric | Target after Cause waves |
|--------|--------------------------|
| Interface audit **cognitive** | ≥15 |
| Interface audit **overall** (after caps) | ≥15 |
| Primary Personalize filled CTAs above fold | ≤1 idle |
| Sticky VS stage (preview-only) | compact ≤ ~220px; language strip; single sticky stack |
| Wallpaper representations on Personalize | sticky stage + thumb only (no peer `aspect-video` theatre) |
| Full style grids per preference key | =1 SoT |
| `settingsPanel` strings on primary paths | no support jargon (lock tests) |

## 9. Non-goals

- No second Settings window / manager.
- No DB/API migration for IA alone (`profile.ui` / `desktop_config` / `shell_state` keys stay).
- No revival of soft-retired product trees.
- No score-only Measure wave without Cause.

## 10. Peers / proof

- Premium bar: `premium-user-interface.mdc`, skill `eliteew-premium-interface`.
- Data map remains: `DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md`.
- Regression: narrow Vitest under `settings/__tests__/` + declutter/copy locks; browser smoke Personalize + Chrome after UI waves.
