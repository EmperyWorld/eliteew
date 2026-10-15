/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Window frame / shell tier presets for DesktopWindowStyle keys (opaque static chrome).
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
import type { DesktopWindowStyle } from '../../../../types/profile';

interface DesktopWindowFramePreset {
	frame: string;
	active: string;
	inactive: string;
	shell: string;
	content: string;
	accentLine: string;
	/** Левая колонка навигации (центр управления рабочим столом и т.п.) */
	shellNavRail: string;
	/** Нижняя полоса Пуска, «горячие клавиши» и т.п. */
	shellFooterStrip: string;
}

/**
 * Семейство пресета для вложенных карточек/форм (не путать с уникальной рамкой окна).
 * `neon` / `aurora` / `chameleon` → glass; `noir` → framed; `paper` → minimal.
 */
export type DesktopWindowShellTier = 'glass' | 'framed' | 'minimal';

export function getDesktopWindowShellTier(
	windowStyle: DesktopWindowStyle
): DesktopWindowShellTier {
	switch (windowStyle) {
		case 'glass':
		case 'neon':
		case 'aurora':
		case 'chameleon':
		case 'premium':
			return 'glass';
		case 'framed':
		case 'noir':
			return 'framed';
		default:
			return 'minimal';
	}
}

/**
 * Opaque framed shell helper — matches {@link DESKTOP_WINDOW_FRAME_STYLES}.framed.
 * No backdrop-filter, no alpha glass, no infinite motion classes.
 */
export const DESKTOP_FLAT_SHELL: DesktopWindowFramePreset = {
	frame:
		'border border-(--desktop-border-strong) bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_28px_72px_rgba(0,0,0,0.55)]',
	active:
		'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.35)] shadow-[0_36px_88px_rgba(0,0,0,0.58)]',
	inactive: 'saturate-[0.96]',
	shell: '',
	content:
		'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_100%)]',
	accentLine:
		'bg-[linear-gradient(90deg,transparent_0%,rgb(var(--desktop-accent-rgb)/0.55)_22%,rgba(255,255,255,0.16)_50%,rgb(var(--desktop-accent-rgb)/0.45)_78%,transparent_100%)]',
	shellNavRail:
		'border-r border-(--desktop-border-strong) bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_100%)] shadow-[inset_-1px_0_0_rgb(var(--desktop-fg-primary-rgb)/0.1)]',
	shellFooterStrip:
		'border-t border-(--desktop-border-strong) bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
};

export const DESKTOP_WINDOW_FRAME_STYLES: Record<
	DesktopWindowStyle,
	DesktopWindowFramePreset
> = {
	glass: {
		frame:
			'border border-(--glass-border) bg-[radial-gradient(circle_at_12%_0%,rgb(var(--desktop-accent-rgb)/0.11),transparent_38%),radial-gradient(circle_at_88%_0%,rgba(255,255,255,0.09),transparent_28%),color-mix(in_srgb,var(--glass-bg-strong)_88%,rgb(var(--desktop-bg-primary-rgb))_12%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.11),0_26px_68px_rgba(0,0,0,0.5)]',
		active:
			'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.38)] shadow-[0_36px_88px_rgba(0,0,0,0.55)]',
		inactive: 'saturate-[0.96]',
		shell: '',
		content:
			'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.97)_0%,rgb(var(--desktop-bg-primary-rgb)/0.97)_100%)]',
		accentLine:
			'bg-[linear-gradient(90deg,transparent_0%,rgb(var(--desktop-accent-rgb)/0.42)_22%,rgba(255,255,255,0.12)_50%,rgb(var(--desktop-accent-rgb)/0.36)_78%,transparent_100%)] opacity-[0.78]',
		shellNavRail:
			'border-r border-(--glass-border) bg-[radial-gradient(circle_at_12%_0%,rgb(var(--desktop-accent-rgb)/0.1),transparent_38%),radial-gradient(circle_at_88%_0%,rgba(255,255,255,0.08),transparent_28%),color-mix(in_srgb,var(--glass-bg-strong)_88%,rgb(var(--desktop-bg-primary-rgb))_12%)] shadow-[inset_-1px_0_0_rgb(var(--desktop-fg-primary-rgb)/0.09)]',
		shellFooterStrip:
			'border-t border-(--glass-border)/70 bg-[radial-gradient(circle_at_50%_0%,rgb(var(--desktop-accent-rgb)/0.08),transparent_42%),color-mix(in_srgb,var(--glass-bg-strong)_36%,var(--desktop-surface-panel)_64%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
	},
	framed: DESKTOP_FLAT_SHELL,
	minimal: {
		frame:
			'border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--glass-bg-strong)_82%,rgb(var(--desktop-bg-primary-rgb))_18%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_66px_rgba(0,0,0,0.5)]',
		active:
			'ring-1 ring-[var(--desktop-border-strong)] shadow-[0_30px_76px_rgba(0,0,0,0.54)]',
		inactive: 'saturate-[0.9]',
		shell: '',
		content:
			'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-primary-rgb)/0.97)_0%,rgb(var(--desktop-bg-primary-rgb)/0.97)_100%)]',
		accentLine:
			'bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.14)_50%,transparent_100%)] opacity-[0.65]',
		shellNavRail:
			'border-r border-(--desktop-border-subtle) bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb))_0.97,transparent)] shadow-[inset_-1px_0_0_rgb(var(--desktop-fg-primary-rgb)/0.06)]',
		shellFooterStrip:
			'border-t border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_97%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
	},
	noir: {
		frame:
			'border border-(--desktop-border-strong) [background-image:var(--desktop-chrome-noir-frame-bg)] shadow-[0_28px_64px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.35)]',
		active:
			'ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.22)] shadow-[0_32px_72px_rgba(15,23,42,0.22)]',
		inactive: 'saturate-[0.92] contrast-[1.02]',
		shell: '',
		content: '[background-image:var(--desktop-chrome-noir-content-bg)]',
		accentLine:
			'bg-[linear-gradient(90deg,transparent_0%,rgb(var(--desktop-fg-primary-rgb)/0.18)_50%,transparent_100%)] opacity-[0.55]',
		shellNavRail:
			'border-r border-(--desktop-border-subtle) [background-image:var(--desktop-chrome-noir-frame-bg)] shadow-[inset_-1px_0_0_rgb(var(--desktop-fg-primary-rgb)/0.06)]',
		shellFooterStrip:
			'border-t border-(--desktop-border-subtle) [background-image:var(--desktop-chrome-noir-content-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
	},
	neon: {
		frame:
			'border-2 border-[rgb(var(--desktop-accent-rgb)/0.72)] [background-image:var(--desktop-chrome-neon-frame-bg)] shadow-[0_0_0_1px_rgb(var(--desktop-fg-primary-rgb)/0.06),0_0_40px_-10px_rgb(var(--desktop-accent-rgb)/0.45),inset_0_1px_0_rgb(var(--desktop-accent-rgb)/0.12)]',
		active:
			'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.5)] shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.35),0_0_48px_-4px_rgb(var(--desktop-accent-rgb)/0.55)]',
		inactive: 'saturate-[1.05]',
		shell: '',
		content:
			'[background-image:var(--desktop-chrome-neon-content-bg)] shadow-[inset_0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.16)]',
		accentLine:
			'bg-[linear-gradient(90deg,transparent_0%,rgb(var(--desktop-accent-rgb)/0.9)_15%,rgb(var(--desktop-accent-rgb)/0.35)_50%,rgb(var(--desktop-accent-rgb)/0.9)_85%,transparent_100%)] opacity-[0.98]',
		shellNavRail:
			'border-r-2 border-[rgb(var(--desktop-accent-rgb)/0.4)] [background-image:var(--desktop-chrome-neon-frame-bg)] shadow-[inset_-1px_0_12px_rgb(var(--desktop-accent-rgb)/0.12)]',
		shellFooterStrip:
			'border-t-2 border-[rgb(var(--desktop-accent-rgb)/0.32)] [background-image:var(--desktop-chrome-neon-content-bg)] shadow-[0_-8px_22px_-4px_rgb(var(--desktop-accent-rgb)/0.18)]',
	},
	paper: {
		frame:
			'border-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_52%,transparent)] bg-[linear-gradient(178deg,color-mix(in_srgb,var(--desktop-paper-cream-soft)_30%,rgb(var(--desktop-bg-primary-rgb))_70%)_0%,color-mix(in_srgb,var(--desktop-paper-warm)_20%,rgb(var(--desktop-bg-primary-rgb))_80%)_100%)] shadow-[7px_7px_0_0_color-mix(in_srgb,var(--desktop-paper-ink)_16%,transparent),0_22px_52px_color-mix(in_srgb,var(--desktop-paper-ink)_24%,transparent)]',
		active:
			'ring-2 ring-[color-mix(in_srgb,var(--desktop-paper-ring)_58%,transparent)] shadow-[9px_9px_0_0_color-mix(in_srgb,var(--desktop-paper-ink)_20%,transparent)]',
		inactive: 'saturate-[0.85]',
		shell: '',
		content:
			'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--desktop-paper-highlight)_38%,rgb(var(--desktop-bg-primary-rgb))_62%)_0%,color-mix(in_srgb,var(--desktop-paper-cream)_24%,rgb(var(--desktop-bg-primary-rgb))_76%)_100%)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--desktop-paper-edge)_14%,transparent)]',
		accentLine:
			'bg-[linear-gradient(90deg,transparent_0%,color-mix(in_srgb,var(--desktop-paper-edge)_26%,transparent)_50%,transparent_100%)] opacity-[0.85]',
		shellNavRail:
			'border-r-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_42%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--desktop-paper-highlight)_22%,rgb(var(--desktop-bg-primary-rgb))_78%)_0%,color-mix(in_srgb,var(--desktop-paper-warm)_18%,rgb(var(--desktop-bg-primary-rgb))_82%)_100%)] shadow-[inset_-2px_0_0_color-mix(in_srgb,var(--desktop-paper-edge)_10%,transparent)]',
		shellFooterStrip:
			'border-t-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_38%,transparent)] bg-[color-mix(in_srgb,var(--desktop-paper-cream)_28%,var(--desktop-surface-soft)_72%)] shadow-[inset_0_2px_0_rgba(255,255,255,0.35)]',
	},
	aurora: {
		frame:
			'border-2 border-(--desktop-chrome-aurora-frame-border) [background-image:var(--desktop-chrome-aurora-frame-bg)] shadow-(--desktop-chrome-aurora-frame-shadow)',
		active:
			'ring-2 ring-[rgba(167,139,250,0.45)] shadow-[0_0_0_2px_rgba(34,211,238,0.22),0_0_40px_-8px_rgba(168,85,247,0.28)]',
		inactive: 'saturate-[1.06]',
		shell: '',
		content: '[background-image:var(--desktop-chrome-aurora-content-bg)]',
		accentLine:
			'bg-[linear-gradient(90deg,rgba(168,85,247,0.58)_0%,rgba(34,211,238,0.48)_35%,rgba(244,114,182,0.42)_70%,rgba(168,85,247,0.52)_100%)] opacity-[0.92]',
		shellNavRail:
			'border-r-2 border-(--desktop-chrome-aurora-frame-border) [background-image:var(--desktop-chrome-aurora-nav-bg)] shadow-[inset_-2px_0_12px_rgba(34,211,238,0.08)]',
		shellFooterStrip:
			'border-t-2 border-[rgba(34,211,238,0.28)] [background-image:var(--desktop-chrome-aurora-footer-bg)] shadow-[0_-4px_20px_rgba(168,85,247,0.1)]',
	},
	chameleon: {
		frame:
			'border border-(--glass-border) [background-image:var(--desktop-chrome-chameleon-frame-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_32px_84px_rgba(0,0,0,0.54)]',
		active:
			'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.34)] shadow-[0_38px_92px_rgba(0,0,0,0.58)]',
		inactive: 'saturate-[0.96]',
		shell: '',
		content:
			'[background-image:var(--desktop-chrome-chameleon-content-bg)] min-h-0',
		accentLine:
			'bg-[linear-gradient(90deg,rgb(255,200,220)_0%,rgb(180,220,255)_50%,rgb(200,255,210)_100%)] opacity-[0.85]',
		shellNavRail:
			'border-r border-(--glass-border) [background-image:var(--desktop-chrome-chameleon-nav-bg)] shadow-[inset_-1px_0_0_rgb(var(--desktop-fg-primary-rgb)/0.07)]',
		shellFooterStrip:
			'border-t border-(--glass-border)/70 [background-image:var(--desktop-chrome-chameleon-footer-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
	},
	premium: {
		frame:
			'border border-[rgba(212,175,106,0.32)] [background-image:var(--desktop-chrome-premium-frame-bg)] shadow-[0_0_0_1px_rgb(var(--desktop-fg-primary-rgb)/0.06),0_28px_64px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,250,240,0.45)]',
		active:
			'ring-1 ring-[rgba(212,175,106,0.45)] shadow-[0_0_0_1px_rgba(212,175,106,0.18),0_32px_72px_rgba(15,23,42,0.16)]',
		inactive: 'saturate-[0.96]',
		shell: '',
		content:
			'[background-image:var(--desktop-chrome-premium-content-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
		accentLine:
			'bg-[linear-gradient(90deg,transparent_0%,rgba(212,175,106,0.48)_18%,rgba(255,235,200,0.22)_50%,rgba(212,175,106,0.42)_82%,transparent_100%)] opacity-[0.7]',
		shellNavRail:
			'border-r border-[rgba(212,175,106,0.22)] [background-image:var(--desktop-chrome-premium-frame-bg)] shadow-[inset_-1px_0_0_rgba(212,175,106,0.12)]',
		shellFooterStrip:
			'border-t border-[rgba(212,175,106,0.2)] [background-image:var(--desktop-chrome-premium-content-bg)] shadow-[inset_0_1px_0_rgba(255,250,240,0.4)]',
	},
};
