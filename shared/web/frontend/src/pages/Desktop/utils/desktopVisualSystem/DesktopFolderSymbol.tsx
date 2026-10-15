/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop folder glyph aligned with DesktopAppSymbol presets.
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
import { FolderIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { DesktopIconStyle } from '../../../../types/profile';
import {
	DESKTOP_ICON_SVG_QUALITY,
	DESKTOP_LUCIDE,
} from '../../constants/lucideDesktop';
import { FOLDER_TILE_VISUAL } from './appGlyphMap';
import { DesktopPaintedSpan } from './paintedSpan';
import { renderDesktopAppMotif } from './renderDesktopAppMotif';

export interface DesktopFolderSymbolProps {
	iconStyle?: DesktopIconStyle;
	isProjectFolder?: boolean;
	/** System folder key from desktop API (``ewa_file`` → companion workspace glyph). */
	systemKey?: string;
	className?: string;
}

/**
 * Desktop folder glyph aligned with {@link DesktopAppSymbol} presets (window-style vocabulary).
 */
export function DesktopFolderSymbol({
	iconStyle = 'glass',
	isProjectFolder = false,
	systemKey,
	className = '',
}: DesktopFolderSymbolProps) {
	if (systemKey === 'ewa_file') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<DesktopPaintedSpan
					className="absolute inset-[10%] rounded-[32%] border border-fuchsia-300/40 saturate-[1.05]"
					depsKey="folder-ewa-file"
					paint={(el) => {
						el.style.background =
							'radial-gradient(circle at 22% 18%, rgb(var(--desktop-accent-rgb) / 0.45), transparent 42%), linear-gradient(145deg, #7c3aed 0%, #a855f7 45%, #22d3ee 100%)';
						el.style.boxShadow =
							'0 10px 28px rgba(168, 85, 247, 0.42), 0 0 0 1px rgba(34, 211, 238, 0.18) inset';
					}}
				/>
				<SparklesIcon
					className="absolute top-[18%] right-[20%] z-2 h-[22%] w-[22%] text-cyan-200/90 drop-shadow-[0_0_6px_rgba(34,211,238,0.55)]"
					strokeWidth={2}
					aria-hidden
				/>
				<FolderIcon
					className="relative z-1 h-[58%] w-[58%] text-white drop-shadow-[0_8px_18px_rgba(88,28,135,0.55)]"
					strokeWidth={DESKTOP_LUCIDE.strokeStrong}
				/>
			</span>
		);
	}

	const visual = FOLDER_TILE_VISUAL;
	const stroke = isProjectFolder
		? DESKTOP_LUCIDE.strokeStrong
		: DESKTOP_LUCIDE.stroke;
	const projectTint =
		isProjectFolder && 'text-[rgb(var(--desktop-accent-rgb))]';

	if (iconStyle === 'minimal') {
		return (
			<span
				className={cn(
					'relative flex h-full w-full items-center justify-center',
					DESKTOP_ICON_SVG_QUALITY,
					className
				)}
			>
				<FolderIcon
					className={cn(
						'h-[74%] w-[74%] text-(--desktop-text-primary)',
						'drop-shadow-[0_8px_18px_rgb(var(--desktop-fg-primary-rgb)/0.22)]',
						projectTint
					)}
					strokeWidth={stroke}
				/>
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-(--desktop-paper-ink) drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]',
						projectTint
					)}
					strokeWidth={stroke}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-[color:var(--desktop-chrome-noir-glyph-fg)]',
						projectTint
					)}
					strokeWidth={stroke}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-[rgb(var(--desktop-fg-primary-rgb)/0.94)]',
						projectTint
					)}
					strokeWidth={stroke}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-[color:var(--desktop-chrome-neon-glyph-fg)] drop-shadow-[0_0_12px_rgb(var(--desktop-accent-rgb)/0.4)]',
						projectTint
					)}
					strokeWidth={stroke}
				/>
			</span>
		);
	}

	if (iconStyle === 'aurora') {
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
					depsKey={`folder-aurora-${visual.primary}-${visual.secondary}-${visual.tertiary}-${visual.glow}`}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] drop-shadow-[0_8px_18px_rgba(15,23,42,0.45)]',
						isProjectFolder
							? 'text-[rgb(var(--desktop-accent-rgb))]'
							: 'text-white'
					)}
					strokeWidth={stroke}
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
					className="absolute inset-[10%] rounded-[30%] overflow-hidden border border-(--desktop-border-strong) bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb))_0%,rgb(var(--desktop-bg-primary-rgb))_100%)] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
				/>
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-(--desktop-text-primary) drop-shadow-[0_8px_18px_rgba(15,23,42,0.25)]',
						projectTint
					)}
					strokeWidth={stroke}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-white drop-shadow-[0_2px_8px_rgba(56,189,248,0.45)]',
						projectTint
					)}
					strokeWidth={stroke}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-zinc-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.7)]',
						projectTint
					)}
					strokeWidth={stroke}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-cyan-100 drop-shadow-[2px_0_0_rgba(236,72,153,0.45)]',
						projectTint
					)}
					strokeWidth={stroke}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-slate-100',
						projectTint
					)}
					strokeWidth={stroke}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-[rgb(255,236,214)]',
						projectTint
					)}
					strokeWidth={stroke}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-amber-100',
						projectTint
					)}
					strokeWidth={stroke}
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
				<FolderIcon
					className={cn(
						'relative z-1 h-[58%] w-[58%] text-[color:var(--desktop-chrome-premium-glyph-fg)] drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]',
						projectTint
					)}
					strokeWidth={stroke}
				/>
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
				depsKey={`folder-glass-${visual.primary}-${visual.secondary}-${visual.tertiary}-${visual.glow}`}
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
			<FolderIcon
				className={cn(
					'relative z-1 h-[58%] w-[58%] drop-shadow-[0_8px_18px_rgba(15,23,42,0.45)]',
					isProjectFolder
						? 'text-[rgb(var(--desktop-accent-rgb))]'
						: 'text-white'
				)}
				strokeWidth={stroke}
			/>
		</span>
	);
}
