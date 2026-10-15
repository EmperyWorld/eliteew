/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentational cards for the Site Manager overview and selected-site breadcrumb.
 * Keeps compact site status rendering separate from data loading and repair actions.
 *
 * Invariants:
 * - Components are stateless and receive already-derived Site Manager UX models.
 * - Signal badges render caller-provided attention counts and never derive issue semantics locally.
 *
 * Related:
 * - ./SiteManagerOpsPanel.tsx
 * - ../siteManagerUserStatus.ts
 */
import * as React from 'react';
import type { TFunction } from 'i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import type {
	SiteManagerUxNextAction,
	SiteManagerUxSeverity,
	SiteManagerUxSiteCard,
} from '../siteManagerUserStatus';

function toneClass(tone: SiteManagerUxSeverity): string {
	if (tone === 'ok')
		return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100';
	if (tone === 'danger') return 'border-red-400/25 bg-red-500/10 text-red-100';
	if (tone === 'warn')
		return 'border-amber-400/25 bg-amber-500/10 text-amber-100';
	return 'border-sky-400/25 bg-sky-500/10 text-sky-100';
}

function formatTranslatedValue(
	t: TFunction<'siteStudio'>,
	prefix: string,
	value: string | null | undefined
): string {
	if (!value) return '—';
	const translated = t(`${prefix}.${value}`, { defaultValue: value });
	return translated === value ? t('siteManager.unknownStatus') : translated;
}

function formatDate(value: string | null | undefined): string {
	if (!value) return '—';
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export const SiteCard: React.FC<{
	card: SiteManagerUxSiteCard;
	busy: boolean;
	issueCount: number;
	issueSeverity: SiteManagerUxSeverity;
	topIssueDetail: string | null;
	topIssueTitleKey: string | null;
	selected: boolean;
	onAction: (action: SiteManagerUxNextAction) => void;
	onOpenSignal?: () => void;
	onSelect: () => void;
	t: TFunction<'siteStudio'>;
}> = ({
	card,
	busy,
	issueCount,
	issueSeverity,
	topIssueDetail,
	topIssueTitleKey,
	selected,
	onAction,
	onOpenSignal,
	onSelect,
	t,
}) => (
	<div
		data-testid={`site-manager-card-${card.key}`}
		className={`rounded-xl border bg-(--desktop-surface) p-4 ${
			selected
				? 'border-[rgb(var(--desktop-accent-rgb))]/45'
				: 'border-(--desktop-border)'
		}`}
	>
		<div className="flex flex-wrap items-start justify-between gap-3">
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="wrap-break-word text-base font-semibold text-(--desktop-text-primary)">
						{card.instance.site_title || card.instance.site_slug}
					</h3>
					<span
						className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass(card.severity)}`}
					>
						{t(card.stateKey)}
					</span>
					{onOpenSignal && issueCount > 0 ? (
						<button
							type="button"
							data-testid={`site-manager-card-signal-${card.key}`}
							className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition hover:brightness-110 ${toneClass(issueSeverity)}`}
							aria-label={t('siteManager.siteCards.jumpToSignal')}
							onClick={onOpenSignal}
						>
							{t('siteManager.siteCards.selectedSignals', {
								count: issueCount,
							})}
						</button>
					) : (
						<span
							className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass(issueSeverity)}`}
						>
							{t('siteManager.siteCards.selectedSignals', {
								count: issueCount,
							})}
						</span>
					)}
				</div>
				<div className="mt-2 flex flex-wrap gap-1">
					{[
						{
							key: 'scope',
							label: t('siteManager.siteCards.metaScope'),
							value: formatTranslatedValue(
								t,
								'siteManager.scope',
								card.instance.instance_scope
							),
						},
						{
							key: 'slug',
							label: t('siteManager.siteCards.metaSlug'),
							value: card.instance.site_slug,
						},
						{
							key: 'status',
							label: t('siteManager.siteCards.metaStatus'),
							value: formatTranslatedValue(
								t,
								'siteManager.instanceStatus',
								card.instance.status
							),
						},
					].map((item) => (
						<span
							key={item.key}
							className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-muted)"
						>
							<span className="text-(--desktop-text-dim)">{item.label}: </span>
							<span className="font-medium text-(--desktop-text-primary)">
								{item.value}
							</span>
						</span>
					))}
				</div>
			</div>
			<div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
				<div className="text-[11px] uppercase tracking-[0.16em] text-(--desktop-text-dim)">
					{t('siteManager.siteCards.nextActionLabel')}
				</div>
				<DesktopAppButton
					type="button"
					size="sm"
					variant={card.severity === 'danger' ? 'danger' : 'accent'}
					disabled={busy}
					onClick={() => onAction(card.nextAction)}
				>
					{busy ? <ArrowPathIcon className="size-4 animate-spin" /> : null}
					{t(card.nextActionKey)}
				</DesktopAppButton>
			</div>
		</div>
		<p className="mt-3 text-sm leading-6 text-(--desktop-text-secondary)">
			{t(card.descriptionKey)}
		</p>
		{topIssueTitleKey && topIssueDetail ? (
			<div
				className={`mt-3 rounded-md border p-2 text-xs ${toneClass(issueSeverity)}`}
			>
				<div className="uppercase tracking-[0.14em] opacity-75">
					{t('siteManager.siteCards.topSignal')}
				</div>
				<div className="mt-1 font-medium">{t(topIssueTitleKey)}</div>
				<div className="mt-1 wrap-break-word opacity-85">{topIssueDetail}</div>
			</div>
		) : null}
		<div className="mt-3 grid gap-2 text-xs text-(--desktop-text-secondary) sm:grid-cols-2 xl:grid-cols-4">
			<div className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2">
				<div className="text-(--desktop-text-dim)">
					{t('siteManager.card.publication')}
				</div>
				<div className="mt-1 font-medium text-(--desktop-text-primary)">
					{formatTranslatedValue(
						t,
						'siteManager.publicationState',
						card.instance.publication_state
					)}
				</div>
			</div>
			<div className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2">
				<div className="text-(--desktop-text-dim)">
					{t('siteManager.card.domain')}
				</div>
				<div className="mt-1 font-medium text-(--desktop-text-primary)">
					{t(card.domainSummaryKey)}
				</div>
			</div>
			<div className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2">
				<div className="text-(--desktop-text-dim)">
					{t('siteManager.card.updated')}
				</div>
				<div className="mt-1 font-medium text-(--desktop-text-primary)">
					{formatDate(card.instance.updated_at)}
				</div>
			</div>
			<div className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2">
				<div className="text-(--desktop-text-dim)">
					{t('siteManager.card.lastCheck')}
				</div>
				<div className="mt-1 font-medium text-(--desktop-text-primary)">
					{card.smokeResult
						? t(`siteManager.smoke.${card.smokeResult.status}`, {
								failures: card.smokeResult.hard_failure_count,
							})
						: t('siteManager.smoke.notRun')}
				</div>
			</div>
		</div>
		{card.smokeResult?.checks.length ? (
			<div className="mt-3 rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2">
				<div className="text-xs uppercase tracking-[0.16em] text-(--desktop-text-dim)">
					{t('siteManager.smokeDetails.title')}
				</div>
				<ul className="mt-2 space-y-1 text-xs text-(--desktop-text-secondary)">
					{card.smokeResult.checks.slice(0, 4).map((check) => (
						<li
							key={check.key}
							className={check.ok ? 'text-emerald-100' : 'text-amber-100'}
						>
							{check.ok
								? t('siteManager.smokeDetails.ok')
								: t('siteManager.smokeDetails.fail')}{' '}
							· {check.message}
						</li>
					))}
				</ul>
			</div>
		) : null}
		<div className="mt-3 flex justify-end">
			<DesktopAppButton
				type="button"
				size="sm"
				variant={selected ? 'neutral' : 'ghost'}
				onClick={onSelect}
			>
				{selected
					? t('siteManager.drilldown.selected')
					: t('siteManager.drilldown.open')}
			</DesktopAppButton>
		</div>
	</div>
);

export const SelectedSiteBreadcrumb: React.FC<{
	card: SiteManagerUxSiteCard;
	issueCount: number;
	issueSeverity: SiteManagerUxSeverity;
	onOpenDetails: () => void;
	onOpenSignal?: () => void;
	t: TFunction<'siteStudio'>;
}> = ({ card, issueCount, issueSeverity, onOpenDetails, onOpenSignal, t }) => (
	<div
		className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface) p-3"
		data-testid="site-manager-selected-breadcrumb"
	>
		<div className="min-w-0">
			<div className="text-[11px] uppercase tracking-[0.16em] text-(--desktop-text-dim)">
				{t('siteManager.siteCards.selectedContext')}
			</div>
			<div className="mt-1 flex flex-wrap items-center gap-2">
				<span className="wrap-break-word text-sm font-medium text-(--desktop-text-primary)">
					{card.instance.site_title || card.instance.site_slug}
				</span>
				<span
					className={`rounded-full border px-2 py-0.5 text-[11px] ${toneClass(card.severity)}`}
				>
					{t(card.stateKey)}
				</span>
				{onOpenSignal && issueCount > 0 ? (
					<button
						type="button"
						data-testid="site-manager-selected-signal"
						className={`rounded-full border px-2 py-0.5 text-[11px] transition hover:brightness-110 ${toneClass(issueSeverity)}`}
						aria-label={t('siteManager.siteCards.jumpToSignal')}
						onClick={onOpenSignal}
					>
						{t('siteManager.siteCards.selectedSignals', {
							count: issueCount,
						})}
					</button>
				) : (
					<span
						className={`rounded-full border px-2 py-0.5 text-[11px] ${toneClass(issueSeverity)}`}
					>
						{t('siteManager.siteCards.selectedSignals', {
							count: issueCount,
						})}
					</span>
				)}
			</div>
			<div className="mt-1 text-xs text-(--desktop-text-muted)">
				{formatTranslatedValue(
					t,
					'siteManager.scope',
					card.instance.instance_scope
				)}{' '}
				· {card.instance.site_slug} · {t(card.domainSummaryKey)}
			</div>
		</div>
		<DesktopAppButton
			type="button"
			size="sm"
			variant="ghost"
			data-testid="site-manager-selected-details"
			onClick={onOpenDetails}
		>
			{t('siteManager.siteCards.jumpToDetails')}
		</DesktopAppButton>
	</div>
);
