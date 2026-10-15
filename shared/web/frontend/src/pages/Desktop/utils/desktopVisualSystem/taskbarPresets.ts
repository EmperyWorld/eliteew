/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Taskbar style presets and panel-opacity overlay weights for desktop shell chrome.
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
import type { CSSProperties } from 'react';
import type { DesktopTaskbarStyle } from '../../../../types/profile';

interface DesktopTaskbarStylePreset {
	dividerClass: string;
	buttonSurface: string;
	buttonActiveSurface: string;
	surfaceClassName: string;
	surfaceStyle: CSSProperties;
}

/** Taskbar chrome buttons: higher contrast than generic `--desktop-surface-soft` (too washed out). */
const TB_TASKBAR_BUTTONS = {
	buttonSurface:
		'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb))_10%,transparent)] fine-hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb))_16%,transparent)] border border-[rgb(var(--desktop-fg-primary-rgb)/0.14)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]',
	buttonActiveSurface:
		'bg-[rgb(var(--desktop-accent-rgb)/0.24)] fine-hover:bg-[rgb(var(--desktop-accent-rgb)/0.32)] border border-[rgb(var(--desktop-accent-rgb)/0.45)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]',
} as const;

/** Кнопки таскбара в духе premium titlebar / controlGroup (золото; light/dark via chrome vars). */
const TB_TASKBAR_PREMIUM_BUTTONS = {
	buttonSurface:
		'bg-(--desktop-chrome-premium-button-bg) fine-hover:bg-(--desktop-chrome-premium-button-hover-bg) border border-[rgba(212,175,106,0.28)] shadow-[inset_0_1px_0_rgba(255,250,240,0.35)]',
	buttonActiveSurface:
		'bg-[rgba(212,175,106,0.26)] fine-hover:bg-[rgba(212,175,106,0.34)] border border-[rgba(212,175,106,0.48)] shadow-[inset_0_1px_0_rgba(255,250,240,0.25)]',
} as const;

/** Opaque framed taskbar helper — same surface as {@link DESKTOP_TASKBAR_STYLE_PRESETS}.framed. */
export const DESKTOP_FLAT_TASKBAR: DesktopTaskbarStylePreset = {
	dividerClass: 'bg-(--desktop-border-strong)',
	...TB_TASKBAR_BUTTONS,
	surfaceClassName:
		'rounded-t-(--desktop-radius-shell) border-t border-(--desktop-border-strong)',
	surfaceStyle: {
		backgroundColor: 'var(--desktop-taskbar-bg-solid-color)',
		background: 'var(--desktop-taskbar-bg-solid)',
		borderTopColor: 'var(--desktop-taskbar-border-top)',
		boxShadow:
			'var(--desktop-taskbar-shadow-solid), inset 0 1px 0 rgba(255,255,255,0.06)',
		backgroundImage: 'none',
	},
};

/** Нижняя панель: те же ключи, что и `DesktopWindowStyle`, визуально согласованы с `shellFooterStrip` окон. */
export const DESKTOP_TASKBAR_STYLE_PRESETS: Record<
	DesktopTaskbarStyle,
	DesktopTaskbarStylePreset
> = {
	glass: {
		dividerClass: 'bg-(--desktop-border-subtle)',
		...TB_TASKBAR_BUTTONS,
		surfaceClassName:
			'rounded-t-(--desktop-radius-shell) border-t border-(--desktop-border-subtle)',
		surfaceStyle: {
			backgroundColor: 'var(--desktop-taskbar-bg-solid-color)',
			background: 'var(--desktop-taskbar-bg-glass)',
			borderTopColor: 'var(--desktop-taskbar-border-top)',
			boxShadow: 'var(--desktop-taskbar-shadow-glass)',
			backgroundImage: 'none',
		},
	},
	framed: DESKTOP_FLAT_TASKBAR,
	minimal: {
		dividerClass: 'bg-(--desktop-border-subtle)',
		...TB_TASKBAR_BUTTONS,
		surfaceClassName:
			'rounded-t-(--desktop-radius-shell) border-t border-(--desktop-border-subtle)',
		surfaceStyle: {
			backgroundColor: 'rgb(var(--desktop-bg-secondary-rgb))',
			background:
				'linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.97)_0%,rgb(var(--desktop-bg-primary-rgb)/0.97)_100%)',
			borderTopColor: 'var(--desktop-taskbar-border-top)',
			boxShadow:
				'0 -6px 24px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.04)',
			backgroundImage: 'none',
		},
	},
	noir: {
		dividerClass: 'bg-(--desktop-border-strong)',
		...TB_TASKBAR_BUTTONS,
		surfaceClassName:
			'rounded-t-(--desktop-radius-shell) border-t border-(--desktop-border-strong)',
		surfaceStyle: {
			background: 'var(--desktop-chrome-noir-taskbar-bg)',
			borderTopColor: 'var(--desktop-border-strong)',
			boxShadow: 'var(--desktop-chrome-noir-taskbar-shadow)',
			backgroundImage: 'none',
		},
	},
	neon: {
		dividerClass: 'bg-[rgb(var(--desktop-accent-rgb)/0.4)]',
		buttonSurface:
			'bg-[rgb(var(--desktop-accent-rgb)/0.16)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.24)] border border-[rgb(var(--desktop-accent-rgb)/0.32)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
		buttonActiveSurface:
			'bg-[rgb(var(--desktop-accent-rgb)/0.3)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.38)] border border-[rgb(var(--desktop-accent-rgb)/0.5)]',
		surfaceClassName:
			'rounded-t-(--desktop-radius-shell) border-t-2 border-[rgb(var(--desktop-accent-rgb)/0.38)]',
		surfaceStyle: {
			background: 'var(--desktop-chrome-neon-taskbar-bg)',
			borderTopColor: 'rgb(var(--desktop-accent-rgb)/0.35)',
			boxShadow: 'var(--desktop-chrome-neon-taskbar-shadow)',
			backgroundImage: 'none',
		},
	},
	paper: {
		dividerClass:
			'bg-[color-mix(in_srgb,var(--desktop-paper-edge)_35%,transparent)]',
		buttonSurface:
			'bg-[color-mix(in_srgb,var(--desktop-paper-edge)_14%,transparent)] hover:bg-[color-mix(in_srgb,var(--desktop-paper-edge)_22%,transparent)]',
		buttonActiveSurface:
			'bg-[color-mix(in_srgb,var(--desktop-paper-edge)_30%,transparent)]',
		surfaceClassName:
			'rounded-t-(--desktop-radius-shell) border-t-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_40%,transparent)]',
		surfaceStyle: {
			background:
				'linear-gradient(180deg,color-mix(in srgb,var(--desktop-paper-highlight) 22%,var(--desktop-surface-soft) 78%) 0%,color-mix(in srgb,var(--desktop-paper-warm) 18%,var(--desktop-surface-soft) 82%) 100%)',
			borderTopColor:
				'color-mix(in srgb, var(--desktop-paper-edge) 45%, transparent)',
			boxShadow:
				'4px -4px 0 0 rgba(80,48,20,0.1), 0 -6px 24px rgba(60,40,20,0.18)',
			backgroundImage: 'none',
		},
	},
	aurora: {
		dividerClass: 'bg-[rgba(168,85,247,0.4)]',
		...TB_TASKBAR_BUTTONS,
		surfaceClassName:
			'rounded-t-(--desktop-radius-shell) border-t-2 border-[rgba(34,211,238,0.35)]',
		surfaceStyle: {
			background: 'var(--desktop-chrome-aurora-taskbar-bg)',
			borderTopColor: 'rgba(34,211,238,0.28)',
			boxShadow:
				'0 -4px 28px rgba(168,85,247,0.16), 0 -1px 0 rgba(34,211,238,0.12)',
			backgroundImage: 'none',
		},
	},
	chameleon: {
		dividerClass: 'bg-(--desktop-border-subtle)',
		...TB_TASKBAR_BUTTONS,
		surfaceClassName:
			'rounded-t-(--desktop-radius-shell) border-t border-(--glass-border)/70',
		surfaceStyle: {
			background: 'var(--desktop-chrome-chameleon-taskbar-bg)',
			borderTopColor: 'var(--desktop-taskbar-border-top)',
			boxShadow: '0 -10px 36px rgba(0,0,0,0.42)',
			backgroundImage: 'none',
		},
	},
	premium: {
		dividerClass:
			'bg-[linear-gradient(180deg,rgba(212,175,106,0.5)_0%,rgba(212,175,106,0.14)_100%)]',
		...TB_TASKBAR_PREMIUM_BUTTONS,
		surfaceClassName:
			'rounded-t-(--desktop-radius-shell) border-t-2 border-[rgba(212,175,106,0.28)]',
		surfaceStyle: {
			background: 'var(--desktop-chrome-premium-taskbar-bg)',
			borderTopColor: 'rgba(212,175,106,0.32)',
			boxShadow: 'var(--desktop-chrome-premium-taskbar-shadow)',
			backgroundImage: 'none',
		},
	},
};

/**
 * Насколько ползунок «Непрозрачность панелей» (`desktop_panel_opacity`) добавляет
 * слой `var(--desktop-taskbar-bg-opaque)` поверх фона таскбара.
 * — **glass**: 0 — ползунок на плотность не влияет (opaque glass preset).
 * — **framed**: рамка уже плотная — 0.
 * — остальное: 1 — на максимуме ползунка панель непрозрачная.
 */
export const TASKBAR_PANEL_OPACITY_OVERLAY_WEIGHT: Record<
	DesktopTaskbarStyle,
	number
> = {
	glass: 0,
	framed: 0,
	minimal: 1,
	noir: 1,
	neon: 1,
	paper: 1,
	aurora: 1,
	chameleon: 1,
	premium: 1,
};
