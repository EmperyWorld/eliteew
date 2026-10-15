/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Advanced Site Manager Ops view: filtered site cards, instance search, recovery, jobs dump, templates and audit.
 *
 * Invariants:
 * - Presentational wiring only; data and mutations come from useSiteManagerOps.
 *
 * Related:
 * - ./RecoveryCard.tsx
 * - ./useSiteManagerOps.ts
 * - ../SiteManagerDrilldownPanel.tsx
 */
import * as React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { SiteDrilldownPanel } from '../SiteManagerDrilldownPanel';
import { EmptyLine, RowCard, SectionTitle } from '../SiteManagerOpsAtoms';
import { SelectedSiteBreadcrumb, SiteCard } from '../SiteManagerSiteCards';
import type {
	SiteManagerUxFilter,
	SiteManagerUxSort,
} from '../../siteManagerUserStatus';
import {
	formatAuditTarget,
	formatInstanceSearchSummary,
	formatTemplateSummary,
	formatTranslatedValue,
} from './siteManagerOpsFormatters';
import { RecoveryCard } from './RecoveryCard';
import { KirsCollaborationOpsCard } from './KirsCollaborationOpsCard';
import type { SiteManagerOpsModel } from './useSiteManagerOps';

export const AdvancedModePanel: React.FC<{ ops: SiteManagerOpsModel }> = ({
	ops,
}) => {
	const {
		t,
		overview,
		templates,
		controls,
		updateControls,
		busy,
		confirmAction,
		setConfirmAction,
		selectedSiteKey,
		selectSiteKey,
		visibleCards,
		uxOverview,
		selectedDrilldown,
		selectedAttentionIssues,
		issueDigestByCardKey,
		selectedTopSignalSection,
		isInstancesOverviewTruncated,
		serverSearchQuery,
		instanceSearchPage,
		instanceSearchBusy,
		instanceSearchError,
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
			<KirsCollaborationOpsCard />
			<DesktopAppSurface variant="soft" padding="sm" className="space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<SectionTitle title={t('siteManager.siteCards.title')} />
						<p className="mt-2 max-w-3xl text-sm leading-6 text-(--desktop-text-secondary)">
							{t('siteManager.siteCards.description')}
						</p>
					</div>
					<div className="flex flex-wrap items-end gap-2">
						<div className="grid min-w-56 gap-1">
							<label
								htmlFor="site-manager-search"
								className="text-xs text-(--desktop-text-dim)"
							>
								{t('siteManager.siteCards.searchLabel')}
							</label>
							<DesktopAppInput
								id="site-manager-search"
								value={controls.searchQuery}
								onChange={(event) =>
									updateControls({ searchQuery: event.target.value })
								}
								placeholder={t('siteManager.siteCards.searchPlaceholder')}
							/>
						</div>
						<div className="grid min-w-48 gap-1">
							<label
								htmlFor="site-manager-sort"
								className="text-xs text-(--desktop-text-dim)"
							>
								{t('siteManager.siteCards.sortLabel')}
							</label>
							<select
								id="site-manager-sort"
								value={controls.sort}
								onChange={(event) =>
									updateControls({
										sort: event.target.value as SiteManagerUxSort,
									})
								}
								className="h-9 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-app) px-3 text-sm text-(--desktop-text-primary) outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/55"
							>
								{(
									[
										'attention',
										'updated_desc',
										'publication',
										'domain',
										'active_job',
									] as SiteManagerUxSort[]
								).map((item) => (
									<option key={item} value={item}>
										{t(`siteManager.siteCards.sort.${item}`)}
									</option>
								))}
							</select>
						</div>
						{(
							[
								'all',
								'needs_attention',
								'published',
								'domains_pending',
								'jobs_running',
							] as SiteManagerUxFilter[]
						).map((item) => (
							<DesktopAppButton
								key={item}
								type="button"
								size="sm"
								variant={controls.filter === item ? 'accent' : 'ghost'}
								onClick={() => updateControls({ filter: item })}
							>
								{t(`siteManager.filters.${item}`, {
									count: uxOverview?.counts[item] ?? 0,
								})}
							</DesktopAppButton>
						))}
					</div>
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
				{visibleCards.length ? (
					<div className="grid gap-3 xl:grid-cols-2">
						{visibleCards.map((card) => {
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
					<EmptyLine text={t('siteManager.siteCards.empty')} />
				)}
				{isInstancesOverviewTruncated && serverSearchQuery.length >= 2 ? (
					<DesktopAppSurface
						variant="soft"
						padding="sm"
						className="space-y-3 border border-amber-400/20 bg-amber-500/5"
						data-testid="site-manager-instance-search-results"
					>
						<div className="flex flex-wrap items-start justify-between gap-2">
							<div>
								<SectionTitle title={t('siteManager.instanceSearch.title')} />
								<p className="mt-1 text-sm leading-6 text-(--desktop-text-secondary)">
									{t('siteManager.instanceSearch.description')}
								</p>
							</div>
							{instanceSearchBusy ? (
								<span className="inline-flex items-center gap-1 text-xs text-amber-100">
									<ArrowPathIcon className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
									{t('siteManager.instanceSearch.loading')}
								</span>
							) : null}
						</div>
						{instanceSearchError ? (
							<div className="rounded-md border border-red-400/25 bg-red-500/10 p-2 text-xs text-red-100">
								{instanceSearchError}
							</div>
						) : null}
						{instanceSearchPage?.items.length ? (
							<div className="grid gap-2">
								{instanceSearchPage.items.map((instance) => (
									<div
										key={`${instance.instance_scope}:${instance.id}`}
										className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface) p-3 text-sm"
									>
										<div className="flex flex-wrap items-start justify-between gap-2">
											<div className="min-w-0">
												<div className="wrap-break-word font-medium text-(--desktop-text-primary)">
													{instance.site_title || instance.site_slug}
												</div>
												<div className="mt-1 text-xs text-(--desktop-text-muted)">
													{formatInstanceSearchSummary(t, instance)}
												</div>
												<div className="mt-1 break-all text-xs text-(--desktop-text-secondary)">
													{instance.public_hostname}
												</div>
											</div>
											{instance.public_url ? (
												<DesktopAppButton
													type="button"
													size="sm"
													variant="ghost"
													onClick={() =>
														window.open(
															instance.public_url as string,
															'_blank',
															'noopener,noreferrer'
														)
													}
												>
													{t('siteManager.actions.openPublic')}
												</DesktopAppButton>
											) : null}
										</div>
									</div>
								))}
							</div>
						) : !instanceSearchBusy && !instanceSearchError ? (
							<EmptyLine text={t('siteManager.instanceSearch.empty')} />
						) : null}
						{instanceSearchPage?.has_more ? (
							<p className="text-xs text-amber-100/85">
								{t('siteManager.instanceSearch.hasMore', {
									count: instanceSearchPage.returned,
								})}
							</p>
						) : null}
					</DesktopAppSurface>
				) : null}
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

			<section className="grid gap-4 xl:grid-cols-2">
				<DesktopAppSurface
					id="site-manager-recovery"
					variant="soft"
					padding="sm"
					className="space-y-3 scroll-mt-4"
				>
					<SectionTitle title={t('siteManager.recovery.title')} />
					<p className="text-sm leading-6 text-(--desktop-text-secondary)">
						{t('siteManager.recovery.description')}
					</p>
					{uxOverview?.recoveryCards.length ? (
						uxOverview.recoveryCards.map((card) => (
							<RecoveryCard key={card.key} card={card} t={t} />
						))
					) : (
						<EmptyLine text={t('siteManager.recovery.empty')} />
					)}
				</DesktopAppSurface>

				<DesktopAppSurface
					variant="soft"
					padding="sm"
					className="space-y-3"
					data-testid="site-manager-jobs-dump"
				>
					<SectionTitle title={t('siteManager.jobsDump.title')} />
					<p className="text-sm leading-6 text-(--desktop-text-secondary)">
						{t('siteManager.jobsDump.description')}
					</p>
					{overview?.jobs.length ? (
						overview.jobs.map((job) => (
							<RowCard key={job.id}>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium text-(--desktop-text-primary)">
										{job.site_slug} · {job.id}
									</div>
									<div className="mt-1 text-xs text-(--desktop-text-muted)">
										{[
											formatTranslatedValue(
												t,
												'siteManager.jobType',
												job.task_type
											),
											formatTranslatedValue(
												t,
												'siteManager.jobStatus',
												job.status
											),
											formatTranslatedValue(
												t,
												'siteManager.jobStage',
												job.stage
											),
										].join(' · ')}
									</div>
									{job.last_error ? (
										<div className="mt-1 text-xs text-amber-100">
											{job.last_error}
										</div>
									) : null}
								</div>
							</RowCard>
						))
					) : (
						<EmptyLine text={t('siteManager.jobsDump.empty')} />
					)}
				</DesktopAppSurface>
			</section>

			<DesktopAppSurface variant="soft" padding="sm" className="space-y-3">
				<SectionTitle title={t('siteManager.operatorDetails.title')} />
				<p className="text-sm leading-6 text-(--desktop-text-secondary)">
					{t('siteManager.operatorDetails.description')}
				</p>
				<section className="grid gap-4 xl:grid-cols-2">
					<DesktopAppSurface variant="soft" padding="sm" className="space-y-3">
						<SectionTitle title={t('siteManager.operatorDetails.templates')} />
						{(templates?.templates ?? []).map((template) => (
							<RowCard key={template.template_key}>
								<div>
									<div className="text-sm font-medium text-(--desktop-text-primary)">
										{template.template_key} ·{' '}
										{template.profile_id ?? 'no profile'}
									</div>
									<div className="mt-1 text-xs text-(--desktop-text-muted)">
										{formatTemplateSummary(t, template)}
									</div>
								</div>
							</RowCard>
						))}
					</DesktopAppSurface>

					<DesktopAppSurface variant="soft" padding="sm" className="space-y-3">
						<SectionTitle title={t('siteManager.operatorDetails.audit')} />
						{overview?.audit_events.length ? (
							overview.audit_events.map((event) => (
								<RowCard key={event.id}>
									<div className="min-w-0">
										<div className="break-all text-sm font-medium text-(--desktop-text-primary)">
											{formatTranslatedValue(
												t,
												'siteManager.auditAction',
												event.action
											)}
										</div>
										<div className="mt-1 text-xs text-(--desktop-text-muted)">
											{formatAuditTarget(t, event)}
										</div>
									</div>
								</RowCard>
							))
						) : (
							<EmptyLine text={t('siteManager.operatorDetails.noAudit')} />
						)}
					</DesktopAppSurface>
				</section>
			</DesktopAppSurface>
		</>
	);
};
