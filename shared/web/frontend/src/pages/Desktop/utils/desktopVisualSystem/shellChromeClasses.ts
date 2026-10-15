/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell class helpers for nav rails, panels, toolbars, forms, widgets, and floating menus.
 *
 * Invariants:
 * - App component visual identities remain stable for persisted desktop items.
 * - Every DesktopWindowStyle key keeps a distinct premium look; no backdrop-filter / chameleon motion.
 * - No infinite CSS animation on window, taskbar, or widget chrome.
 * - Chrome gradient tokens (`--desktop-chrome-*-bg`) use `[background-image:var(--…)]`,
 *   never Tailwind `bg-(--…)` (that emits `background-color`, which drops gradients).
 *
 * Related:
 * - `pages/Desktop/utils/desktopVisualSystem.tsx` (public barrel)
 * - `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`
 */
import { cn } from '@/utils/cn';
import type {
	DesktopWidgetsStyle,
	DesktopWindowStyle,
} from '../../../../types/profile';
import {
	DESKTOP_WINDOW_FRAME_STYLES,
	getDesktopWindowShellTier,
} from './windowFramePresets';

/** Левая колонка навигации модалок оболочки; glass — тот же фон/блюр, что у `frame`, чтобы рельс не терялся на фоне контента. */
export function getDesktopShellNavRailClassName(
	windowStyle: DesktopWindowStyle
): string {
	return (
		DESKTOP_WINDOW_FRAME_STYLES[windowStyle] ??
		DESKTOP_WINDOW_FRAME_STYLES.glass
	).shellNavRail;
}

/**
 * Правая колонка (предпросмотр, AI-панель) — зеркало {@link getDesktopShellNavRailClassName}: `border-l` и inset-тень слева.
 */
export function getDesktopShellEastColumnClassName(
	windowStyle: DesktopWindowStyle
): string {
	const rail = getDesktopShellNavRailClassName(windowStyle);
	return rail
		.replace(/\bborder-r\b/g, 'border-l')
		.replace(/inset_-1px_0_0/g, 'inset_1px_0_0');
}

/** Нижние полосы Пуска и аналогичные разделители. */
export function getDesktopShellFooterStripClassName(
	windowStyle: DesktopWindowStyle
): string {
	return (
		DESKTOP_WINDOW_FRAME_STYLES[windowStyle] ??
		DESKTOP_WINDOW_FRAME_STYLES.glass
	).shellFooterStrip;
}

/**
 * Верхняя полоса (баннер Settings / под titlebar) — зеркало
 * {@link getDesktopShellFooterStripClassName} с `border-b` вместо `border-t`.
 * Uses per-style chrome tokens (`--desktop-chrome-*`) so light/dark packs apply.
 */
export function getDesktopShellHeaderStripClassName(
	windowStyle: DesktopWindowStyle
): string {
	return getDesktopShellFooterStripClassName(windowStyle)
		.replace(/\bborder-t-2\b/g, 'border-b-2')
		.replace(/\bborder-t\b/g, 'border-b');
}

/**
 * Opaque floating surface (menus, compact popovers on `document.body`).
 * Prefer with {@link DesktopShellFloatingPortal} or `getDesktopPortalShellProps()`.
 */
export function getDesktopShellFloatingSurfaceClassName(
	windowStyle: DesktopWindowStyle
): string {
	return getDesktopShellFloatingMenuSurfaceTierClasses(
		getDesktopWindowShellTier(windowStyle)
	);
}

/**
 * {@link DESKTOP_WINDOW_FRAME_STYLES}.frame uses alpha gradients — fine inside window chrome,
 * unreadable over chat/desktop wallpaper without an opaque parent.
 */
function getDesktopShellFloatingMenuSurfaceTierClasses(
	tier: ReturnType<typeof getDesktopWindowShellTier>
): string {
	switch (tier) {
		case 'glass':
			return cn(
				'border border-(--glass-border)',
				'bg-[rgb(var(--desktop-bg-secondary-rgb))]',
				'shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.08),0_28px_72px_rgba(0,0,0,0.52)]'
			);
		case 'framed':
			return cn(
				'border border-(--desktop-border-strong)',
				'bg-[rgb(var(--desktop-bg-secondary-rgb))]',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_36px_90px_rgba(0,0,0,0.56)]'
			);
		default:
			return cn(
				'border border-(--desktop-border-subtle)',
				'bg-[rgb(var(--desktop-bg-secondary-rgb))]',
				'shadow-[0_28px_66px_rgba(0,0,0,0.5)]'
			);
	}
}

/**
 * ПКМ и выпадающие меню на `document.body` — **непрозрачный** фон (см. floating-menu canon
 * в `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md` §Floating portal surfaces).
 */
export function getDesktopShellContextMenuClassName(
	windowStyle: DesktopWindowStyle,
	options?: { clipOverflow?: boolean }
): string {
	const clipOverflow = options?.clipOverflow !== false;
	const tier = getDesktopWindowShellTier(windowStyle);
	return cn(
		'min-h-0 min-w-[220px] rounded-(--desktop-radius-lg) py-1 text-(--desktop-text-primary)',
		clipOverflow ? 'overflow-hidden' : 'overflow-visible',
		getDesktopShellFloatingMenuSurfaceTierClasses(tier)
	);
}

/** Карточка файла в сетке (контент-менеджер), не выбрана — под пресетом окон. */
export function getDesktopShellFileCardRootIdleClassName(
	windowStyle: DesktopWindowStyle
): string {
	switch (getDesktopWindowShellTier(windowStyle)) {
		case 'glass':
			return cn(
				'border border-(--glass-border)',
				'bg-[radial-gradient(circle_at_12%_0%,rgb(var(--desktop-accent-rgb)/0.07),transparent_40%),color-mix(in_srgb,var(--glass-bg-strong)_65%,transparent_35%)]',
				'shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]',
				'hover:border-[rgb(var(--desktop-accent-rgb)/0.28)] hover:shadow-(--desktop-shadow-soft)'
			);
		case 'framed':
			return cn(
				'border border-(--desktop-border-strong)',
				'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.82)_0%,rgb(var(--desktop-bg-primary-rgb)/0.78)_100%)]',
				'hover:border-[rgb(var(--desktop-accent-rgb)/0.28)] hover:shadow-(--desktop-shadow-soft)'
			);
		default:
			return cn(
				'border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)',
				'hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-panel-strong) hover:shadow-(--desktop-shadow-soft)'
			);
	}
}

/** Зона превью (aspect) на карточке файла. */
export function getDesktopShellFileCardThumbClassName(
	windowStyle: DesktopWindowStyle
): string {
	switch (getDesktopWindowShellTier(windowStyle)) {
		case 'glass':
			return cn(
				'border-b border-(--glass-border)',
				'bg-[color-mix(in_srgb,var(--glass-bg-strong)_48%,rgb(var(--desktop-bg-primary-rgb)/0.22))]'
			);
		case 'framed':
			return cn(
				'border-b border-(--desktop-border-strong)',
				'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.5)_0%,rgb(var(--desktop-bg-primary-rgb)/0.42)_100%)]'
			);
		default:
			return 'border-b border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)';
	}
}

/** Нижний блок метаданных на карточке файла. */
export function getDesktopShellFileCardMetaClassName(
	windowStyle: DesktopWindowStyle
): string {
	switch (getDesktopWindowShellTier(windowStyle)) {
		case 'glass':
			return cn(
				'border-t border-[rgba(255,255,255,0.07)]',
				'bg-[color-mix(in_srgb,var(--glass-bg-strong)_38%,transparent)]'
			);
		case 'framed':
			return cn(
				'border-t border-(--desktop-border-subtle)',
				'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb))_0.4,transparent)]'
			);
		default:
			return 'border-t border-(--desktop-border-subtle)';
	}
}

/** Кластер вкладок / действий в шапке контент-менеджера (embedded). */
export function getDesktopShellToolbarClusterClassName(
	windowStyle: DesktopWindowStyle
): string {
	switch (getDesktopWindowShellTier(windowStyle)) {
		case 'glass':
			return cn(
				'border border-(--glass-border)',
				'bg-[radial-gradient(circle_at_12%_0%,rgb(var(--desktop-accent-rgb)/0.06),transparent_42%),color-mix(in_srgb,var(--glass-bg-strong)_58%,transparent_42%)]',
				'shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.07)]'
			);
		case 'framed':
			return cn(
				'border border-(--desktop-border-strong)',
				'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.78)_0%,rgb(var(--desktop-bg-primary-rgb)/0.74)_100%)]'
			);
		default:
			return cn(
				'border border-(--desktop-border-subtle)',
				'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb))_0.94,transparent)]'
			);
	}
}

/**
 * Поля внутри уже оформленного {@link getDesktopShellToolbarClusterClassName} — без второй «карточки»
 * (селекты компании/проекта/файла в шапке маркетингового кабинета).
 */
export function getDesktopShellToolbarClusterInsetControlClassName(
	windowStyle: DesktopWindowStyle
): string {
	switch (getDesktopWindowShellTier(windowStyle)) {
		case 'glass':
			return cn(
				'border border-(--glass-border)/40',
				'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)]',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
				'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.09)_100%,transparent)]'
			);
		case 'framed':
			return cn(
				'border border-(--desktop-border-subtle)/60',
				'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.38)_0%,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%)]',
				'hover:border-(--desktop-border-strong)/75'
			);
		default:
			return cn(
				'border border-(--desktop-border-subtle)/65',
				'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.2)_100%,transparent)]',
				'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%,transparent)]'
			);
	}
}

/** `<select>` и поля в той же строке — согласованы с кластером. */
export function getDesktopShellFormSelectClassName(
	windowStyle: DesktopWindowStyle
): string {
	switch (getDesktopWindowShellTier(windowStyle)) {
		case 'glass':
			return cn(
				'border-(--glass-border)',
				'bg-[color-mix(in_srgb,var(--glass-bg-strong)_52%,rgb(var(--desktop-bg-primary-rgb)/0.28))]'
			);
		case 'framed':
			return cn(
				'border-(--desktop-border-strong)',
				'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.62)_0%,rgb(var(--desktop-bg-primary-rgb)/0.52)_100%)]'
			);
		default:
			return 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel)';
	}
}

/**
 * Пункты выпадающего списка нативного `<select>` (где браузер позволяет) — фон и текст как у панелей десктопа.
 * Стили в `src/styles/index.css` (`.desktop-native-select-option`), не inline — webhint no-inline-styles.
 */
export const DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME =
	'desktop-native-select-option';

/**
 * Закрытый `<select>` в приложениях рабочего стола: бордер/фон по {@link getDesktopShellFormSelectClassName},
 * плотность, фокус, `appearance-none` (стрелку рисует компонент `DesktopNativeSelect` в DesktopAppChrome).
 */
export function getDesktopNativeSelectControlClassName(
	shellFrame: DesktopWindowStyle
): string {
	return cn(
		getDesktopShellFormSelectClassName(shellFrame),
		'min-h-[2.25rem] w-full min-w-[10rem] max-w-full rounded-(--desktop-radius)',
		'px-2.5 py-1.5 text-xs font-medium leading-normal text-[var(--desktop-text-primary)]',
		'shadow-[var(--desktop-shadow-soft)]',
		'transition-[border-color,box-shadow,background-color] duration-150',
		'focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.22)] focus:border-[rgb(var(--desktop-accent-rgb)/0.45)]',
		'disabled:cursor-not-allowed disabled:opacity-50',
		'appearance-none cursor-pointer pr-8 pl-2.5',
		'scheme-dark'
	);
}

/** `<input type="checkbox">` в формах внутри оболочки — тот же язык, что у {@link getDesktopShellToolbarClusterInsetControlClassName}. */
export function getDesktopShellCheckboxControlClassName(
	windowStyle: DesktopWindowStyle
): string {
	switch (getDesktopWindowShellTier(windowStyle)) {
		case 'glass':
			return cn(
				'border border-(--glass-border)/40',
				'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)]',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
				'accent-(--mc-accent)'
			);
		case 'framed':
			return cn(
				'border border-(--desktop-border-subtle)/60',
				'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.38)_0%,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%)]',
				'accent-(--mc-accent)'
			);
		default:
			return cn(
				'border border-(--desktop-border-subtle)/65',
				'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.2)_100%,transparent)]',
				'accent-(--mc-accent)'
			);
	}
}

/**
 * Фон дорожки индикатора прогресса внутри glass-карточек (обзор покрытия, целостность стратегии и т.п.).
 * Согласован с {@link getDesktopShellToolbarClusterInsetControlClassName} без hover.
 */
export function getDesktopShellProgressTrackClassName(
	windowStyle: DesktopWindowStyle
): string {
	switch (getDesktopWindowShellTier(windowStyle)) {
		case 'glass':
			return cn(
				'border border-(--glass-border)/40',
				'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)]',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
			);
		case 'framed':
			return cn(
				'border border-(--desktop-border-subtle)/60',
				'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.38)_0%,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%)]'
			);
		default:
			return cn(
				'border border-(--desktop-border-subtle)/65',
				'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.2)_100%,transparent)]'
			);
	}
}

/** Строки опций в выпадающем списке маркетингового кабинета — hover/highlight под {@link DesktopWindowStyle}. */
export function getDesktopShellSelectListOptionInteractiveClassName(
	windowStyle: DesktopWindowStyle
): { hoverFocus: string; highlight: string } {
	switch (getDesktopWindowShellTier(windowStyle)) {
		case 'glass':
			return {
				hoverFocus:
					'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] focus-visible:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)]',
				highlight:
					'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.07)_100%,transparent)]',
			};
		case 'framed':
			return {
				hoverFocus:
					'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-bg-secondary-rgb)/0.22)_100%,transparent)] focus-visible:bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.2)_100%,transparent)]',
				highlight:
					'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.16)_100%,transparent)]',
			};
		default:
			return {
				hoverFocus:
					'hover:bg-(--desktop-surface-soft-hover) focus-visible:bg-(--desktop-surface-soft-active)',
				highlight: 'bg-(--desktop-surface-soft)',
			};
	}
}

/**
 * Strong window presets keep a distinct nested surface (not collapsed into glass/framed/minimal).
 * Shared by content panels, Settings form cards, and framed {@link DesktopAppContentWrapper}.
 */
function getDesktopShellDistinctNestedSurfaceClassName(
	windowStyle: DesktopWindowStyle
): string | null {
	switch (windowStyle) {
		case 'noir':
			return cn(
				'rounded-(--desktop-radius-lg)',
				'border border-(--desktop-chrome-noir-card-border)',
				'[background-image:var(--desktop-chrome-noir-card-bg)]',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]'
			);
		case 'neon':
			return cn(
				'rounded-(--desktop-radius-lg)',
				'border border-[rgb(var(--desktop-accent-rgb)/0.38)]',
				'[background-image:var(--desktop-chrome-neon-card-bg)]',
				'shadow-[inset_0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.12)]'
			);
		case 'paper':
			return cn(
				'rounded-(--desktop-radius-lg)',
				'border-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_35%,transparent)]',
				'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--desktop-paper-highlight)_58%,rgb(var(--desktop-bg-primary-rgb))_42%)_0%,color-mix(in_srgb,var(--desktop-paper-warm)_48%,rgb(var(--desktop-bg-primary-rgb))_52%)_100%)]',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]'
			);
		case 'aurora':
			return cn(
				'rounded-(--desktop-radius-lg)',
				'border border-(--desktop-chrome-aurora-card-border)',
				'[background-image:var(--desktop-chrome-aurora-card-bg)]',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]'
			);
		case 'chameleon':
			return cn(
				'rounded-xl min-h-0',
				'border border-[var(--glass-border)]',
				'[background-image:var(--desktop-chrome-chameleon-card-bg)]',
				'shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.06),0_10px_26px_rgba(0,0,0,0.18)]'
			);
		case 'premium':
			return cn(
				'rounded-(--desktop-radius-lg)',
				'border border-[rgba(212,175,106,0.28)]',
				'[background-image:var(--desktop-chrome-premium-card-bg)]',
				'shadow-[inset_0_1px_0_rgba(255,250,240,0.5)]'
			);
		default:
			return null;
	}
}

/**
 * Root fill for apps inside EnhancedWindow — keep transparent so
 * {@link DESKTOP_WINDOW_FRAME_STYLES}.content (and framed content panels) show through.
 * Standalone full-page routes should keep `bg-(--desktop-surface-app)` themselves.
 */
export function getDesktopShellEmbeddedAppRootClassName(): string {
	return 'flex h-full min-h-0 flex-col overflow-hidden bg-transparent text-(--desktop-text-primary) antialiased';
}

/**
 * Внутренние карточки / framed app surface — согласованы с пресетом окон.
 * Strong presets (noir/neon/paper/aurora/chameleon/premium) stay distinct;
 * glass/framed/minimal use {@link getDesktopWindowShellTier}.
 */
export function getDesktopShellContentPanelClassName(
	windowStyle: DesktopWindowStyle
): string {
	const distinct = getDesktopShellDistinctNestedSurfaceClassName(windowStyle);
	if (distinct) return distinct;

	switch (getDesktopWindowShellTier(windowStyle)) {
		case 'glass':
			return cn(
				'rounded-(--desktop-radius-lg)',
				'border border-(--glass-border)',
				'bg-[radial-gradient(circle_at_12%_0%,rgb(var(--desktop-accent-rgb)/0.06),transparent_40%),color-mix(in_srgb,var(--glass-bg-strong)_58%,transparent_42%)]',
				'shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.06)] shadow-(--desktop-shadow-soft)'
			);
		case 'framed':
			return cn(
				'rounded-(--desktop-radius-lg)',
				'border border-(--desktop-border-strong)',
				'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_100%)]',
				'shadow-(--desktop-shadow-soft)'
			);
		default:
			return cn(
				'rounded-(--desktop-radius-lg)',
				'border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)',
				'shadow-(--desktop-shadow-soft)'
			);
	}
}

/**
 * Правая колонка «Центра управления»: заметнее, чем {@link DESKTOP_WINDOW_FRAME_STYLES}.content.
 * Strong presets use `--desktop-chrome-*-content-bg` (light/dark packs from {@link getDesktopThemeVars}).
 */
export function getDesktopShellSettingsMainColumnClassName(
	windowStyle: DesktopWindowStyle
): string {
	const preset =
		DESKTOP_WINDOW_FRAME_STYLES[windowStyle] ??
		DESKTOP_WINDOW_FRAME_STYLES.glass;
	switch (windowStyle) {
		case 'paper':
			return cn(
				'border-l border-[color-mix(in_srgb,var(--desktop-paper-edge)_32%,transparent)]',
				'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--desktop-paper-highlight)_62%,rgb(var(--desktop-bg-primary-rgb))_38%)_0%,color-mix(in_srgb,var(--desktop-paper-warm)_52%,rgb(var(--desktop-bg-primary-rgb))_48%)_100%)]',
				'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--desktop-paper-edge)_14%,transparent)]'
			);
		case 'noir':
			return cn(
				'border-l border-(--desktop-chrome-noir-card-border)',
				'[background-image:var(--desktop-chrome-noir-content-bg)]'
			);
		case 'neon':
			return cn(
				'border-l border-[rgb(var(--desktop-accent-rgb)/0.4)]',
				'[background-image:var(--desktop-chrome-neon-content-bg)]',
				'shadow-[inset_0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.22)]'
			);
		case 'premium':
			return cn(
				'border-l border-[rgba(212,175,106,0.22)]',
				'[background-image:var(--desktop-chrome-premium-content-bg)]'
			);
		case 'aurora':
			return cn(
				'border-l border-(--desktop-chrome-aurora-card-border)',
				'[background-image:var(--desktop-chrome-aurora-content-bg)]'
			);
		case 'chameleon':
			return cn(
				'border-l border-(--glass-border)/55',
				'[background-image:var(--desktop-chrome-chameleon-content-bg)] min-h-0'
			);
		default:
			return cn('border-l border-(--desktop-border-subtle)/70', preset.content);
	}
}

/**
 * Карточки секций «Центра управления» — те же distinct surfaces, что и
 * {@link getDesktopShellContentPanelClassName}; для glass/framed/minimal — лёгкий accent hairline.
 */
export function getDesktopShellSettingsFormCardClassName(
	windowStyle: DesktopWindowStyle
): string {
	const distinct = getDesktopShellDistinctNestedSurfaceClassName(windowStyle);
	if (distinct) return distinct;

	return cn(
		getDesktopShellContentPanelClassName(windowStyle),
		'relative overflow-hidden',
		'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:rounded-full',
		'before:bg-[linear-gradient(90deg,transparent,rgb(var(--desktop-accent-rgb)/0.32),transparent)]',
		'after:pointer-events-none after:absolute after:inset-0 after:rounded-(--desktop-radius-lg) after:shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.04)]'
	);
}

/**
 * Выпадающее меню «Ещё» в GAF Chat — отдельно от {@link getDesktopShellContentPanelClassName}:
 * плоская панель без вертикального градиента «как у окна», чтобы читалось как компактный dropdown.
 */
export function getGafChatOverflowMenuSurfaceClassName(
	windowStyle: DesktopWindowStyle
): string {
	const tier = getDesktopWindowShellTier(windowStyle);
	const gafStripe = 'border-l-4 border-l-[rgb(var(--desktop-accent-rgb))]';
	const gafRound = 'overflow-hidden rounded-[var(--desktop-radius-lg)]';
	return cn(
		gafStripe,
		gafRound,
		getDesktopShellFloatingMenuSurfaceTierClasses(tier)
	);
}

export type DesktopShellPanelStrength = 'standard' | 'strong';

/**
 * Floating shell surfaces (Пуск, быстрый поиск, трей, центр уведомлений, подтверждения)
 * — те же пресеты рамки, что и у окон {@link DESKTOP_WINDOW_FRAME_STYLES}.
 */
export function getDesktopShellPanelClassName(
	windowStyle: DesktopWindowStyle,
	strength: DesktopShellPanelStrength = 'standard'
): string {
	const preset =
		DESKTOP_WINDOW_FRAME_STYLES[windowStyle] ??
		DESKTOP_WINDOW_FRAME_STYLES.glass;
	// framed/minimal уже задают тень в `frame`; glass — нет.
	const tier = getDesktopWindowShellTier(windowStyle);
	const extraShadow =
		tier === 'glass'
			? strength === 'strong'
				? 'shadow-[0_36px_88px_rgba(0,0,0,0.55)]'
				: 'shadow-[0_28px_72px_rgba(0,0,0,0.52)]'
			: '';
	return [
		'rounded-[var(--desktop-radius-shell)]',
		'overflow-hidden',
		preset.frame,
		extraShadow,
	]
		.filter(Boolean)
		.join(' ');
}

/** Корневой контейнер плавающего desktop-виджета по {@link DesktopWidgetsStyle} (те же ключи, что у окон). */
/** How the floating widget is anchored before a free position is saved. */
export function getDesktopWidgetRootClassName(
	widgetsStyle: DesktopWidgetsStyle,
	placement: 'preset-corner' | 'free' = 'preset-corner'
): string {
	const preset =
		DESKTOP_WINDOW_FRAME_STYLES[widgetsStyle] ??
		DESKTOP_WINDOW_FRAME_STYLES.glass;
	const tier = getDesktopWindowShellTier(widgetsStyle);
	const base =
		placement === 'preset-corner'
			? 'group absolute top-16 right-5 z-1 overflow-hidden'
			: 'group absolute z-1 overflow-hidden';
	const width = tier === 'minimal' ? 'w-72 min-w-72' : 'w-75 min-w-75';
	const radius =
		tier === 'minimal'
			? 'rounded-xl'
			: tier === 'framed'
				? 'rounded-2xl'
				: 'rounded-[1.45rem]';
	const extraShadow =
		tier === 'glass'
			? 'shadow-[0_18px_42px_rgba(2,6,23,0.32)]'
			: tier === 'framed'
				? 'shadow-[0_22px_50px_rgba(0,0,0,0.46)]'
				: 'shadow-[0_14px_34px_rgba(0,0,0,0.24)]';
	return [base, width, radius, preset.frame, extraShadow]
		.filter(Boolean)
		.join(' ');
}
