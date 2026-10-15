/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop icon visual style presets (idle/selected/halo/boxes) and settings preview sample apps.
 *
 * Invariants:
 * - Box styles spread from DESKTOP_ICON_SURFACE_STYLES; label class shared across presets.
 *
 * Related:
 * - utils/desktopVisualSystem.ts
 * - settings/DesktopSettingsIconPreviews.tsx
 */

import type { DesktopIconStyle } from '@/types/profile';
import { DESKTOP_ICON_SURFACE_STYLES } from '../../utils/desktopVisualSystem';

const ICON_LABEL_CLASS =
	'desktop-icon-label mt-2 text-center text-(--desktop-text-primary) font-semibold leading-[1.15] tracking-[0.01em]';

/** Сетка ярлыков — рамка/фон из {@link DESKTOP_ICON_SURFACE_STYLES} (согласовано с окнами). */
export const ICON_VISUAL_STYLES: Record<
	DesktopIconStyle,
	{
		idle: string;
		selected: string;
		halo: string;
		appBox: string;
		fileBox: string;
		label: string;
	}
> = {
	glass: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgb(var(--desktop-fg-primary-rgb)/0.09)] border border-(--desktop-border-subtle) shadow-(--desktop-shadow-panel) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.28)]',
		halo: 'bg-[rgb(var(--desktop-accent-rgb)/0.1)]',
		...DESKTOP_ICON_SURFACE_STYLES.glass,
		label: ICON_LABEL_CLASS,
	},
	framed: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgb(var(--desktop-fg-primary-rgb)/0.08)] border border-(--desktop-border-strong) shadow-(--desktop-shadow-panel) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.22)]',
		halo: 'bg-[rgb(var(--desktop-fg-primary-rgb)/0.06)]',
		...DESKTOP_ICON_SURFACE_STYLES.framed,
		label: ICON_LABEL_CLASS,
	},
	minimal: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgb(var(--desktop-fg-primary-rgb)/0.08)] border border-(--desktop-border-subtle) shadow-(--desktop-shadow-soft) ring-1 ring-(--desktop-border-strong)',
		halo: 'bg-[rgb(var(--desktop-fg-primary-rgb)/0.05)]',
		...DESKTOP_ICON_SURFACE_STYLES.minimal,
		label: ICON_LABEL_CLASS,
	},
	noir: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.2)] shadow-[0_16px_40px_rgba(0,0,0,0.55)] ring-1 ring-[rgba(255,255,255,0.18)]',
		halo: 'bg-[rgba(255,255,255,0.04)]',
		...DESKTOP_ICON_SURFACE_STYLES.noir,
		label: ICON_LABEL_CLASS,
	},
	neon: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgb(var(--desktop-accent-rgb)/0.12)] border border-[rgb(var(--desktop-accent-rgb)/0.42)] shadow-[0_0_28px_rgb(var(--desktop-accent-rgb)/0.28)] ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.38)]',
		halo: 'bg-[rgb(var(--desktop-accent-rgb)/0.18)]',
		...DESKTOP_ICON_SURFACE_STYLES.neon,
		label: ICON_LABEL_CLASS,
	},
	paper: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[color-mix(in_srgb,var(--desktop-paper-cream)_35%,rgb(var(--desktop-bg-primary-rgb))_65%)] border-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_58%,transparent)] shadow-[6px_6px_0_0_rgba(80,48,20,0.16)] ring-2 ring-[color-mix(in_srgb,var(--desktop-paper-ring)_42%,transparent)]',
		halo: 'bg-[color-mix(in_srgb,var(--desktop-paper-cream-soft)_40%,transparent)]',
		...DESKTOP_ICON_SURFACE_STYLES.paper,
		label: ICON_LABEL_CLASS,
	},
	aurora: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgba(168,85,247,0.12)] border-2 border-[rgba(168,85,247,0.4)] shadow-[0_0_32px_rgba(168,85,247,0.28)] ring-2 ring-[rgba(192,132,252,0.42)]',
		halo: 'bg-[rgba(34,211,238,0.1)]',
		...DESKTOP_ICON_SURFACE_STYLES.aurora,
		label: ICON_LABEL_CLASS,
	},
	chameleon: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgb(var(--desktop-fg-primary-rgb)/0.09)] border border-[var(--glass-border)] shadow-(--desktop-shadow-panel) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.26)]',
		halo: 'bg-[rgb(var(--desktop-accent-rgb)/0.08)]',
		...DESKTOP_ICON_SURFACE_STYLES.chameleon,
		label: ICON_LABEL_CLASS,
	},
	premium: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgba(212,175,106,0.1)] border border-[rgba(212,175,106,0.36)] shadow-[0_20px_48px_rgba(0,0,0,0.45)] ring-1 ring-[rgba(212,175,106,0.32)]',
		halo: 'bg-[rgba(212,175,106,0.08)]',
		...DESKTOP_ICON_SURFACE_STYLES.premium,
		label: ICON_LABEL_CLASS,
	},
	prism: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgba(167,139,250,0.1)] border-2 border-[rgba(56,189,248,0.38)] shadow-[0_0_32px_rgba(167,139,250,0.32)] ring-2 ring-[rgba(244,114,182,0.28)]',
		halo: 'bg-[rgba(34,211,238,0.08)]',
		...DESKTOP_ICON_SURFACE_STYLES.prism,
		label: ICON_LABEL_CLASS,
	},
	mercury: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.28)] shadow-[0_16px_42px_rgba(0,0,0,0.48)] ring-1 ring-[rgba(255,255,255,0.2)]',
		halo: 'bg-[rgba(255,255,255,0.05)]',
		...DESKTOP_ICON_SURFACE_STYLES.mercury,
		label: ICON_LABEL_CLASS,
	},
	vhs: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgba(236,72,153,0.12)] border border-[rgba(34,211,238,0.42)] shadow-[0_0_28px_rgba(236,72,153,0.24)] ring-1 ring-[rgba(34,211,238,0.28)]',
		halo: 'bg-[rgba(34,211,238,0.09)]',
		...DESKTOP_ICON_SURFACE_STYLES.vhs,
		label: ICON_LABEL_CLASS,
	},
	slate: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgba(148,163,184,0.12)] border border-[rgba(148,163,184,0.4)] shadow-[0_12px_28px_rgba(0,0,0,0.36)] ring-1 ring-[rgba(148,163,184,0.28)]',
		halo: 'bg-[rgba(148,163,184,0.08)]',
		...DESKTOP_ICON_SURFACE_STYLES.slate,
		label: ICON_LABEL_CLASS,
	},
	clay: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgba(196,140,100,0.14)] border border-[rgba(196,140,100,0.42)] shadow-[0_12px_28px_rgba(0,0,0,0.38)] ring-1 ring-[rgba(196,140,100,0.3)]',
		halo: 'bg-[rgba(196,140,100,0.1)]',
		...DESKTOP_ICON_SURFACE_STYLES.clay,
		label: ICON_LABEL_CLASS,
	},
	ember: {
		idle: 'border border-transparent bg-transparent shadow-none',
		selected:
			'bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.42)] shadow-[0_12px_28px_rgba(0,0,0,0.4)] ring-1 ring-[rgba(245,158,11,0.28)]',
		halo: 'bg-[rgba(245,158,11,0.1)]',
		...DESKTOP_ICON_SURFACE_STYLES.ember,
		label: ICON_LABEL_CLASS,
	},
};

/**
 * Примеры `appComponent` для карточек «Стиль иконок» в настройках (разные мотивы и палитры).
 */
export const ICON_STYLE_CARD_SAMPLE_APPS = [
	'AppStore',
	'SocialHubApp',
	'MusicPlayer',
	'ImageStudio',
] as const;
