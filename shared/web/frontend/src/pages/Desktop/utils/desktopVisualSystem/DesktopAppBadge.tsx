/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App badge shells and getDesktopAppIconNode for start menu / taskbar / lists.
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
import type { CSSProperties, ReactNode } from 'react';
import type { DesktopIconStyle } from '../../../../types/profile';
import {
	DESKTOP_ICON_SVG_QUALITY,
	DESKTOP_LUCIDE,
} from '../../constants/lucideDesktop';
import { getDesktopAppVisual } from './appGlyphMap';
import { DesktopAppSymbol } from './DesktopAppSymbol';

export function getDesktopAppIconNode(
	appComponent?: string | null,
	fallback?: ReactNode
): ReactNode {
	const visual = getDesktopAppVisual(appComponent);
	const Glyph = visual.glyph;
	return (
		fallback ?? (
			<Glyph
				className="w-full h-full text-(--desktop-text-secondary)"
				strokeWidth={DESKTOP_LUCIDE.stroke}
			/>
		)
	);
}

type DesktopAppBadgeVariant =
	| 'start'
	| 'panel'
	| 'taskbar'
	| 'preview'
	| 'list';

const DESKTOP_APP_BADGE_VARIANTS: Record<
	DesktopAppBadgeVariant,
	{ shell: string; inner: string; style: CSSProperties }
> = {
	start: {
		shell:
			'relative isolate inline-flex items-center justify-center overflow-hidden rounded-[1.05rem] border border-(--desktop-border-subtle) shadow-[0_20px_44px_rgba(0,0,0,0.36)]',
		inner: 'relative z-1 h-[78%] w-[78%]',
		style: {
			background:
				'linear-gradient(180deg, rgb(var(--desktop-bg-secondary-rgb)) 0%, rgb(var(--desktop-bg-primary-rgb)) 100%)',
		},
	},
	panel: {
		shell:
			'relative isolate inline-flex items-center justify-center overflow-hidden rounded-[1rem] border border-(--desktop-border-subtle) shadow-[0_16px_34px_rgba(0,0,0,0.3)]',
		inner: 'relative z-1 h-[76%] w-[76%]',
		style: {
			background:
				'linear-gradient(180deg, rgb(var(--desktop-bg-secondary-rgb)) 0%, rgb(var(--desktop-bg-primary-rgb)) 100%)',
		},
	},
	taskbar: {
		shell:
			'relative isolate inline-flex items-center justify-center overflow-hidden rounded-[0.85rem] border border-(--desktop-border-subtle) shadow-[0_4px_14px_rgba(15,23,42,0.14)]',
		inner: 'relative z-1 h-[78%] w-[78%]',
		style: {
			background: 'rgb(var(--desktop-bg-secondary-rgb))',
		},
	},
	preview: {
		shell:
			'relative isolate inline-flex items-center justify-center overflow-hidden rounded-xl border border-(--desktop-border-subtle) shadow-[0_8px_18px_rgba(15,23,42,0.18)]',
		inner: 'relative z-1 h-[78%] w-[78%]',
		style: {
			background: 'rgb(var(--desktop-bg-secondary-rgb))',
		},
	},
	list: {
		shell:
			'relative isolate inline-flex items-center justify-center overflow-hidden rounded-lg border border-(--desktop-border-subtle) shadow-[0_6px_14px_rgba(15,23,42,0.14)]',
		inner: 'relative z-1 h-[78%] w-[78%]',
		style: {
			background: 'rgb(var(--desktop-bg-secondary-rgb))',
		},
	},
};

interface DesktopAppBadgeProps {
	appComponent?: string | null;
	icon?: ReactNode;
	variant?: DesktopAppBadgeVariant;
	className?: string;
	iconStyle?: DesktopIconStyle;
}

export function DesktopAppBadge({
	appComponent,
	icon,
	variant = 'panel',
	className = '',
	iconStyle = 'glass',
}: DesktopAppBadgeProps) {
	const badge = DESKTOP_APP_BADGE_VARIANTS[variant];
	const isMinimal = iconStyle === 'minimal';
	const shellClassName = isMinimal
		? `${badge.shell} bg-[color-mix(in_srgb,var(--glass-bg)_70%,transparent_30%)] shadow-[0_8px_18px_rgba(15,23,42,0.18)]`
		: 'relative inline-flex items-center justify-center';
	const symbolClassName = isMinimal
		? 'relative z-1 h-[74%] w-[74%]'
		: badge.inner;

	return (
		<span className={`${shellClassName} ${className}`}>
			<span className={cn(symbolClassName, DESKTOP_ICON_SVG_QUALITY)}>
				<DesktopAppSymbol
					appComponent={appComponent}
					fallback={icon}
					iconStyle={iconStyle}
				/>
			</span>
		</span>
	);
}
