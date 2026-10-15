/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact status/metric badge for Ultimate Doc Editor sticky header meta strip.
 *
 * Invariants:
 * - Label stays sentence-case (no chrome uppercase shout).
 *
 * Related:
 * - UltimateDocEditorDocumentHeader.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR.md
 */

import * as React from 'react';
import { DesktopAppStatusBadge } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

/** Sticky-header section / metric labels — sentence-case, no chrome uppercase shout. */
export const DOC_EDITOR_HEADER_META_LABEL_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'font-medium tracking-normal'
);

export function HeaderMetricBadge({
	label,
	value,
	tone = 'default',
	compact = false,
	defaultSurfaceClassName,
	ariaLabel,
}: {
	label: string;
	value: React.ReactNode;
	tone?: 'default' | 'accent' | 'danger' | 'warning';
	/** Компактный вид для полосы метаданных в шапке. */
	compact?: boolean;
	/** Пресет «Стиль окон» для нейтрального тона (glass / framed / minimal). */
	defaultSurfaceClassName?: string;
	/** Для скринридеров: полное описание бейджа (подпись + значение). */
	ariaLabel?: string;
}): React.JSX.Element {
	return (
		<DesktopAppStatusBadge
			aria-label={ariaLabel}
			className={cn(
				compact
					? 'inline-flex h-7 min-h-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-0.5'
					: 'inline-flex h-9 items-center gap-2 rounded-xl px-2.5 py-1.5',
				tone === 'accent'
					? 'border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) text-white shadow-(--desktop-shadow-soft)'
					: tone === 'danger'
						? 'border border-red-500/60 bg-red-950/70 text-red-50 shadow-[0_0_20px_rgba(239,68,68,0.18)]'
						: tone === 'warning'
							? 'border border-amber-500/50 bg-amber-950/55 text-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.12)]'
							: cn(
									defaultSurfaceClassName ??
										'border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-panel)_88%,transparent)]',
									'text-(--desktop-text-secondary)'
								)
			)}
		>
			<span
				className={cn(
					DOC_EDITOR_HEADER_META_LABEL_CLASS,
					tone === 'accent'
						? 'text-white/78'
						: tone === 'danger'
							? 'text-red-300/85'
							: tone === 'warning'
								? 'text-amber-200/85'
								: 'text-(--desktop-text-secondary)'
				)}
			>
				{label}
			</span>
			<strong
				className={cn(
					compact ? 'text-[11px]' : 'text-[12px]',
					'font-semibold tabular-nums tracking-tight',
					tone === 'accent'
						? 'text-white'
						: tone === 'danger'
							? 'text-red-50'
							: tone === 'warning'
								? 'text-amber-50'
								: 'text-(--desktop-text-primary)'
				)}
			>
				{value}
			</strong>
		</DesktopAppStatusBadge>
	);
}
