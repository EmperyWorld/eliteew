/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop surface, typography, interactive, overlay, taskbar, and layout chrome tokens.
 *
 * Invariants:
 * - Symbol names and values unchanged from pre-P38 constants barrel; structural split only.
 *
 * Related:
 * - constants/index.ts (re-export barrel)
 * - src/pages/Desktop/utils/desktopAppRegistry.ts
 */
/**
 * Desktop design tokens: colors (RGB space-separated), radius, shadow, spacing. Applied on Desktop root.
 * Границы: `border-subtle` / `border-strong` — общий UI; `border-menu` — только `DesktopAppMenuSurface`;
 * `menu-tint` — доля в color-mix фона контекстных меню (см. DesktopAppChrome MENU_SURFACE).
 * Slim owner (follower-safe): `./desktopDesignTokens.ts`.
 */

export const DESKTOP_SURFACE = {
	radius: 'rounded-[var(--desktop-radius)]',
	radiusLg: 'rounded-[var(--desktop-radius-lg)]',
	radiusXl: 'rounded-[var(--desktop-radius-xl)]',
	radiusFrame: 'rounded-[var(--desktop-radius-frame)]',
	radiusShell: 'rounded-[var(--desktop-radius-shell)]',
	radiusSection: 'rounded-[var(--desktop-radius-section)]',
	shadow: 'shadow-[0_28px_64px_-12px_rgba(0,0,0,0.42)]',
	shadowLg: 'shadow-[0_36px_72px_-16px_rgba(0,0,0,0.48)]',
	spacing: 'p-2',
	/** Между `spacing` и `spacingLg` (компактные панели ассистента, EWDesk и т.п.) */
	spacingMd: 'p-3',
	spacingLg: 'p-4',
	border: 'border border-[color:var(--desktop-border-subtle)]',
	borderSubtle: 'border border-[color:var(--desktop-border-subtle)]',
} as const;

/**
 * Typography hierarchy for desktop: title, body, meta.
 * Use for Taskbar, StartMenu, WidgetsPanel, NotificationCenter consistency.
 * Contrast: body/meta/caption/small align with `--desktop-*` surfaces; they meet WCAG AA (4.5:1) on dark shell.
 */
export const DESKTOP_TYPOGRAPHY = {
	/**
	 * Primary heading inside desktop app windows (single window / embedded).
	 * Prefer this over ad-hoc `text-2xl` / `text-3xl` hero titles.
	 */
	title:
		'text-lg font-semibold text-[var(--desktop-text-primary)] tracking-tight antialiased',
	/** Section heading (e.g. in settings tabs) */
	subtitle:
		'text-base font-semibold text-[var(--desktop-text-primary)] tracking-tight antialiased',
	/** Body text */
	body: 'text-sm text-[var(--desktop-text-secondary)] antialiased',
	/** Body text, muted (labels, empty states, secondary hints at sm size) */
	bodyMuted: 'text-sm text-[var(--desktop-text-muted)] antialiased',
	/** Secondary/meta (timestamps, hints) */
	meta: 'text-xs text-[var(--desktop-text-muted)] antialiased',
	/** Caption / small labels */
	caption:
		'text-[11px] text-[var(--desktop-text-muted)] tracking-wide antialiased',
	/** 11px without text color — use when parent sets semantic color (e.g. sync chip) */
	captionInherit: 'text-[11px] tracking-wide antialiased',
	/** Smallest (badges, overrides) */
	small: 'text-[10px] text-[var(--desktop-text-dim)] antialiased',
	/** Dense micro chip (floating widget KPI strip, tight tracking) */
	micro:
		'text-[9px] font-medium tracking-[0.08em] text-[var(--desktop-text-secondary)] antialiased',
	/** Hero clock on floating desktop widget */
	widgetClock:
		'text-[2.02rem] font-semibold leading-none tracking-[-0.055em] text-[var(--desktop-text-primary)] antialiased',
	/** Date line under widget clock */
	widgetDate:
		'text-xs font-medium text-[var(--desktop-text-secondary)] antialiased',
	/** Credits / KPI numeric strip (tabular) */
	widgetKpi:
		'text-[10px] font-semibold leading-none tracking-[0.06em] text-[rgb(var(--desktop-fg-primary-rgb)/0.96)] [font-variant-numeric:tabular-nums] antialiased',
	/** Legacy uppercase micro label — avoid on floating widget / Music Player eyebrows. */
	labelOverline:
		'text-[10px] uppercase tracking-[0.18em] text-[var(--desktop-text-muted)] antialiased',
	/** Track / primary title in widget player row */
	widgetTrackTitle:
		'text-xs font-semibold text-[var(--desktop-text-primary)] antialiased truncate',
	/** Taskbar window button label (truncated) */
	taskbarWindowTitle:
		'text-[11px] font-semibold tracking-tight text-[var(--desktop-text-primary)] antialiased',
	/** Taskbar clock (time) */
	taskbarClock:
		'text-[11px] font-semibold tabular-nums tracking-tight text-[var(--desktop-text-primary)] antialiased',
	/** Taskbar tray flyout header meta */
	taskbarTrayMeta:
		'text-[11px] leading-tight text-[var(--desktop-text-muted)] antialiased text-right',
	/** 9px count on colored badge bubbles */
	badgeCompact: 'text-[9px] font-semibold text-white antialiased',
	/** Stack count on grouped taskbar pill */
	taskbarGroupCount:
		'text-[9px] font-semibold tabular-nums text-[var(--desktop-text-primary)] antialiased',
	/** Badge on accent-filled tray chip */
	badgeTrayAccent:
		'text-[10px] font-semibold text-[rgb(var(--desktop-bg-primary-rgb))] antialiased',
	/** Section pill (Start / Quick search role badge) */
	sectionPill:
		'text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--desktop-text-secondary)] antialiased',
	/** Command palette title line (slightly heavier tracking) */
	sectionOverlineStrong:
		'text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--desktop-text-secondary)] antialiased',
	/** Keyboard shortcut glyph */
	kbd: 'font-mono text-[11px] text-[var(--desktop-text-secondary)] antialiased',
	/** Kbd chip in shell footers (Command Palette) */
	shellKbdGlyph:
		'rounded bg-(--desktop-surface-soft) px-1.5 py-0.5 font-mono text-[11px] text-(--desktop-text-secondary) antialiased',
	/** “Открыто” under pinned apps */
	pinnedMenuOpen:
		'text-[10px] text-[rgb(var(--desktop-accent-rgb))] antialiased',
	/** Virtual desktop strip counter typography (prefer TASKBAR_VD_NAME_CHIP_CLASS). */
	shellVirtualDesktopCounter:
		'text-[9px] font-medium tabular-nums tracking-normal text-[rgb(var(--desktop-fg-secondary-rgb)/0.88)] antialiased',
	/** Muted 10px (preview chrome, tray lines) — use instead of raw text-[10px] + muted */
	shellMeta10: 'text-[10px] antialiased text-[var(--desktop-text-muted)]',
	/** Unread / count bubble on desktop icon (colored pill) */
	iconBadgeNumeric: 'text-[10px] font-bold text-white antialiased',
	/** «Ещё» / «Свернуть» под line-clamp описания (акцент, фокус-кольцо) */
	shellDescriptionToggle:
		'text-[11px] font-semibold tracking-wide text-[rgb(var(--desktop-accent-rgb)/0.95)] antialiased hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] rounded',
	/** Accent highlight for search match / palette shortcut glyph */
	matchHighlight:
		'font-semibold text-[rgb(var(--desktop-accent-rgb))] antialiased',
	/** Taskbar GAF/tray: online accent status (medium weight) */
	shellAccentStatusMedium:
		'font-medium text-[rgb(var(--desktop-accent-rgb))] antialiased',
	/** Taskbar GAF/tray: offline / muted status */
	shellMutedStatusMedium: 'font-medium text-(--desktop-text-muted) antialiased',
	/** Quick Search primary input (lg body, theme colors) */
	quickSearchInput:
		'text-lg text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) focus:outline-none antialiased',
	/** 13px плотный текст: пункты меню, подсказки, описания карточек */
	shellCopy13: 'text-[13px] antialiased',
	/** 15px — тело пузыря чата, крупные карточки */
	shellCopy15: 'text-[15px] antialiased',
	/** 15px от breakpoint `sm` (например тело шага в AI Chat guide при шире узла) */
	shellCopy15Sm: 'sm:text-[15px]',
	/**
	 * Mermaid в узком пузыре (не fullscreen): скролл по ширине + размеры подписей в SVG foreignObject.
	 * См. `DesktopAiChatMarkdown` (`ChatMermaidBlock`).
	 */
	mermaidSvgEmbeddedClamp:
		'[&_svg]:max-w-full [&_svg]:h-auto [&_svg]:min-w-[min(100%,280px)] [&_svg_.nodeLabel_*]:text-xs! [&_svg_.edgeLabel_*]:text-[10px]!',
	/**
	 * Mermaid в long-read (отчёт Курсорины): вписать в колонку, подписи читаемые —
	 * не chat 10px и не native fullscreen `w-auto` гигант.
	 */
	mermaidSvgDocumentFit:
		'w-full min-w-0 [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full! [&_svg]:w-full! [&_svg_.nodeLabel_*]:text-[13px]! [&_svg_.edgeLabel_*]:text-xs! [&_svg_text]:text-[13px]',
} as const;

/**
 * Cmdk stylesheet (`CommandPalette`): px sizes mirror {@link DESKTOP_TYPOGRAPHY}
 * (input 16px ≈ text-base, items/empty 14px ≈ text-sm, group 11px ≈ caption).
 */
export const DESKTOP_CMDK_INJECTED = {
	fontSizeInput: '16px',
	fontSizeItem: '14px',
	fontSizeEmpty: '14px',
	fontSizeGroupHeading: '11px',
} as const;

export const WINDOW_TITLE_BAR = {
	iconBox: 'w-[1.125rem] h-[1.125rem] sm:w-5 sm:h-5 shrink-0',
	controlHit:
		'size-8 shrink-0 flex items-center justify-center rounded-[9px] transition-[color,background-color,transform] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-inset active:scale-[0.94]',
	controlHitClose:
		'size-8 shrink-0 flex items-center justify-center rounded-[9px] transition-[color,background-color,transform] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/75 focus-visible:ring-inset active:scale-[0.94]',
} as const;

/**
 * Standard interactive states for desktop controls.
 * Use these class strings for hover/focus/active/disabled consistency across Taskbar, StartMenu, WidgetsPanel, DesktopIcon, etc.
 */
export const DESKTOP_INTERACTIVE = {
	/** Neutral icon/toolbar button: hover, focus ring, active, disabled */
	btn: 'transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)] focus-visible:ring-inset hover:bg-[var(--desktop-surface-soft-hover)] active:bg-[var(--desktop-surface-soft-active)] disabled:opacity-50 disabled:pointer-events-none',
	/** Alias of `btn` for admin catalog / legacy call sites */
	button:
		'transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)] focus-visible:ring-inset hover:bg-[var(--desktop-surface-soft-hover)] active:bg-[var(--desktop-surface-soft-active)] disabled:opacity-50 disabled:pointer-events-none',
	/** Same with rounded-xl for panels */
	btnRounded:
		'rounded-xl transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)] focus-visible:ring-inset hover:bg-[var(--desktop-surface-soft-hover)] active:bg-[var(--desktop-surface-soft-active)] disabled:opacity-50 disabled:pointer-events-none',
	/** Primary CTA: accent background (use with text-white) */
	btnPrimary:
		'rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 bg-[rgb(var(--desktop-accent-rgb))] hover:brightness-110 active:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.5)] focus-visible:ring-inset disabled:opacity-50 disabled:pointer-events-none',
	/** Danger action (e.g. close, delete): red hover/active */
	btnDanger:
		'transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-inset hover:bg-red-500/18 active:bg-red-500/26 disabled:opacity-50 disabled:pointer-events-none',
	/** List/item row hover only (no focus ring for non-focusable rows) */
	rowHover:
		'hover:bg-[var(--desktop-surface-soft-hover)] transition-colors duration-200',
	/** Selectable row: hover + focus + active state */
	rowInteractive:
		'transition-colors duration-200 hover:bg-[var(--desktop-surface-soft-hover)] focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:ring-inset active:bg-[var(--desktop-surface-soft-active)]',
	/** Input field focus */
	inputFocus:
		'focus:outline-none focus:border-[rgb(var(--desktop-accent-rgb)/0.65)] focus:ring-1 focus:ring-[rgb(var(--desktop-accent-rgb)/0.22)] transition-colors duration-200',
	/**
	 * Full field chrome for admin/forms (border + soft surface + focus).
	 * Prefer composing DesktopAppInput when available; this is the SSOT class string.
	 */
	input:
		'rounded-lg border border-[var(--desktop-border-subtle)] bg-[var(--desktop-surface-soft)] px-3 py-2 text-sm text-[var(--desktop-text-primary)] placeholder:text-[var(--desktop-text-dim)] focus:outline-none focus:border-[rgb(var(--desktop-accent-rgb)/0.65)] focus:ring-1 focus:ring-[rgb(var(--desktop-accent-rgb)/0.22)] transition-colors duration-200',
	/** Focus ring only (for elements that already have hover/active elsewhere) */
	focusRing:
		'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)] focus-visible:ring-inset transition-shadow duration-200',
} as const;

/**
 * Overlay and backdrop styles for modals and panels.
 * Opaque surfaces only — no backdrop-filter (RDP / compositor budget).
 */
export const DESKTOP_OVERLAY = {
	/**
	 * Fullscreen dim — цвет из токена темы (тёмная / светлая).
	 * Единый scrim для shell: {@link ModalAdvanced} `variant="desktop"`, таскбар, Quick Search, App Store.
	 */
	backdrop: 'bg-(--desktop-overlay-backdrop) transition-opacity duration-200',
	/** Легче затемнение — трей, вторичные панели */
	backdropLight:
		'bg-(--desktop-overlay-backdrop) transition-opacity duration-200',
	/** Плавающая панель — opaque shell surface */
	panelSurface:
		'bg-(--desktop-surface-panel-strong) border border-(--desktop-border-strong) rounded-(--desktop-radius-shell) shadow-[0_28px_72px_rgba(0,0,0,0.52)]',
	/** Модальные окна настроек и т.п. */
	panelSurfaceStrong:
		'bg-(--desktop-surface-panel-strong) border border-(--desktop-border-strong) rounded-(--desktop-radius-shell) shadow-[0_36px_88px_rgba(0,0,0,0.55)]',
} as const;

/**
 * Tooltip consistency: delay before show, placement fallback, keyboard (focus), long-label truncation.
 */
const TOOLTIP_MAX_LENGTH = 60;
export const DESKTOP_TOOLTIP = {
	/** Delay (ms) before showing tooltip on hover */
	delayMs: 400,
	/** Max characters before truncation */
	maxLength: TOOLTIP_MAX_LENGTH,
	/** Truncate text with ellipsis */
	truncate: (s: string, max: number = TOOLTIP_MAX_LENGTH) =>
		s.length <= max ? s : `${s.slice(0, max - 3)}...`,
} as const;

/**
 * Taskbar layout: height, padding, gaps for consistent appearance across resolutions.
 * Use these in Taskbar.tsx and any Right Hot Bar / system tray to keep alignment.
 */
export const TASKBAR = {
	/** Main strip height (px). Full rail height; inner icon controls stay smaller via HIT_MIN_CLASS. */
	HEIGHT_PX: 46,
	/** Tailwind class for taskbar strip height. */
	HEIGHT_CLASS: 'h-[46px]',
	/** Mobile / compact strip — roomier hit area on small screens. */
	HEIGHT_CLASS_COMPACT: 'h-12',
	/** Horizontal padding: compact on small screens, larger on sm+. */
	PADDING_X: 'px-2.5 sm:px-3.5',
	/** Gap between taskbar groups. */
	GAP: 'gap-1.5 sm:gap-2',
	/** Padding for taskbar window/app pill buttons. */
	BUTTON_PADDING: 'px-2.5 sm:px-3 py-1.5',
	/** Icon size inside taskbar window pills + tray (higher contrast glyph). */
	ICON_SIZE: 'w-4 h-4 shrink-0 text-[var(--desktop-text-primary)]',
	/** Lucide on square chrome controls (tray, Пуск area, overflow). */
	ICON_CLASS: 'w-4 h-4 shrink-0 text-[var(--desktop-text-primary)]',
	/**
	 * Square controls (Пуск, трей, вирт. столы, overflow): smaller than strip height.
	 */
	HIT_MIN_CLASS: 'min-h-[34px] min-w-[34px]',
	/**
	 * Клавиатурный фокус на компактных кнопках таскбара: тоньше и мягче, чем `DESKTOP_INTERACTIVE.focusRing`,
	 * чтобы не было эффекта «толстой окантовки» на 34–44px hit-area.
	 */
	ICON_FOCUS:
		'focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.28)] transition-shadow duration-200',
	/**
	 * Правая зона таскбара (часы, трей, уведомления, шорткаты): без «пузыря» из пресета
	 * (`buttonSurface` — mix+border+inset shadow). Только лёгкий hover / акцент при открытой панели.
	 */
	RIGHT_ICON_SURFACE:
		'border-0 bg-transparent shadow-none [box-shadow:none] fine-hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb))_10%,transparent)]',
	RIGHT_ICON_ACTIVE_SURFACE:
		'border-0 shadow-none [box-shadow:none] bg-[rgb(var(--desktop-accent-rgb)/0.22)] fine-hover:bg-[rgb(var(--desktop-accent-rgb)/0.30)]',
	/** Window pills: shorter than `HEIGHT_CLASS` for vertical breathing room. */
	WINDOW_BUTTON_MIN_H: 'min-h-10',
	/** Max width for window title chip. */
	WINDOW_PILL_MAX_W: 'max-w-[min(100%,13rem)]',
} as const;

/**
 * Shell flyouts (Start menu, notification tray): shared width and vertical extent.
 * Matches Start menu panel geometry for visual consistency.
 */
export const DESKTOP_SHELL_FLYOUT = {
	/** Cap width at 560px with viewport margin — same as Start menu */
	WIDTH_CLASS: 'w-[min(560px,calc(100vw-2rem))]',
	/** Offset above taskbar strip (5rem) */
	BOTTOM_OFFSET_CLASS: 'bottom-20',
	/** Leave room for taskbar + breathing room */
	MAX_HEIGHT_CLASS: 'max-h-[calc(100vh-6rem)]',
	/** Horizontal inset for edge-anchored flyouts (notification tray on the right) */
	RIGHT_INSET_CLASS: 'right-4',
} as const;

/**
 * Shared desktop layout geometry.
 * Source of truth for shell spacing, taskbar reservation and viewport-based window sizing.
 */
export const DESKTOP_LAYOUT = {
	TASKBAR_HEIGHT_PX: TASKBAR.HEIGHT_PX,
	WINDOW_MARGIN_PX: 40,
	MAX_WINDOW_WIDTH_PX: 1200,
	MAX_WINDOW_HEIGHT_PX: 900,
} as const;

/** Совпадает с начальным `widget_position` в конфиге десктопа до первого переноса виджета. */
export const DESKTOP_FLOATING_WIDGET_POSITION_SEED = { x: 20, y: 20 } as const;

/** Approximate collapsed floating widget size in viewport px (w-75 / compact chrome). */
export const DESKTOP_FLOATING_WIDGET_VIEWPORT_SIZE = {
	width: 300,
	height: 132,
} as const;
