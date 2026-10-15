/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Window titlebar style presets per DesktopWindowStyle.
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

interface DesktopWindowTitleBarPreset {
	root: string;
	iconShell: string;
	title: string;
	pill: string;
	/** Wrapper around minimize / maximize / close */
	controlGroup: string;
	/** Minimize & maximize */
	control: string;
	/** Close: neutral idle, strong hover */
	close: string;
}

const DESKTOP_FLAT_TITLEBAR: DesktopWindowTitleBarPreset = {
	root: 'bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_48%,rgb(var(--desktop-bg-primary-rgb))_100%)] border-b border-(--desktop-border-strong)/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(0,0,0,0.08)]',
	iconShell:
		'rounded-(--desktop-radius-section) border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-[linear-gradient(165deg,rgb(var(--desktop-accent-rgb)/0.14)_0%,rgb(var(--desktop-accent-rgb)/0.06)_100%)] shadow-[0_6px_16px_rgba(0,0,0,0.28)]',
	title:
		'text-(--desktop-text-primary) drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]',
	pill: 'border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] text-(--desktop-text-secondary) shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
	controlGroup:
		'flex items-center gap-0.5 rounded-[11px] border border-(--desktop-border-subtle)/60 bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_100%)] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
	control:
		'text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) active:bg-(--desktop-surface-soft-active) hover:text-(--desktop-text-primary)',
	close:
		'text-(--desktop-text-muted) hover:bg-[#e81123] hover:text-white active:bg-[#c50e1e] active:text-white',
};

export const DESKTOP_WINDOW_TITLEBAR_STYLES: Record<
	DesktopWindowStyle,
	DesktopWindowTitleBarPreset
> = {
	glass: {
		root: 'bg-[radial-gradient(circle_at_12%_0%,rgb(var(--desktop-accent-rgb)/0.08),transparent_40%),linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.97)_0%,rgb(var(--desktop-bg-primary-rgb)/0.97)_100%)] border-b border-(--glass-border)/55 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.08),inset_0_-1px_0_rgba(0,0,0,0.12)]',
		iconShell:
			'rounded-(--desktop-radius-section) border border-(--glass-border)/45 bg-[linear-gradient(165deg,rgb(var(--desktop-accent-rgb)/0.14)_0%,rgb(var(--desktop-bg-secondary-rgb)/0.97)_100%)] shadow-[0_4px_14px_rgba(0,0,0,0.14)]',
		title: 'text-(--desktop-text-primary)',
		pill: 'border border-(--glass-border)/40 bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] text-(--desktop-text-secondary) shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]',
		controlGroup:
			'flex items-center gap-0.5 rounded-[11px] border border-(--glass-border)/40 bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
		control:
			'text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) active:bg-(--desktop-surface-soft-active) hover:text-(--desktop-text-primary)',
		close:
			'text-(--desktop-text-muted) hover:bg-[#dc2626] hover:text-white active:bg-[#b91c1c] active:text-white',
	},
	framed: DESKTOP_FLAT_TITLEBAR,
	minimal: {
		root: 'bg-[color-mix(in_srgb,var(--glass-bg-strong)_78%,rgb(var(--desktop-bg-primary-rgb))_22%)] border-b border-(--desktop-border-subtle) shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]',
		iconShell:
			'rounded-(--desktop-radius-section) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) shadow-[0_2px_10px_rgba(0,0,0,0.12)]',
		title: 'text-(--desktop-text-primary)',
		pill: 'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)',
		controlGroup:
			'flex items-center gap-0.5 rounded-[10px] border border-(--desktop-border-subtle)/65 bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] p-0.5 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.04)]',
		control:
			'text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) active:bg-(--desktop-surface-soft-active) hover:text-(--desktop-text-primary)',
		close:
			'text-(--desktop-text-muted) hover:bg-red-600 hover:text-white active:bg-red-700 active:text-white',
	},
	noir: {
		root: '[background-image:var(--desktop-chrome-noir-titlebar-bg)] border-b-2 border-(--desktop-border-strong) shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
		iconShell:
			'rounded-(--desktop-radius-section) border border-(--desktop-border-strong) [background-image:var(--desktop-chrome-noir-content-bg)] shadow-[0_2px_12px_rgba(15,23,42,0.12)]',
		title: 'text-(--desktop-text-primary) tracking-tight font-medium',
		pill: 'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)',
		controlGroup:
			'flex items-center gap-0.5 rounded-[11px] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
		control:
			'text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) active:bg-(--desktop-surface-soft-active) hover:text-(--desktop-text-primary)',
		close:
			'text-(--desktop-text-muted) hover:bg-[#dc2626] hover:text-white active:bg-[#b91c1c] active:text-white',
	},
	neon: {
		root: '[background-image:var(--desktop-chrome-neon-titlebar-bg)] border-b-2 border-[rgb(var(--desktop-accent-rgb)/0.55)] shadow-[inset_0_-12px_24px_-12px_rgb(var(--desktop-accent-rgb)/0.18),0_0_20px_-6px_rgb(var(--desktop-accent-rgb)/0.28)]',
		iconShell:
			'rounded-(--desktop-radius-section) border-2 border-[rgb(var(--desktop-accent-rgb)/0.5)] [background-image:var(--desktop-chrome-neon-frame-bg)] shadow-[0_0_16px_rgb(var(--desktop-accent-rgb)/0.28)]',
		title:
			'text-[rgb(var(--desktop-accent-rgb))] drop-shadow-[0_0_8px_rgb(var(--desktop-accent-rgb)/0.35)] font-medium',
		pill: 'border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-(--desktop-surface-soft) text-[rgb(var(--desktop-accent-rgb)/0.95)]',
		controlGroup:
			'flex items-center gap-0.5 rounded-[11px] border border-[rgb(var(--desktop-accent-rgb)/0.3)] bg-(--desktop-surface-soft) p-0.5 shadow-[inset_0_0_10px_rgb(var(--desktop-accent-rgb)/0.1)]',
		control:
			'text-[rgb(var(--desktop-accent-rgb)/0.8)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.12)] hover:text-[rgb(var(--desktop-accent-rgb))]',
		close:
			'text-[rgb(var(--desktop-accent-rgb)/0.7)] hover:bg-[#dc2626] hover:text-white hover:drop-shadow-none',
	},
	paper: {
		root: 'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--desktop-paper-highlight)_40%,rgb(var(--desktop-bg-primary-rgb))_60%)_0%,color-mix(in_srgb,var(--desktop-paper-warm)_25%,rgb(var(--desktop-bg-primary-rgb))_75%)_100%)] border-b-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_55%,transparent)] shadow-[inset_0_2px_0_rgba(255,255,255,0.5)]',
		iconShell:
			'rounded-(--desktop-radius-section) border-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_45%,transparent)] bg-[color-mix(in_srgb,var(--desktop-paper-highlight)_55%,var(--desktop-surface-soft)_45%)] shadow-[2px_2px_0_0_color-mix(in_srgb,var(--desktop-paper-ink)_12%,transparent)]',
		title:
			'text-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb))_92%,var(--desktop-paper-ink)_8%)] font-medium',
		pill: 'border border-[color-mix(in_srgb,var(--desktop-paper-edge)_40%,transparent)] bg-[color-mix(in_srgb,var(--desktop-paper-cream-soft)_50%,transparent)] text-(--desktop-paper-ink)',
		controlGroup:
			'flex items-center gap-0.5 rounded-[10px] border-2 border-[color-mix(in_srgb,var(--desktop-paper-ring)_50%,transparent)] bg-[color-mix(in_srgb,var(--desktop-paper-highlight)_35%,transparent)] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
		control:
			'text-(--desktop-paper-ink) hover:bg-[color-mix(in_srgb,var(--desktop-paper-edge)_12%,transparent)] active:bg-[color-mix(in_srgb,var(--desktop-paper-edge)_18%,transparent)]',
		close:
			'text-(--desktop-paper-ink) hover:bg-red-600 hover:text-white active:bg-red-700 active:text-white',
	},
	aurora: {
		root: '[background-image:var(--desktop-chrome-aurora-titlebar-bg)] border-b-2 border-[transparent] shadow-[inset_0_-2px_0_0_rgba(168,85,247,0.4),inset_0_1px_0_0_rgba(34,211,238,0.22)]',
		iconShell:
			'rounded-(--desktop-radius-section) border-2 border-[rgba(168,85,247,0.45)] [background-image:var(--desktop-chrome-aurora-titlebar-icon-bg)] shadow-[0_0_14px_rgba(168,85,247,0.22)]',
		title:
			'text-[color:var(--desktop-chrome-aurora-titlebar-title)] drop-shadow-[0_0_10px_rgba(168,85,247,0.28)] font-medium',
		pill: 'border border-[rgba(34,211,238,0.3)] bg-(--desktop-chrome-aurora-titlebar-pill-bg) text-[color:var(--desktop-chrome-aurora-titlebar-pill-fg)]',
		controlGroup:
			'flex items-center gap-0.5 rounded-[11px] border border-[rgba(168,85,247,0.3)] bg-(--desktop-chrome-aurora-titlebar-control-bg) p-0.5 shadow-[0_0_10px_rgba(34,211,238,0.1)]',
		control:
			'text-[color:var(--desktop-chrome-aurora-titlebar-control-fg)] hover:bg-[rgba(168,85,247,0.14)] hover:opacity-100',
		close:
			'text-[color:var(--desktop-chrome-aurora-titlebar-control-fg)] hover:bg-[#dc2626] hover:text-white',
	},
	chameleon: {
		root: '[background-image:var(--desktop-chrome-chameleon-titlebar-bg)] border-b border-(--glass-border)/55 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.06)]',
		iconShell:
			'rounded-(--desktop-radius-section) border border-(--glass-border)/45 bg-[color-mix(in_srgb,var(--glass-bg-strong)_70%,rgb(var(--desktop-bg-primary-rgb))_30%)] shadow-[0_4px_14px_rgba(0,0,0,0.14)]',
		title: 'text-(--desktop-text-primary)',
		pill: 'border border-(--glass-border)/40 bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] text-(--desktop-text-secondary)',
		controlGroup:
			'flex items-center gap-0.5 rounded-[11px] border border-(--glass-border)/40 bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
		control:
			'text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) active:bg-(--desktop-surface-soft-active) hover:text-(--desktop-text-primary)',
		close:
			'text-(--desktop-text-muted) hover:bg-[#dc2626] hover:text-white active:bg-[#b91c1c] active:text-white',
	},
	premium: {
		root: '[background-image:var(--desktop-chrome-premium-titlebar-bg)] border-b border-[rgba(212,175,106,0.28)] shadow-[inset_0_1px_0_rgba(255,250,245,0.45)]',
		iconShell:
			'rounded-(--desktop-radius-section) border border-[rgba(212,175,106,0.32)] [background-image:var(--desktop-chrome-premium-titlebar-icon-bg)] shadow-[0_4px_16px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,245,230,0.4)]',
		title:
			'text-[color:var(--desktop-chrome-premium-titlebar-title)] tracking-wide font-medium',
		pill: 'border border-[rgba(212,175,106,0.28)] bg-(--desktop-surface-soft) text-[color:var(--desktop-chrome-premium-titlebar-muted)] shadow-[inset_0_1px_0_rgba(255,250,240,0.35)]',
		controlGroup:
			'flex items-center gap-0.5 rounded-[11px] border border-[rgba(212,175,106,0.22)] bg-(--desktop-surface-soft) p-0.5 shadow-[inset_0_1px_0_rgba(255,250,240,0.35)]',
		control:
			'text-[color:var(--desktop-chrome-premium-titlebar-muted)] hover:bg-[rgba(212,175,106,0.12)] hover:text-[color:var(--desktop-chrome-premium-titlebar-title)]',
		close:
			'text-[color:var(--desktop-chrome-premium-titlebar-muted)] hover:bg-[#b91c1c] hover:text-white active:bg-[#991b1b]',
	},
};
