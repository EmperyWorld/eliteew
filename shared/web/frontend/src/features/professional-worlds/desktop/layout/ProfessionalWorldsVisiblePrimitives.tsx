/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Above-the-fold visible UI primitives for the Professional Worlds normal state:
 * hero, action cards, progress rail, and trust notes.
 *
 * Invariants:
 * - Normal-state primitives must show the next useful action without requiring an error, run, or locked state.
 * - Copy is passed from the Professional Worlds i18n namespace; no hardcoded user-facing text here.
 *
 * Related:
 * - OverviewWorkspacePanel.tsx
 * - professionalWorldsLayoutTokens.ts
 * - documentation/product/PROFESSIONAL-WORLDS.md
 * ---
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import {
	PW_TONE_LABEL_CLASS,
	PW_VISIBLE_CARD_CLASS,
	PW_VISIBLE_CARD_INTERACTIVE_CLASS,
	PW_VISIBLE_HERO_CLASS,
	PW_VISIBLE_PROGRESS_RAIL_CLASS,
	type ProfessionalWorldsTone,
} from './professionalWorldsLayoutTokens';

export type ProfessionalWorldsProgressRailItem = {
	id: string;
	label: string;
	value: string;
	complete: boolean;
	helper?: string;
};

export function ProfessionalWorldsHeroPanel({
	eyebrow,
	title,
	description,
	primaryAction,
	secondaryAction,
	meta,
	children,
}: {
	eyebrow: ReactNode;
	title: ReactNode;
	description: ReactNode;
	primaryAction?: ReactNode;
	secondaryAction?: ReactNode;
	meta?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<section className={PW_VISIBLE_HERO_CLASS}>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
				<div className="grid gap-3">
					<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
						{eyebrow}
					</p>
					<div className="grid gap-2">
						<h3 className="max-w-3xl text-2xl font-semibold leading-tight text-(--desktop-text-primary)">
							{title}
						</h3>
						<p className="max-w-2xl text-sm leading-6 text-(--desktop-text-secondary)">
							{description}
						</p>
					</div>
					{primaryAction || secondaryAction ? (
						<div className="flex flex-wrap gap-2">
							{primaryAction}
							{secondaryAction}
						</div>
					) : null}
				</div>
				<div className="grid gap-3">
					{meta}
					{children}
				</div>
			</div>
		</section>
	);
}

export function ProfessionalWorldsActionCard({
	eyebrow,
	title,
	description,
	actionLabel,
	onAction,
	tone = 'neutral',
	disabled = false,
	className,
}: {
	eyebrow?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	actionLabel?: ReactNode;
	onAction?: () => void;
	tone?: ProfessionalWorldsTone;
	disabled?: boolean;
	className?: string;
}) {
	const body = (
		<>
			{eyebrow ? (
				<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-(--desktop-text-muted)">
					{eyebrow}
				</p>
			) : null}
			<strong
				className={cn('block text-sm leading-5', PW_TONE_LABEL_CLASS[tone])}
			>
				{title}
			</strong>
			{description ? (
				<p className="text-xs leading-5 text-(--desktop-text-secondary)">
					{description}
				</p>
			) : null}
			{actionLabel ? (
				<span className="text-xs font-medium text-[rgb(var(--desktop-accent-rgb))]">
					{actionLabel}
				</span>
			) : null}
		</>
	);

	if (onAction) {
		return (
			<button
				type="button"
				disabled={disabled}
				onClick={onAction}
				className={cn(
					PW_VISIBLE_CARD_INTERACTIVE_CLASS,
					'grid gap-2 disabled:cursor-not-allowed disabled:opacity-60',
					className
				)}
			>
				{body}
			</button>
		);
	}

	return (
		<article className={cn(PW_VISIBLE_CARD_CLASS, 'grid gap-2', className)}>
			{body}
		</article>
	);
}

export function ProfessionalWorldsProgressRail({
	title,
	items,
}: {
	title: ReactNode;
	items: ProfessionalWorldsProgressRailItem[];
}) {
	const completed = items.filter((item) => item.complete).length;
	return (
		<aside className={PW_VISIBLE_PROGRESS_RAIL_CLASS}>
			<div className="flex items-center justify-between gap-2">
				<strong className="text-sm text-(--desktop-text-primary)">
					{title}
				</strong>
				<span className="rounded-full bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-secondary)">
					{completed}/{items.length}
				</span>
			</div>
			<ul className="grid gap-2">
				{items.map((item) => (
					<li key={item.id} className="grid gap-1">
						<div className="flex items-center justify-between gap-2 text-xs">
							<span className="text-(--desktop-text-secondary)">
								{item.label}
							</span>
							<span
								className={
									item.complete
										? PW_TONE_LABEL_CLASS.ok
										: 'text-(--desktop-text-muted)'
								}
							>
								{item.value}
							</span>
						</div>
						<div className="h-1.5 overflow-hidden rounded-full bg-(--desktop-surface-soft)">
							<div
								className="h-full rounded-full bg-[rgb(var(--desktop-accent-rgb))] transition-[width] duration-300 motion-reduce:transition-none"
								style={{ width: item.complete ? '100%' : '32%' }}
							/>
						</div>
						{item.helper ? (
							<p className="text-[11px] text-(--desktop-text-muted)">
								{item.helper}
							</p>
						) : null}
					</li>
				))}
			</ul>
		</aside>
	);
}

export function ProfessionalWorldsTrustNote({
	title,
	children,
	action,
}: {
	title: ReactNode;
	children: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="rounded-(--desktop-radius) border border-[rgb(var(--desktop-accent-rgb))]/25 bg-(--desktop-surface-accent) px-3 py-2">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="grid gap-1">
					<strong className="text-xs text-(--desktop-text-primary)">
						{title}
					</strong>
					<p className="text-[11px] leading-5 text-(--desktop-text-secondary)">
						{children}
					</p>
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
		</div>
	);
}
