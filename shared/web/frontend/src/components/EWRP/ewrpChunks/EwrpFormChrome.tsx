/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP form chrome — history list skeleton, section headers, desktop-styled select, and Lucide stroke width.
 *
 * Invariants:
 * - Skeleton announces loading via aria-busy; select chevron uses shared `sw` stroke.
 *
 * Related:
 * - `EwrpGeneratorChunks.tsx` barrel, `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 */

import { cn } from '@/utils/cn';
import type { ComponentPropsWithoutRef } from 'react';
import i18n from 'i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export function EwrpHistoryListSkeleton({ rows = 5 }: { rows?: number }) {
	return (
		<div
			role="status"
			aria-live="polite"
			aria-busy="true"
			className="space-y-2 pr-0.5"
		>
			<span className="sr-only">{i18n.t('ewrp:skeleton.historyLoading')}</span>
			{Array.from({ length: rows }, (_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
					key={`ewrp-hist-skel-${i}`}
					className="animate-pulse rounded-xl border border-(--desktop-border-subtle)/50 bg-(--desktop-surface-soft)/30 px-3 py-2.5"
				>
					<div className="h-3.5 max-w-[58%] rounded-md bg-(--desktop-surface-accent)" />
					<div className="mt-2 h-2.5 w-full rounded-md bg-(--desktop-surface-accent)/75" />
					<div className="mt-2 flex items-center gap-2">
						<div className="h-5 w-16 rounded-full bg-(--desktop-surface-accent)/65" />
						<div className="h-2.5 w-24 rounded bg-(--desktop-surface-accent)/50" />
					</div>
				</div>
			))}
		</div>
	);
}

export const sw = DESKTOP_LUCIDE.stroke;

/** Form block header: step number + title + hint (desktop theme via tokens). */
export function EwrpFormSectionHeader({
	step,
	title,
	hint,
	badge,
}: {
	/** Step number; omit for title-only blocks (e.g. history). */
	step?: string;
	title: string;
	hint?: string;
	/** Visual emphasis: required vs optional vs “has defaults”. */
	badge?: 'required' | 'optional' | 'defaults';
}) {
	const badgeText =
		badge === 'required'
			? i18n.t('ewrp:form.badgeRequired')
			: badge === 'optional'
				? i18n.t('ewrp:form.badgeOptional')
				: badge === 'defaults'
					? i18n.t('ewrp:form.badgeDefaults')
					: null;
	const badgeClass =
		badge === 'required'
			? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-100/95'
			: badge === 'optional'
				? 'border-(--desktop-border-subtle)/65 bg-(--desktop-surface-soft)/45 text-(--desktop-text-dim)'
				: badge === 'defaults'
					? 'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] text-(--desktop-text-secondary)'
					: '';

	return (
		<div className="mb-4 border-b border-(--desktop-border-subtle)/40 pb-3.5">
			<div className="flex items-start gap-3 sm:gap-3.5">
				{step ? (
					<span
						className="mt-0.5 flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(165deg,rgb(var(--desktop-accent-rgb)/0.2)_0%,rgb(var(--desktop-accent-rgb)/0.08)_100%)] text-[11px] font-bold tabular-nums text-(--desktop-text-secondary) shadow-[inset_0_1px_0_rgb(var(--desktop-accent-rgb)/0.12)] ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.2)] motion-safe:transition-[box-shadow,transform] motion-safe:duration-200 motion-safe:hover:shadow-[inset_0_1px_0_rgb(var(--desktop-accent-rgb)/0.18),0_1px_12px_-4px_rgb(var(--desktop-accent-rgb)/0.35)]"
						aria-hidden
					>
						{step}
					</span>
				) : null}
				<div className={cn('min-w-0', step ? 'flex-1' : 'w-full')}>
					<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.subtitle,
								'text-balance tracking-tight text-(--desktop-text-primary)'
							)}
						>
							{title}
						</p>
						{badgeText ? (
							<span
								className={cn(
									'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
									badgeClass
								)}
							>
								{badgeText}
							</span>
						) : null}
					</div>
					{hint ? (
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.meta,
								'mt-1.5 max-w-prose leading-relaxed text-(--desktop-text-dim)'
							)}
						>
							{hint}
						</p>
					) : null}
				</div>
			</div>
		</div>
	);
}

/** Native select styled for the desktop shell: accent chevron, options use panel-strong. */
export function EwrpDesktopSelect({
	className,
	selectClassName,
	selectSize = 'md',
	disabled,
	...rest
}: ComponentPropsWithoutRef<'select'> & {
	selectClassName: string;
	/** Visual density (not the HTML `size` attribute). */
	selectSize?: 'md' | 'sm';
}) {
	const isSm = selectSize === 'sm';
	return (
		<div
			className={cn(
				'group relative w-full rounded-(--desktop-radius-lg)',
				className
			)}
		>
			<select
				{...rest}
				disabled={disabled}
				className={cn(
					selectClassName,
					isSm ? 'py-2 pr-9 text-xs' : 'py-2.5 pr-10 text-sm',
					disabled && 'cursor-not-allowed opacity-55',
					!disabled &&
						'motion-safe:transition-[border-color,box-shadow] motion-safe:duration-150'
				)}
			/>
			<ChevronDownIcon
				className={cn(
					'pointer-events-none absolute top-1/2 -translate-y-1/2 motion-safe:transition-opacity motion-safe:duration-200',
					isSm ? 'right-2 h-3.5 w-3.5' : 'right-3 h-4 w-4',
					disabled
						? 'text-(--desktop-text-dim)'
						: 'text-[rgb(var(--desktop-accent-rgb)/0.88)] opacity-90 group-hover:opacity-100'
				)}
				strokeWidth={sw}
				aria-hidden
			/>
		</div>
	);
}
