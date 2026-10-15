/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop icon tile surface classes aligned with window frame presets.
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
import type { DesktopIconStyle } from '../../../../types/profile';

const DESKTOP_ICON_APP_TILE = 'rounded-[1.25rem] overflow-hidden shrink-0';
const DESKTOP_ICON_FILE_TILE = 'rounded-xl overflow-hidden shrink-0';

/** Opaque icon tile helper aligned with {@link DESKTOP_FLAT_SHELL}. */
const DESKTOP_FLAT_ICON_SURFACE: { appBox: string; fileBox: string } = {
	appBox: cn(
		DESKTOP_ICON_APP_TILE,
		'border border-(--desktop-border-strong)',
		'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_100%)]',
		'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_rgba(0,0,0,0.4)] ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.09)]'
	),
	fileBox: cn(
		DESKTOP_ICON_FILE_TILE,
		'border border-(--desktop-border-strong)',
		'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_100%)] p-2',
		'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_22px_rgba(0,0,0,0.28)]'
	),
};

/**
 * Поверхности ярлыков (app / file / folder tile) — согласованы с {@link DESKTOP_WINDOW_FRAME_STYLES}.
 * `DesktopIcon` и превью в настройках импортируют отсюда, чтобы стиль иконок не расходился с окнами.
 */
export const DESKTOP_ICON_SURFACE_STYLES: Record<
	DesktopIconStyle,
	{ appBox: string; fileBox: string }
> = {
	glass: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border border-(--glass-border)',
			'bg-[radial-gradient(circle_at_12%_0%,rgb(var(--desktop-accent-rgb)/0.14),transparent_42%),radial-gradient(circle_at_88%_0%,rgba(255,255,255,0.1),transparent_30%),color-mix(in_srgb,var(--glass-bg-strong)_75%,rgb(var(--desktop-bg-primary-rgb))_25%)]',
			'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_30px_rgba(0,0,0,0.32)] ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.07)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border border-(--glass-border)',
			'bg-[color-mix(in_srgb,var(--glass-bg-strong)_70%,rgb(var(--desktop-bg-primary-rgb))_30%)] p-2',
			'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_22px_rgba(0,0,0,0.24)] ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.06)]'
		),
	},
	framed: DESKTOP_FLAT_ICON_SURFACE,
	minimal: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border border-(--desktop-border-subtle)',
			'bg-[color-mix(in_srgb,var(--glass-bg-strong)_78%,rgb(var(--desktop-bg-primary-rgb))_22%)]',
			'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_26px_rgba(0,0,0,0.28)] ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.05)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border border-(--desktop-border-subtle)',
			'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb))_0.97,transparent)] p-2',
			'shadow-[0_8px_20px_rgba(0,0,0,0.2)] ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.05)]'
		),
	},
	noir: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border border-(--desktop-chrome-noir-icon-border)',
			'[background-image:var(--desktop-chrome-noir-icon-app-bg)]',
			'shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_28px_rgba(15,23,42,0.14)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border border-(--desktop-chrome-noir-icon-border)',
			'[background-image:var(--desktop-chrome-noir-icon-file-bg)] p-2',
			'shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_10px_22px_rgba(15,23,42,0.12)]'
		),
	},
	neon: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border-2 border-[rgb(var(--desktop-accent-rgb)/0.72)]',
			'[background-image:var(--desktop-chrome-neon-icon-app-bg)]',
			'shadow-[0_0_0_1px_rgb(var(--desktop-fg-primary-rgb)/0.06),0_0_28px_-6px_rgb(var(--desktop-accent-rgb)/0.45),inset_0_1px_0_rgb(var(--desktop-accent-rgb)/0.12)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border-2 border-[rgb(var(--desktop-accent-rgb)/0.42)]',
			'[background-image:var(--desktop-chrome-neon-icon-file-bg)] p-2',
			'shadow-[0_0_16px_rgb(var(--desktop-accent-rgb)/0.22)]'
		),
	},
	paper: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_50%,transparent)]',
			'bg-[linear-gradient(178deg,color-mix(in_srgb,var(--desktop-paper-cream-soft)_34%,rgb(var(--desktop-bg-primary-rgb))_66%)_0%,color-mix(in_srgb,var(--desktop-paper-warm)_22%,rgb(var(--desktop-bg-primary-rgb))_78%)_100%)]',
			'shadow-[5px_5px_0_0_color-mix(in_srgb,var(--desktop-paper-ink)_14%,transparent),0_16px_36px_color-mix(in_srgb,var(--desktop-paper-ink)_18%,transparent)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_44%,transparent)]',
			'bg-[color-mix(in_srgb,var(--desktop-paper-highlight)_48%,rgb(var(--desktop-bg-primary-rgb))_52%)] p-2',
			'shadow-[4px_4px_0_0_color-mix(in_srgb,var(--desktop-paper-ink)_10%,transparent)]'
		),
	},
	aurora: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border-2 border-[rgba(168,85,247,0.42)]',
			'[background-image:var(--desktop-chrome-aurora-icon-app-bg)]',
			'shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_0_28px_-8px_rgba(168,85,247,0.32)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border-2 border-[rgba(168,85,247,0.34)]',
			'[background-image:var(--desktop-chrome-aurora-icon-file-bg)] p-2',
			'shadow-[0_0_18px_rgba(34,211,238,0.12)]'
		),
	},
	chameleon: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border border-(--glass-border)',
			'[background-image:var(--desktop-chrome-chameleon-icon-app-bg)]',
			'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_36px_rgba(0,0,0,0.34)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'min-h-0 border border-(--glass-border) p-2',
			'[background-image:var(--desktop-chrome-chameleon-icon-file-bg)]',
			'shadow-[0_10px_26px_rgba(0,0,0,0.22)]'
		),
	},
	premium: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border border-[rgba(212,175,106,0.34)]',
			'[background-image:var(--desktop-chrome-premium-icon-app-bg)]',
			'shadow-[0_0_0_1px_rgb(var(--desktop-fg-primary-rgb)/0.06),0_14px_32px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,250,240,0.4)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border border-[rgba(212,175,106,0.26)]',
			'[background-image:var(--desktop-chrome-premium-icon-file-bg)] p-2',
			'shadow-[inset_0_1px_0_rgba(255,250,240,0.35)]'
		),
	},
	prism: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border-2 border-[rgba(167,139,250,0.48)]',
			'bg-[linear-gradient(168deg,rgb(12,8,28)_0%,rgb(4,6,18)_100%)]',
			'shadow-[0_0_0_1px_rgba(244,114,182,0.2),0_12px_32px_rgba(0,0,0,0.5)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border-2 border-[rgba(167,139,250,0.4)]',
			'bg-[linear-gradient(145deg,rgba(56,189,248,0.16)_0%,rgb(12,8,28)_100%)] p-2',
			'shadow-[0_8px_20px_rgba(0,0,0,0.32)]'
		),
	},
	mercury: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border border-[rgba(255,255,255,0.42)]',
			'bg-[linear-gradient(138deg,#f8fafc_0%,#94a3b8_36%,#e2e8f0_54%,#64748b_82%,#f1f5f9_100%)]',
			'shadow-[inset_0_2px_10px_rgba(255,255,255,0.78),inset_0_-6px_14px_rgba(0,0,0,0.32),0_0_0_1px_rgba(0,0,0,0.28),0_14px_34px_rgba(0,0,0,0.52)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border border-[rgba(255,255,255,0.36)]',
			'bg-[linear-gradient(145deg,rgb(248,250,252)_0%,rgb(100,116,139)_100%)] p-2',
			'shadow-[inset_0_1px_0_rgba(255,255,255,0.58),0_0_0_1px_rgba(0,0,0,0.22)]'
		),
	},
	vhs: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border border-fuchsia-500/45',
			'bg-[linear-gradient(180deg,rgb(30,5,48)_0%,rgb(15,23,42)_55%,rgb(2,6,23)_100%)]',
			'shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_12px_30px_rgba(0,0,0,0.65)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border border-cyan-400/38',
			'bg-[linear-gradient(180deg,rgb(30,5,48)_0%,rgb(2,6,23)_100%)] p-2',
			'shadow-[0_8px_18px_rgba(0,0,0,0.36)]'
		),
	},
	/** Static icon packs — no CSS animation / shimmer. */
	slate: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border border-[rgba(148,163,184,0.42)]',
			'bg-[linear-gradient(180deg,rgb(51,65,85)_0%,rgb(30,41,59)_100%)]',
			'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(0,0,0,0.4)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border border-[rgba(148,163,184,0.36)]',
			'bg-[linear-gradient(180deg,rgb(51,65,85)_0%,rgb(30,41,59)_100%)] p-2',
			'shadow-[0_8px_18px_rgba(0,0,0,0.32)]'
		),
	},
	clay: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border border-[rgba(180,120,90,0.45)]',
			'bg-[linear-gradient(168deg,rgb(92,58,42)_0%,rgb(58,36,28)_100%)]',
			'shadow-[inset_0_1px_0_rgba(255,220,190,0.12),0_10px_24px_rgba(0,0,0,0.42)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border border-[rgba(180,120,90,0.4)]',
			'bg-[linear-gradient(168deg,rgb(92,58,42)_0%,rgb(58,36,28)_100%)] p-2',
			'shadow-[0_8px_18px_rgba(0,0,0,0.34)]'
		),
	},
	ember: {
		appBox: cn(
			DESKTOP_ICON_APP_TILE,
			'border border-[rgba(245,158,11,0.42)]',
			'bg-[linear-gradient(168deg,rgb(28,16,10)_0%,rgb(12,8,6)_100%)]',
			'shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_10px_26px_rgba(0,0,0,0.5)]'
		),
		fileBox: cn(
			DESKTOP_ICON_FILE_TILE,
			'border border-[rgba(245,158,11,0.36)]',
			'bg-[linear-gradient(168deg,rgb(28,16,10)_0%,rgb(12,8,6)_100%)] p-2',
			'shadow-[0_8px_18px_rgba(0,0,0,0.4)]'
		),
	},
};

/** Лёгкий хелпер для превью и ярлыков — одна точка для app/file tile классов. */
export function getDesktopIconSurfaceClasses(iconStyle: DesktopIconStyle): {
	appBox: string;
	fileBox: string;
} {
	return (
		DESKTOP_ICON_SURFACE_STYLES[iconStyle] ?? DESKTOP_ICON_SURFACE_STYLES.glass
	);
}
