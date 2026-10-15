/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop app glyph component with per-iconStyle painted motifs.
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
import type { ReactNode } from 'react';
import type { DesktopIconStyle } from '../../../../types/profile';
import {
	DESKTOP_ICON_SVG_QUALITY,
	DESKTOP_LUCIDE,
} from '../../constants/lucideDesktop';
import { getDesktopAppVisual } from './appGlyphMap';
import { DesktopPaintedSpan } from './paintedSpan';
import { renderDesktopAppMotif } from './renderDesktopAppMotif';

interface DesktopAppSymbolProps {
	appComponent?: string | null;
	fallback?: ReactNode;
	className?: string;
	iconClassName?: string;
	iconStyle?: DesktopIconStyle;
}

export function DesktopAppSymbol({
	appComponent,
	fallback,
	className = '',
	iconClassName = '',
	iconStyle = 'glass',
}: DesktopAppSymbolProps) {
	const visual = getDesktopAppVisual(appComponent);
	const Glyph = visual.glyph;
	const classicGlyph = fallback ?? (
		<Glyph
			className={`h-[74%] w-[74%] text-(--desktop-text-primary) drop-shadow-[0_6px_14px_rgba(15,23,42,0.42)] ${iconClassName}`}
			strokeWidth={DESKTOP_LUCIDE.stroke}
		/>
	);

	if (iconStyle === 'minimal') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center text-[rgb(var(--desktop-fg-primary-rgb)/0.95)] [&>svg]:h-[74%] [&>svg]:w-[74%]',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				{classicGlyph}
			</span>
		);
	}

	if (iconStyle === 'paper') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[10%] rounded-[30%] border-2 border-[color-mix(in_srgb,var(--desktop-paper-edge)_48%,transparent)] bg-[color-mix(in_srgb,var(--desktop-paper-cream-soft)_38%,rgb(var(--desktop-bg-primary-rgb))_62%)] shadow-[4px_4px_0_0_color-mix(in_srgb,var(--desktop-paper-ink)_12%,transparent)]"
				/>
				<Glyph
					className={cn(
						'relative z-1 h-[42%] w-[42%] text-(--desktop-paper-ink) drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]',
						iconClassName
					)}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'noir') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[12%] rounded-[32%] border border-(--desktop-chrome-noir-icon-border) [background-image:var(--desktop-chrome-noir-icon-app-bg)] shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
				/>
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-[22%] rounded-[28%] border border-[rgb(var(--desktop-fg-primary-rgb)/0.08)] bg-[linear-gradient(180deg,rgb(var(--desktop-fg-primary-rgb)/0.08)_0%,transparent_100%)] opacity-75"
				/>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-[color:var(--desktop-chrome-noir-glyph-fg)] ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'framed') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[12%] rounded-[32%] border border-(--desktop-border-strong) bg-[linear-gradient(155deg,rgb(var(--desktop-bg-secondary-rgb)/0.94)_0%,rgb(var(--desktop-bg-primary-rgb)/0.9)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_26px_rgba(0,0,0,0.4)]"
				/>
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-[22%] rounded-[28%] border border-[rgb(var(--desktop-fg-primary-rgb)/0.1)] bg-[linear-gradient(180deg,rgb(var(--desktop-fg-primary-rgb)/0.1)_0%,transparent_100%)] opacity-85"
				/>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-[rgb(var(--desktop-fg-primary-rgb)/0.94)] ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'neon') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[10%] rounded-[30%] border-2 border-[rgb(var(--desktop-accent-rgb)/0.72)] [background-image:var(--desktop-chrome-neon-icon-app-bg)] shadow-[0_0_0_1px_rgb(var(--desktop-fg-primary-rgb)/0.06),0_0_28px_-6px_rgb(var(--desktop-accent-rgb)/0.45)]"
				/>
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-[22%] rounded-[26%] border border-[rgb(var(--desktop-accent-rgb)/0.22)] opacity-80"
				/>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-[color:var(--desktop-chrome-neon-glyph-fg)] drop-shadow-[0_0_12px_rgb(var(--desktop-accent-rgb)/0.4)] ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'aurora') {
		if (!appComponent && fallback) {
			return (
				<span
					className={cn(
						'relative flex h-full w-full items-center justify-center',
						DESKTOP_ICON_SVG_QUALITY,
						className
					)}
				>
					{fallback}
				</span>
			);
		}
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<DesktopPaintedSpan
					className="absolute inset-[12%] rounded-[32%] border-2 border-[rgba(168,85,247,0.45)] saturate-[0.88]"
					depsKey={`app-aurora-${visual.primary}-${visual.secondary}-${visual.tertiary}-${visual.glow}`}
					paint={(el) => {
						el.style.background = `radial-gradient(circle at 18% 10%, rgb(var(--desktop-accent-rgb) / 0.42), transparent 38%), radial-gradient(circle at 24% 14%, rgb(var(--desktop-fg-primary-rgb) / 0.26), transparent 32%), radial-gradient(circle at 82% 100%, ${visual.secondary}55, transparent 44%), linear-gradient(150deg, ${visual.primary} 0%, ${visual.secondary} 52%, ${visual.tertiary} 100%)`;
						el.style.boxShadow = `0 0 0 1px rgba(34, 211, 238, 0.22), 0 10px 28px rgba(168, 85, 247, 0.35), 0 12px 34px rgb(var(--desktop-accent-rgb) / 0.2), 0 10px 26px ${visual.glow}, 0 0 0 1px rgb(var(--desktop-fg-primary-rgb) / 0.06) inset`;
					}}
				/>
				<span
					aria-hidden="true"
					className="absolute inset-[22%] rounded-[28%] border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[linear-gradient(180deg,rgb(var(--desktop-fg-primary-rgb)/0.16)_0%,rgb(var(--desktop-fg-primary-rgb)/0.02)_100%)] opacity-90"
				/>
				{renderDesktopAppMotif(visual.motif, visual)}
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-white drop-shadow-[0_8px_18px_rgba(15,23,42,0.45)] ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'chameleon') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className={cn(
						'absolute inset-[10%] rounded-[30%] overflow-hidden border border-(--desktop-border-strong) bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_100%)] shadow-[0_12px_32px_rgba(0,0,0,0.28)]'
					)}
				/>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-(--desktop-text-primary) drop-shadow-[0_8px_18px_rgba(15,23,42,0.25)] ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'prism') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[10%] flex items-center justify-center rounded-[28%] p-[2px] shadow-[0_0_28px_rgba(167,139,250,0.38)] [background:conic-gradient(from_210deg_at_50%_50%,#f472b6,#38bdf8,#a78bfa,#34d399,#f472b6)]"
				>
					<span className="block h-full w-full rounded-[26%] bg-[linear-gradient(165deg,rgb(12,10,24)_0%,rgb(4,6,18)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
				</span>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-white drop-shadow-[0_2px_8px_rgba(56,189,248,0.45)] ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'mercury') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[11%] rounded-[34%] bg-[linear-gradient(138deg,#f4f4f5_0%,#9ca3af_42%,#e5e7eb_55%,#6b7280_88%,#f9fafb_100%)] shadow-[inset_0_3px_10px_rgba(255,255,255,0.85),inset_0_-6px_14px_rgba(0,0,0,0.35),0_14px_32px_rgba(0,0,0,0.55)]"
				/>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-zinc-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.7)] ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'vhs') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[10%] rounded-[28%] border border-fuchsia-500/35 bg-[linear-gradient(180deg,#1e0530_0%,#0f172a_55%,#020617_100%)] shadow-[3px_0_10px_rgba(34,211,238,0.35),-3px_0_10px_rgba(236,72,153,0.35),0_12px_28px_rgba(0,0,0,0.65)]"
				/>
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-[18%] rounded-[24%] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.07)_2px,rgba(255,255,255,0.07)_3px)] opacity-[0.14]"
				/>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-cyan-100 drop-shadow-[2px_0_0_rgba(236,72,153,0.45)] ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'slate') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[11%] rounded-[26%] border border-[rgba(148,163,184,0.4)] bg-[linear-gradient(180deg,rgb(71,85,105)_0%,rgb(30,41,59)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_22px_rgba(0,0,0,0.4)]"
				/>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-slate-100 ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'clay') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[11%] rounded-[30%] border border-[rgba(196,140,100,0.42)] bg-[linear-gradient(168deg,rgb(120,78,54)_0%,rgb(64,40,30)_100%)] shadow-[inset_0_1px_0_rgba(255,220,190,0.14),0_10px_22px_rgba(0,0,0,0.42)]"
				/>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-[rgb(255,236,214)] ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'ember') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[11%] rounded-[28%] border border-[rgba(245,158,11,0.4)] bg-[linear-gradient(168deg,rgb(36,20,12)_0%,rgb(12,8,6)_100%)] shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_10px_24px_rgba(0,0,0,0.5)]"
				/>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-amber-100 ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'premium') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<span
					aria-hidden="true"
					className="absolute inset-[10%] rounded-[30%] border border-[rgba(212,175,106,0.32)] [background-image:var(--desktop-chrome-premium-icon-app-bg)] shadow-[0_0_0_1px_rgb(var(--desktop-fg-primary-rgb)/0.06),0_12px_28px_rgba(15,23,42,0.12)]"
				/>
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-[22%] rounded-[26%] border border-[rgba(212,175,106,0.2)] opacity-80"
				/>
				<Glyph
					className={`relative z-1 h-[42%] w-[42%] text-[color:var(--desktop-chrome-premium-glyph-fg)] drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] ${iconClassName}`}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			</span>
		);
	}

	if (!appComponent && fallback) {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				{fallback}
			</span>
		);
	}

	return (
		<span
			className={cn(
				'relative flex h-full w-full items-center justify-center',
				DESKTOP_ICON_SVG_QUALITY,
				className
			)}
		>
			<DesktopPaintedSpan
				className="absolute inset-[12%] rounded-[32%] border border-(--glass-border) saturate-[0.72]"
				depsKey={`app-glass-${visual.primary}-${visual.secondary}-${visual.tertiary}-${visual.glow}`}
				paint={(el) => {
					el.style.background = `radial-gradient(circle at 28% 18%, rgb(var(--desktop-fg-primary-rgb) / 0.26), transparent 34%), linear-gradient(150deg, ${visual.primary} 0%, ${visual.secondary} 56%, ${visual.tertiary} 100%)`;
					el.style.boxShadow = `0 10px 24px rgba(0,0,0,0.28), 0 10px 26px ${visual.glow}`;
				}}
			/>
			<span
				aria-hidden="true"
				className="absolute inset-[22%] rounded-[28%] border border-(--desktop-border-subtle) bg-[linear-gradient(180deg,rgb(var(--desktop-fg-primary-rgb)/0.18)_0%,rgb(var(--desktop-fg-primary-rgb)/0.02)_100%)] opacity-90"
			/>
			{renderDesktopAppMotif(visual.motif, visual)}
			<Glyph
				className={`relative z-1 h-[42%] w-[42%] text-white drop-shadow-[0_8px_18px_rgba(15,23,42,0.45)] ${iconClassName}`}
				strokeWidth={DESKTOP_LUCIDE.stroke}
			/>
		</span>
	);
}
