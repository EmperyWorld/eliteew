# Desktop chrome declutter and scroll ownership

Living contract for EliteEW desktop **window apps** and **Settings Center** after the 2026-07 UI declutter wave. Prevents re-introducing dense chrome and nested-scroll “уезжает” regressions.

## Scope

| In | Out |
|----|-----|
| Desktop Settings Center (all tabs) | Admin / operator-only consoles |
| First-party `appComponent` windows with internal scroll | Folder windows; ContentManagerPro outer preview scroll |
| Product headers, persistence badges, section blurbs, jump-away legacy CTAs | Required a11y (`sr-only` titles), sticky in-tab jump nav |

## Settings Center invariants

1. **No persistence badges** on `SettingsFormCard` — gated by Shell **`chromeProfile: 'settings'`** traits (`allowPersistenceBadges: false` via `resolveShellChromeTraits` / `useShellChrome`). Storage map / deep-link ids remain; badges are not user chrome. Do not reintroduce badges by hardcoding UI — change would require a different registry profile (forbidden for Settings).
2. **No card / section blurbs** under titles — controls and live previews carry meaning.
3. **Tab titles** for Icons / Chrome / Shell / Performance / Personalize scroll body: `sr-only` or minimal sticky chrome; no long intro paragraphs or tip callouts in the primary column.
4. **Personalize order:** sticky Visual Studio preview → Empery curated looks → theme / wallpaper → Fine-tune / Looks disclosures.
5. **One primary CTA** on Personalize idle: Change wallpaper (accent); try-on Save becomes primary when staging.
6. **Scroll ownership:** Settings embedded window is **self-scroll** — outer `EnhancedWindow` body `overflow-hidden`; vertical scroll only on `#desktop-settings-main-tabpanel` (`overflow-y-auto`).
7. **Everyday IA (target):** user-job budgets, single Look SoT per preference key, Comfort/Behavior demotion — [DESKTOP-SETTINGS-EVERYDAY-IA.md](DESKTOP-SETTINGS-EVERYDAY-IA.md). Declutter alone is not cognitive Done.

## Window body self-scroll registry

**Source of truth (U1.a):** `shared/web/frontend/src/pages/Desktop/shell/appRegistry.catalog.ts`
Resolver: `shell/appRegistry.ts` + `shell/shellScroll.ts` → `EnhancedWindow` (`resolveWindowBodyScrollDomFlags`).
Legacy adapter (Set / `isDesktopAppWindowBodySelfScrollApp`): `utils/desktopWindowBodyScrollRegistry.ts` — derived from catalog; do not hand-edit membership.

| Rule | Meaning |
|------|---------|
| `scroll.mode: 'self'` | Outer window `<section>` = `overflow-hidden` (no `data-desktop-scroll`) |
| `outer` / unregistered | Outer body `overflow-auto` + `data-desktop-scroll` |
| `outer_preview` (**ContentManagerPro**) | Outer scroll — preview positioning depends on `data-desktop-scroll` |
| Settings | self + `scrollContainerId: desktop-settings-main-tabpanel` |

When adding a new first-party app with `h-full` + internal `overflow-y-auto` / `overflow-auto`, **add one catalog entry** in `appRegistry.catalog.ts` in the same PR — **including `chromeProfile`** (`standard` \| `settings` \| `iframe_launcher`). Do not grow an ad-hoc `if` chain in `EnhancedWindow`. Chrome traits: `shell/shellChrome.ts` / `useShellChrome`; window body stamps `data-shell-chrome-profile`.

| `chromeProfile` | Declutter / chrome meaning |
|-----------------|----------------------------|
| `standard` | Dense chrome + persistence badges allowed |
| `settings` | Minimal header; **no** persistence badges (`SettingsFormCard`) |
| `iframe_launcher` | Minimal header; no badges; portal hint `forbidden` |

**Aliases:** `FriendsApp` / `UserProfile` mount SocialHub UI but keep distinct `appComponent` values — both must be listed (registry keys off window `appComponent`, not the inner shell name).

**Intentionally outer:** `ContentManagerPro` (`outer_preview`); iframe / short launchers (`outer` + `iframe_launcher`): `ProjectAboutApp`, `EmperyNexusChronicleApp`, `VideoCallApp`, `LocalServiceIframeApp`, `DesktopAppMaintenance`.

**Audit wave 2026-07-24:** self-scroll inventory locked; U1.a seeds the same set into Shell App Registry (Vitest: `shell/__tests__/appRegistry.test.ts` + legacy parity tests).

## Layout width in desktop windows

- Prefer `w-full min-w-0` content columns inside windows.
- Avoid page-marketing `max-w-7xl mx-auto` for primary Hub/shell surfaces (see UGS Hub).
- Horizontal padding (`px-*`) is allowed; artificial reading-width caps are not, unless the surface is a true article/doc reader.
- **Site Studio admin** when `isDesktopEmbedded`: content column is `w-full min-w-0` (page route may keep `max-w-7xl`).

## Dead chrome copy

After removing badges/blurbs/continue-setup, prune unused `desktopUi.settingsPanel` keys in the same wave (RU+EN). Do not leave orphan persistence / `personalizeNext*` / card `*Desc` strings that invite reintroduction.

## Regression locks

- `shell/__tests__/appRegistry.test.ts` — catalog seed + DomFlags resolution (self / outer / outer_preview / Settings `scrollContainerId` / chromeProfile).
- `shell/__tests__/shellChrome.test.ts` — chromeProfile traits + resolve from seeded catalog (U4).
- `shell/__tests__/u2ScrollDomMutation.lock.test.ts` — apps/features must not `setAttribute` shell scroll DomFlags (U2).
- `shell/__tests__/u2PortalBodyCreatePortal.lock.test.ts` + `scripts/eliteew/desktop-u2-portal-inventory.sh` — sole body `createPortal` owner = `shellBodyPortal.tsx`.
- `desktopWindowBodyScrollRegistry.test.ts` + `EnhancedWindowSelfScroll.test.ts` — legacy adapter + EnhancedWindow helper parity (incl. StudioGU, EWRP, chats, EWA, FriendsApp/UserProfile aliases); ContentManagerPro + iframe launchers stay non-self.
- `DesktopSettingsFormCard.declutter.test.tsx` — no persistence badge chrome; settings profile suppresses `persistenceBadge` prop.
- Personalize premium tests — curated after sticky preview; no trust strip / continue-setup card.
- `UgsHubShellHeader.declutter.test.tsx` — no `Elite Dashboard` hero CTA; Dashboard is secondary text under status refresh.
- `desktopSettingsDeclutterI18n.lock.test.ts` — pruned `settingsPanel` chrome keys stay absent in RU/EN.
- Prefer `queryBy*` absence locks for removed chrome strings where copy is stable.
- Storage map / field-count chrome stays behind support diagnostics (`desktop-settings-support-diagnostics`); do not reintroduce storage map as the first Advanced card.
- Discovery / Assistant expansion cards stay behind power-options disclosure (`desktop-settings-power-options`); workspace profiles + widget panel remain primary on Behavior (widget panel deep-linked from floating-widget card).
- No widgets taxonomy callout above Windows & widgets cards (`widgetsTaxonomy*` keys pruned; titles + floating→panel link carry the distinction).
- Comfort tab: smoothness/effects before experimental soft-blur disclosure (`desktop-settings-comfort-experimental-effects`) and session-status metrics (`desktop-settings-comfort-session-status`); DevTools realtime marks stay inside session disclosure.
- Chrome tab: window + taskbar presets primary; panel opacity + UI scale behind `desktop-settings-chrome-advanced` (shared Personalize disclosure primitive).
- Shell sync: everyday refresh/queue primary; support diagnostics exports behind `desktop-settings-sync-diagnostics`.
- Quick Search: header uses `DesktopAppToolbar` + `DesktopAppInput`; launcher rows compose `DESKTOP_APP_STYLE_CONTRACT.listRow` (`qsLauncherRowClass`).
- **Typography (combo wave 2026-07-28):** shell chrome paths in `DesktopShellTypography.tokens.contract.test.ts` (incl. `ProductAssistantMarkdown`, `AdminCatalogAppIcon`) must use `DESKTOP_TYPOGRAPHY` — no raw `text-[9|10|11px]`.
- **Look import copy:** primary EN Advanced personalize uses «look file» wording (`visualPackImport*`); support diagnostics exports may keep «JSON» in titles.
- **FE UX obs (no API):** `utils/desktopShellUxMetrics.ts` — offline banner / sync conflict debug events from `DesktopWorkspaceOfflineBanner` + `DesktopSyncStatus` (must not break chrome on failure).

## Related

- [SHELL-LIFECYCLE-AND-CHROME-SSOT.md](SHELL-LIFECYCLE-AND-CHROME-SSOT.md) — Shell Lifecycle Manager + App Registry; **U4 chromeProfile runtime Done**
- [DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md](DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md) — U1 App Registry; **U2–U4 done** (`ShellPortalMount` / Biome / chromeProfile traits)
- [DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md](DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md)
- [UGS-DESKTOP-SHELL.md](UGS-DESKTOP-SHELL.md)
- [ELITEEW-UX-PRIMITIVES-CONTRACT.md](ELITEEW-UX-PRIMITIVES-CONTRACT.md)
- `shared/web/frontend/src/pages/Desktop/components/settings/DesktopSettingsFormCard.tsx`
