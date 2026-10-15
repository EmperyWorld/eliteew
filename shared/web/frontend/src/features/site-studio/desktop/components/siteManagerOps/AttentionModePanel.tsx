/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Attention view for Site Manager Ops: metrics, site cards, DNS/TLS queue and selected-site drilldown.
 *
 * Invariants:
 * - Presentational wiring only; data and mutations come from useSiteManagerOps.
 *
 * Related:
 * - ./useSiteManagerOps.ts
 * - ../SiteManagerDrilldownPanel.tsx
 * - ../SiteManagerSiteCards.tsx
 */
import * as React from 'react';
import {
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { SiteDrilldownPanel } from '../SiteManagerDrilldownPanel';
import {
	EmptyLine,
	MetricCard,
	RowCard,
	SectionTitle,
} from '../SiteManagerOpsAtoms';
import { SelectedSiteBreadcrumb, SiteCard } from '../SiteManagerSiteCards';
import { formatTranslatedValue } from './siteManagerOpsFormatters';
import type { SiteManagerOpsModel } from './useSiteManagerOps';

export const AttentionModePanel: React.FC<{ ops: SiteManagerOpsModel }> = ({
	ops,
}) => {
	const {
		t,
		overview,
		busy,
		confirmAction,
		setConfirmAction,
		updateControls,
		selectedSiteKey,
		selectSiteKey,
		modeSiteCards,
		selectedDrilldown,
		selectedAttentionIssues,
		issueDigestByCardKey,
		selectedTopSignalSection,
		staleJobs,
		pendingOutbox,
		pendingDnsTlsQueue,
		truncatedOverviewLimits,
		handleCardAction,
		focusSelectedDrilldown,
		focusSelectedSignal,
		focusCardSignal,
		runJobCancel,
		runJobRetry,
		runReconcileMarkFailed,
	} = ops;

	return (
		<>
			<div className="grid gap-3 md:grid-cols-4">
				<MetricCard
					label={t('siteManager.metrics.worker')}
					value={overview?.worker.worker_ready ? 'ready' : 'offline'}
					tone={overview?.worker.worker_ready ? 'ok' : 'warn'}
				/>
				<MetricCard
					label={t('siteManager.metrics.openJobs')}
					value={staleJobs.length}
				/>
				<MetricCard
					label={t('siteManager.metrics.dnsPending')}
					value={pendingOutbox.length}
				/>
				<MetricCard
					label={t('siteManager.metrics.reconcile')}
					value={overview?.reconcile.count ?? '—'}
				/>
			</div>

			{truncatedOverviewLimits.length ? (
				<DesktopAppSurface
					variant="soft"
					padding="sm"
					className="border border-amber-400/25 bg-amber-500/10 text-sm text-amber-50"
				>
					<div className="font-medium">
						{t('siteManager.overviewLimits.title')}
					</div>
					<p className="mt-1 leading-6 text-amber-100/85">
						{t('siteManager.overviewLimits.description', {
							count: truncatedOverviewLimits.length,
						})}
					</p>
					<ul className="mt-2 grid gap-1 text-xs text-amber-100/85 sm:grid-cols-2">
						{truncatedOverviewLimits.map(([key, meta]) => (
							<li key={key}>
								{formatTranslatedValue(
									t,
									'siteManager.overviewLimits.collection',
									key
								)}
								: {meta.returned}/{meta.limit}
							</li>
						))}
					</ul>
				</DesktopAppSurface>
			) : null}

			<DesktopAppSurface variant="soft" padding="sm" className="space-y-4">
				<div>
					<SectionTitle title={t('siteManager.siteCards.title')} />
					<p className="mt-2 max-w-3xl text-sm leading-6 text-(--desktop-text-secondary)">
						{t('siteManager.attention.siteCardsDescription')}
					</p>
				</div>
				{selectedDrilldown ? (
					<SelectedSiteBreadcrumb
						card={selectedDrilldown.card}
						issueCount={selectedAttentionIssues.length}
						issueSeverity={selectedAttentionIssues[0]?.severity ?? 'ok'}
						onOpenDetails={focusSelectedDrilldown}
						onOpenSignal={
							selectedTopSignalSection ? focusSelectedSignal : undefined
						}
						t={t}
					/>
				) : null}
				{modeSiteCards.length ? (
					<div className="grid gap-3 xl:grid-cols-2">
						{modeSiteCards.map((card) => {
							const signalSummary = issueDigestByCardKey.get(card.key);
							const targetSectionId = signalSummary?.targetSectionId ?? null;
							return (
								<SiteCard
									key={card.key}
									card={card}
									busy={busy === `smoke:${card.key}`}
									issueCount={signalSummary?.count ?? 0}
									issueSeverity={signalSummary?.severity ?? 'ok'}
									topIssueDetail={signalSummary?.detail ?? null}
									topIssueTitleKey={signalSummary?.titleKey ?? null}
									selected={selectedSiteKey === card.key}
									onAction={(action) => handleCardAction(card, action)}
									onOpenSignal={
										targetSectionId
											? () => focusCardSignal(card.key, targetSectionId)
											: undefined
									}
									onSelect={() => selectSiteKey(card.key)}
									t={t}
								/>
							);
						})}
					</div>
				) : (
					<EmptyLine text={t('siteManager.attention.siteCardsEmpty')} />
				)}
			</DesktopAppSurface>

			<DesktopAppSurface
				variant="soft"
				padding="sm"
				className="space-y-3"
				data-testid="site-manager-dns-tls-queue"
			>
				<SectionTitle title={t('siteManager.attention.queueTitle')} />
				<p className="text-sm leading-6 text-(--desktop-text-secondary)">
					{t('siteManager.attention.queueDescription')}
				</p>
				{pendingDnsTlsQueue.outbox.length ||
				pendingDnsTlsQueue.domains.length ? (
					<div className="grid gap-2">
						{pendingDnsTlsQueue.outbox.map((row) => (
							<RowCard key={row.id}>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium text-(--desktop-text-primary)">
										{row.hostname}
									</div>
									<div className="mt-1 text-xs text-(--desktop-text-muted)">
										{t('siteManager.attention.queueRoutePending', {
											target: row.target_hostname,
										})}
									</div>
								</div>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => updateControls({ viewMode: 'domains' })}
								>
									{t('siteManager.attention.openDomains')}
								</DesktopAppButton>
							</RowCard>
						))}
						{pendingDnsTlsQueue.domains.map((domain) => (
							<RowCard key={domain.binding.id}>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium text-(--desktop-text-primary)">
										{domain.binding.hostname}
									</div>
									<div className="mt-1 text-xs text-(--desktop-text-muted)">
										{t(domain.statusKey)}
									</div>
								</div>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => updateControls({ viewMode: 'domains' })}
								>
									{t('siteManager.attention.openDomains')}
								</DesktopAppButton>
							</RowCard>
						))}
					</div>
				) : (
					<EmptyLine text={t('siteManager.attention.queueEmpty')} />
				)}
			</DesktopAppSurface>

			{selectedDrilldown ? (
				<SiteDrilldownPanel
					drilldown={selectedDrilldown}
					busy={busy}
					confirmAction={confirmAction}
					onConfirmAction={setConfirmAction}
					onJobCancel={(job) => void runJobCancel(job)}
					onJobRetry={(job) => void runJobRetry(job)}
					onReconcileMarkFailed={(card, issue) =>
						void runReconcileMarkFailed(card, issue)
					}
					t={t}
				/>
			) : null}
		</>
	);
};
