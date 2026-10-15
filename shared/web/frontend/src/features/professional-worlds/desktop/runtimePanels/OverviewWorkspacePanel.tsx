/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overview workspace: dashboard pulse metrics and vertical activation wizard.
 *
 * Invariants:
 * - Metrics are derived from the workspace snapshot for the active `vertical_slug`.
 * - Pulse metric tiles navigate to the matching workspace when clicked.
 * - Empty Clients metric routes to Leads addon when `realtor_leads` is enabled.
 * - Today's focus surfaces CRM tasks, Leads, listing-link backfill, and Communications follow-ups when relevant.
 * - Realtor context summary stays snapshot-derived; showings/tasks are linked as addon entry points until they join snapshot.
 *
 * Related:
 * - ProfessionalWorldsWorkspaceContext.tsx
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import { useProfessionalWorldsWorkspace } from '../ProfessionalWorldsWorkspaceContext';
import {
	ProfessionalWorldsMetricCard,
	ProfessionalWorldsActionCard,
	ProfessionalWorldsHeroPanel,
	ProfessionalWorldsProgressRail,
	ProfessionalWorldsTrustNote,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
	ProfessionalWorldsWorkspaceSubtabs,
	pwMetricGridClass,
	pwContextSummaryGridClass,
} from '../layout';
import { RuntimeOnboardingWizard } from '../RuntimeOnboardingWizard';
import {
	buildRealtorCrmFollowUpItems,
	countDealsNeedingPropertyBackfill,
	countOverviewCrmFollowUps,
	findUniqueDealForPropertyId,
	pickFirstOverviewCrmFollowUpCommunicationFocus,
	resolveOverviewClientsNavigation,
} from '../realtorLogic';
import { buildVerticalDashboardMetrics } from '../verticalDashboardMetrics';
import { FieldModeQuickPanel } from '../components/FieldModeQuickPanel';
import { OverviewStaleDraftsBanner } from '../components/OverviewStaleDraftsBanner';
import { isProfessionalWorldsFieldMode } from '../professionalWorldsFieldMode';
import { buildRealtorWeekFocusLines } from '../realtorWeekFocusLogic';
import {
	realtorWeekFocusActionI18nKey,
	resolveRealtorWeekFocusAction,
} from '../realtorWeekFocusActionsLogic';
import {
	isOnboardingWizardComplete,
	onboardingStepNavigateTarget,
} from '../onboardingWizardLogic';
import {
	deriveNavProgressStage,
	type ProfessionalWorldsNavProgressStage,
} from '../professionalWorldsNavMode';

export function OverviewWorkspacePanel() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		activeActivation,
		activeRuntimeConfig,
		activeVertical,
		activeVerticalSlug,
		listingWorkspaceEnabled,
		openClients,
		openCommunications,
		openPipeline,
		openShowings,
		openTasks,
		openProfessionTool,
		openArtifacts,
		openProperties,
		navigate,
		patchOnboarding,
		selectedProperty,
		snapshot,
		verticalAddonModules,
		embeddedMobileLayout,
	} = useProfessionalWorldsWorkspace();
	const pipelineModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_pipeline'
	);
	const leadsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_leads'
	);
	const tasksModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_tasks'
	);
	const showingsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_showings'
	);
	const communicationsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_communications'
	);
	const [overviewWorkspaceTab, setOverviewWorkspaceTab] = useState<
		'pulse' | 'activation'
	>('pulse');

	const metrics = useMemo(
		() =>
			buildVerticalDashboardMetrics({
				verticalSlug: activeVerticalSlug,
				profile: snapshot.profile,
				properties: snapshot.properties,
				clients: snapshot.clients,
				deals: snapshot.deals,
				courses: snapshot.courses,
				artifacts: snapshot.artifacts,
			}),
		[activeVerticalSlug, snapshot]
	);
	const progressStage = useMemo(
		() =>
			deriveNavProgressStage({
				profileReady: metrics.profileReady,
				onboardingComplete: isOnboardingWizardComplete(
					activeActivation?.onboarding
				),
				propertiesCount: snapshot.properties.length,
			}),
		[
			activeActivation?.onboarding,
			metrics.profileReady,
			snapshot.properties.length,
		]
	);

	const crmFollowUpCount = useMemo(
		() => countOverviewCrmFollowUps(snapshot.deals, snapshot.clients),
		[snapshot.clients, snapshot.deals]
	);
	const crmFollowUpCommunicationFocus = useMemo(
		() =>
			pickFirstOverviewCrmFollowUpCommunicationFocus(
				snapshot.deals,
				snapshot.clients,
				{
					dealFallback: t('realtorPro.tasks.followUpDeal'),
					clientFallback: t('realtorPro.tasks.followUpClient'),
				}
			),
		[snapshot.clients, snapshot.deals, t]
	);
	const firstCrmFollowUp = useMemo(
		() =>
			buildRealtorCrmFollowUpItems(snapshot.deals, snapshot.clients, {
				dealFallback: t('realtorPro.tasks.followUpDeal'),
				clientFallback: t('realtorPro.tasks.followUpClient'),
			})[0] ?? null,
		[snapshot.clients, snapshot.deals, t]
	);
	const dealsNeedingBackfill = useMemo(
		() =>
			countDealsNeedingPropertyBackfill(snapshot.deals, snapshot.properties),
		[snapshot.deals, snapshot.properties]
	);
	const clientsNavigationTarget = useMemo(
		() =>
			resolveOverviewClientsNavigation(
				metrics.activeClients,
				leadsModuleEnabled
			),
		[leadsModuleEnabled, metrics.activeClients]
	);
	const contextProperty = selectedProperty ?? null;
	const primaryWorkProperty = contextProperty ?? snapshot.properties[0] ?? null;
	const contextDeal = useMemo(
		() =>
			contextProperty
				? findUniqueDealForPropertyId(
						snapshot.deals,
						snapshot.properties,
						contextProperty.id
					)
				: null,
		[contextProperty, snapshot.deals, snapshot.properties]
	);
	const contextClient = useMemo(
		() =>
			contextDeal?.client_id
				? (snapshot.clients.find(
						(client) => client.id === contextDeal.client_id
					) ?? null)
				: null,
		[contextDeal?.client_id, snapshot.clients]
	);

	const handleClientsMetricNavigate = useCallback(() => {
		if (clientsNavigationTarget.kind === 'leadsModule') {
			openProfessionTool('realtor_leads');
			return;
		}
		openClients({ tab: 'directory' });
	}, [clientsNavigationTarget.kind, openClients, openProfessionTool]);

	const clientsMetricJumpLabel =
		clientsNavigationTarget.kind === 'leadsModule'
			? t('clients.openLeadsInProfessionTools')
			: t('overview.metricJump.clients');
	const hasFollowUpActions =
		(metrics.openDeals > 0 && pipelineModuleEnabled) ||
		(crmFollowUpCount > 0 && tasksModuleEnabled) ||
		(crmFollowUpCount > 0 &&
			communicationsModuleEnabled &&
			!!crmFollowUpCommunicationFocus) ||
		(metrics.activeClients === 0 && leadsModuleEnabled) ||
		(dealsNeedingBackfill > 0 && pipelineModuleEnabled);
	const heroPrimaryAction = useMemo(() => {
		if (!metrics.profileReady) {
			return {
				label: t('overview.visible.actions.completeProfile'),
				onClick: () => navigate('profile'),
			};
		}
		if (snapshot.properties.length === 0 && listingWorkspaceEnabled) {
			return {
				label: t('overview.visible.actions.addListing'),
				onClick: () => navigate('properties'),
			};
		}
		if (crmFollowUpCount > 0 && tasksModuleEnabled) {
			return {
				label: t('overview.visible.actions.reviewFollowUps', {
					count: crmFollowUpCount,
				}),
				onClick: () => openTasks(),
			};
		}
		if (metrics.artifactsTotal === 0) {
			return {
				label: t('overview.visible.actions.openPlaybooks'),
				onClick: () => navigate('playbooks'),
			};
		}
		return {
			label: t('overview.visible.actions.openArtifacts'),
			onClick: () => openArtifacts(),
		};
	}, [
		crmFollowUpCount,
		listingWorkspaceEnabled,
		metrics.artifactsTotal,
		metrics.profileReady,
		navigate,
		openArtifacts,
		openTasks,
		snapshot.properties.length,
		t,
		tasksModuleEnabled,
	]);
	const visibleProgressItems = useMemo(
		() => [
			{
				id: 'profile',
				label: t('overview.visible.progress.profile'),
				value: metrics.profileReady
					? t('overview.visible.progress.ready')
					: t('overview.visible.progress.todo'),
				complete: metrics.profileReady,
				helper: t('overview.visible.progress.profileHelp'),
			},
			{
				id: 'portfolio',
				label: t('overview.visible.progress.portfolio'),
				value: String(metrics.propertiesTotal),
				complete: metrics.propertiesTotal > 0,
				helper: t('overview.visible.progress.portfolioHelp'),
			},
			{
				id: 'clients',
				label: t('overview.visible.progress.clients'),
				value: String(metrics.activeClients),
				complete: metrics.activeClients > 0,
				helper: t('overview.visible.progress.clientsHelp'),
			},
			{
				id: 'results',
				label: t('overview.visible.progress.results'),
				value: String(metrics.artifactsTotal),
				complete: metrics.artifactsTotal > 0,
				helper: t('overview.visible.progress.resultsHelp'),
			},
		],
		[
			metrics.activeClients,
			metrics.artifactsTotal,
			metrics.profileReady,
			metrics.propertiesTotal,
			t,
		]
	);
	const visibleStageTone: Record<
		ProfessionalWorldsNavProgressStage,
		'warn' | 'neutral' | 'ok'
	> = {
		firstRun: 'warn',
		midProgress: 'neutral',
		complete: 'ok',
	};

	const weekFocusLines = useMemo(
		() =>
			buildRealtorWeekFocusLines({
				metrics,
				followUps: crmFollowUpCount,
				listingLinkGaps: dealsNeedingBackfill,
			}),
		[crmFollowUpCount, dealsNeedingBackfill, metrics]
	);

	const weekFocusModuleOptions = useMemo(
		() => ({
			pipelineModuleEnabled,
			tasksModuleEnabled,
			listingWorkspaceEnabled,
			leadsModuleEnabled,
		}),
		[
			leadsModuleEnabled,
			listingWorkspaceEnabled,
			pipelineModuleEnabled,
			tasksModuleEnabled,
		]
	);

	const handleWeekFocusAction = useCallback(
		(lineId: (typeof weekFocusLines)[number]['id']) => {
			const action = resolveRealtorWeekFocusAction(
				lineId,
				weekFocusModuleOptions
			);
			if (!action) return;
			switch (action) {
				case 'openProfile':
					navigate('profile');
					break;
				case 'openListings':
					navigate('properties');
					break;
				case 'openClients':
					openClients({ tab: 'directory' });
					break;
				case 'openPipeline':
					openPipeline();
					break;
				case 'openTasks':
					openTasks();
					break;
				case 'openLearning':
					navigate('learning');
					break;
				case 'openArtifacts':
					openArtifacts();
					break;
				default:
					break;
			}
		},
		[
			navigate,
			openArtifacts,
			openClients,
			openPipeline,
			openTasks,
			weekFocusModuleOptions,
		]
	);

	return (
		<ProfessionalWorldsWorkspaceSection
			title={t('nav.overview')}
			subtabs={
				<ProfessionalWorldsWorkspaceSubtabs
					active={overviewWorkspaceTab}
					ariaLabel={t('overview.workspaceAria')}
					items={[
						{ id: 'pulse', label: t('overview.tabs.pulse') },
						{ id: 'activation', label: t('overview.tabs.activation') },
					]}
					onSelect={(id) =>
						setOverviewWorkspaceTab(id as 'pulse' | 'activation')
					}
				/>
			}
		>
			{overviewWorkspaceTab === 'activation' ? (
				<RuntimeOnboardingWizard
					activation={activeActivation}
					runtimeConfig={activeRuntimeConfig}
					vertical={activeVertical}
					onPatchOnboarding={patchOnboarding}
					onNavigateToStep={(stepKey) => {
						const target = onboardingStepNavigateTarget(stepKey);
						if (target) {
							navigate(target);
						}
					}}
				/>
			) : null}
			{overviewWorkspaceTab === 'pulse' ? (
				<>
					<ProfessionalWorldsHeroPanel
						eyebrow={t('overview.visible.eyebrow')}
						title={t(`overview.visible.stage.${progressStage}.title`)}
						description={t(
							`overview.visible.stage.${progressStage}.description`
						)}
						primaryAction={
							<DesktopAppButton onClick={heroPrimaryAction.onClick}>
								{heroPrimaryAction.label}
							</DesktopAppButton>
						}
						secondaryAction={
							<DesktopAppButton
								variant="ghost"
								onClick={() => setOverviewWorkspaceTab('activation')}
							>
								{t('overview.visible.actions.openSetup')}
							</DesktopAppButton>
						}
						meta={
							<ProfessionalWorldsActionCard
								eyebrow={t('overview.visible.nextBest.eyebrow')}
								title={t(`overview.visible.nextBest.${progressStage}`)}
								description={t('overview.visible.nextBest.description')}
								actionLabel={heroPrimaryAction.label}
								tone={visibleStageTone[progressStage]}
								onAction={heroPrimaryAction.onClick}
							/>
						}
					>
						<ProfessionalWorldsProgressRail
							title={t('overview.visible.progress.title')}
							items={visibleProgressItems}
						/>
					</ProfessionalWorldsHeroPanel>
					<div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.6fr)]">
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
							<ProfessionalWorldsActionCard
								eyebrow={t('overview.visible.cards.profile.eyebrow')}
								title={
									metrics.profileReady
										? t('overview.visible.cards.profile.readyTitle')
										: t('overview.visible.cards.profile.title')
								}
								description={t('overview.visible.cards.profile.description')}
								actionLabel={t('overview.visible.cards.profile.action')}
								tone={metrics.profileReady ? 'ok' : 'warn'}
								onAction={() => navigate('profile')}
							/>
							<ProfessionalWorldsActionCard
								eyebrow={t('overview.visible.cards.portfolio.eyebrow')}
								title={
									primaryWorkProperty?.title ??
									t('overview.visible.cards.portfolio.title')
								}
								description={
									primaryWorkProperty
										? t('overview.visible.cards.portfolio.selected', {
												city:
													primaryWorkProperty.city ??
													t('overview.visible.cards.portfolio.cityFallback'),
											})
										: t('overview.visible.cards.portfolio.description')
								}
								actionLabel={t('overview.visible.cards.portfolio.action')}
								tone={primaryWorkProperty ? 'ok' : 'neutral'}
								onAction={() => navigate('properties')}
								disabled={!listingWorkspaceEnabled}
							/>
							<ProfessionalWorldsActionCard
								eyebrow={t('overview.visible.cards.clients.eyebrow')}
								title={
									crmFollowUpCount > 0
										? t('overview.visible.cards.clients.followUpTitle', {
												count: crmFollowUpCount,
											})
										: t('overview.visible.cards.clients.title')
								}
								description={t('overview.visible.cards.clients.description')}
								actionLabel={
									crmFollowUpCount > 0
										? t('overview.visible.cards.clients.followUpAction')
										: clientsMetricJumpLabel
								}
								tone={crmFollowUpCount > 0 ? 'warn' : 'neutral'}
								onAction={
									crmFollowUpCount > 0 && tasksModuleEnabled
										? () => openTasks()
										: handleClientsMetricNavigate
								}
							/>
							<ProfessionalWorldsActionCard
								eyebrow={t('overview.visible.cards.automation.eyebrow')}
								title={t('overview.visible.cards.automation.title')}
								description={t('overview.visible.cards.automation.description')}
								actionLabel={t('overview.visible.cards.automation.action')}
								tone="neutral"
								onAction={() => navigate('playbooks')}
							/>
						</div>
						<ProfessionalWorldsTrustNote
							title={t('overview.visible.trust.title')}
						>
							{t('overview.visible.trust.body')}
						</ProfessionalWorldsTrustNote>
					</div>
					<p className="text-sm text-(--desktop-text-secondary)">
						{t('overview.pulseLead')}
					</p>
					{isProfessionalWorldsFieldMode(embeddedMobileLayout) ? (
						<FieldModeQuickPanel />
					) : null}
					<OverviewStaleDraftsBanner
						onReviewHandoffs={() => openArtifacts({ tab: 'handoff' })}
					/>
					<ProfessionalWorldsWorkspacePanel
						title={t('overview.weekFocus.title')}
					>
						<ul className="grid gap-2 text-sm text-(--desktop-text-secondary)">
							{weekFocusLines.map((line) => {
								const action = resolveRealtorWeekFocusAction(
									line.id,
									weekFocusModuleOptions
								);
								return (
									<li
										key={line.id}
										className="flex flex-wrap items-center justify-between gap-2"
									>
										<span>
											{t(`overview.weekFocus.lines.${line.id}`, {
												count: line.count ?? 0,
											})}
										</span>
										{action ? (
											<DesktopAppButton
												size="sm"
												variant="ghost"
												onClick={() => handleWeekFocusAction(line.id)}
											>
												{t(realtorWeekFocusActionI18nKey(action))}
											</DesktopAppButton>
										) : null}
									</li>
								);
							})}
						</ul>
					</ProfessionalWorldsWorkspacePanel>
					<div className={pwMetricGridClass(embeddedMobileLayout)}>
						<ProfessionalWorldsMetricCard
							label={t('metrics.properties')}
							value={metrics.propertiesTotal}
							helper={t('metrics.propertiesHelp')}
							onNavigate={
								listingWorkspaceEnabled
									? () => navigate('properties')
									: undefined
							}
							navigateLabel={
								listingWorkspaceEnabled
									? t('overview.metricJump.properties')
									: undefined
							}
						/>
						<ProfessionalWorldsMetricCard
							label={t('metrics.clients')}
							value={metrics.activeClients}
							helper={t('metrics.clientsHelp')}
							onNavigate={handleClientsMetricNavigate}
							navigateLabel={clientsMetricJumpLabel}
						/>
						<ProfessionalWorldsMetricCard
							label={t('metrics.deals')}
							value={metrics.openDeals}
							helper={t('metrics.dealsHelp')}
							onNavigate={
								pipelineModuleEnabled ? () => openPipeline() : undefined
							}
							navigateLabel={
								pipelineModuleEnabled
									? t('overview.metricJump.deals')
									: undefined
							}
						/>
						<ProfessionalWorldsMetricCard
							label={t('metrics.artifacts')}
							value={metrics.artifactsTotal}
							helper={t('metrics.artifactsHelp')}
							onNavigate={() => navigate('artifacts')}
							navigateLabel={t('overview.metricJump.artifacts')}
						/>
						<ProfessionalWorldsMetricCard
							label={t('metrics.learning')}
							value={`${metrics.learningCompleted}/${metrics.learningTotal}`}
							helper={t('metrics.learningHelp')}
							onNavigate={() => navigate('learning')}
							navigateLabel={t('overview.metricJump.learning')}
						/>
					</div>
					<ProfessionalWorldsWorkspacePanel
						title={t('overview.contextSummary.title')}
					>
						<p className="mb-3 text-sm text-(--desktop-text-secondary)">
							{t('overview.contextSummaryLead')}
						</p>
						<div className={pwContextSummaryGridClass(embeddedMobileLayout)}>
							<div className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
								<p className="text-xs uppercase tracking-[0.16em] text-(--desktop-text-dim)">
									{t('overview.contextSummary.property')}
								</p>
								<strong className="mt-1 block text-sm">
									{contextProperty?.title ?? t('overview.contextSummary.none')}
								</strong>
								{contextProperty && listingWorkspaceEnabled ? (
									<DesktopAppButton
										size="sm"
										variant="ghost"
										className="mt-2"
										onClick={() =>
											openProperties({
												propertyId: contextProperty.id,
												tab: 'listingWorkspace',
											})
										}
									>
										{t('overview.contextSummary.open')}
									</DesktopAppButton>
								) : null}
							</div>
							<div className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
								<p className="text-xs uppercase tracking-[0.16em] text-(--desktop-text-dim)">
									{t('overview.contextSummary.client')}
								</p>
								<strong className="mt-1 block text-sm">
									{contextClient?.name ?? t('overview.contextSummary.none')}
								</strong>
								{contextClient ? (
									<DesktopAppButton
										size="sm"
										variant="ghost"
										className="mt-2"
										onClick={() =>
											openClients({
												tab: 'directory',
												filterClientId: contextClient.id,
											})
										}
									>
										{t('overview.contextSummary.open')}
									</DesktopAppButton>
								) : null}
							</div>
							<div className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
								<p className="text-xs uppercase tracking-[0.16em] text-(--desktop-text-dim)">
									{t('overview.contextSummary.deal')}
								</p>
								<strong className="mt-1 block text-sm">
									{contextDeal?.title ?? t('overview.contextSummary.none')}
								</strong>
								{contextDeal && pipelineModuleEnabled ? (
									<DesktopAppButton
										size="sm"
										variant="ghost"
										className="mt-2"
										onClick={() => openPipeline({ dealId: contextDeal.id })}
									>
										{t('overview.contextSummary.open')}
									</DesktopAppButton>
								) : null}
							</div>
							<div className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
								<p className="text-xs uppercase tracking-[0.16em] text-(--desktop-text-dim)">
									{t('overview.contextSummary.showing')}
								</p>
								<strong className="mt-1 block text-sm">
									{showingsModuleEnabled
										? t('overview.contextSummary.openShowings')
										: t('overview.contextSummary.notEnabled')}
								</strong>
								{showingsModuleEnabled ? (
									<DesktopAppButton
										size="sm"
										variant="ghost"
										className="mt-2"
										onClick={() =>
											openShowings(
												selectedProperty
													? {
															propertyId: selectedProperty.id,
															clientId: contextClient?.id ?? null,
														}
													: undefined
											)
										}
									>
										{t('overview.contextSummary.open')}
									</DesktopAppButton>
								) : null}
							</div>
							<div className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
								<p className="text-xs uppercase tracking-[0.16em] text-(--desktop-text-dim)">
									{t('overview.contextSummary.task')}
								</p>
								<strong className="mt-1 block text-sm">
									{tasksModuleEnabled
										? t('overview.contextSummary.openTasks')
										: t('overview.contextSummary.notEnabled')}
								</strong>
								{tasksModuleEnabled ? (
									<DesktopAppButton
										size="sm"
										variant="ghost"
										className="mt-2"
										onClick={() =>
											openTasks({
												propertyId: selectedProperty?.id ?? null,
												clientId: contextClient?.id ?? null,
												dealId: contextDeal?.id ?? null,
											})
										}
									>
										{t('overview.contextSummary.open')}
									</DesktopAppButton>
								) : null}
							</div>
						</div>
					</ProfessionalWorldsWorkspacePanel>
					<ProfessionalWorldsWorkspacePanel title={t('overview.today')}>
						<p className="text-sm text-(--desktop-text-secondary)">
							{metrics.profileReady
								? t('overview.ready')
								: t('overview.profileMissing')}
						</p>
						<div className="grid gap-3">
							<div className="grid gap-2">
								<span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--desktop-text-muted)">
									{t('overview.primaryCtas')}
								</span>
								<div className="flex flex-wrap gap-2">
									{!metrics.profileReady ? (
										<DesktopAppButton onClick={() => navigate('profile')}>
											{t('actions.openProfile')}
										</DesktopAppButton>
									) : null}
									{listingWorkspaceEnabled ? (
										<DesktopAppButton onClick={() => navigate('properties')}>
											{t('actions.addObject')}
										</DesktopAppButton>
									) : null}
									<DesktopAppButton onClick={() => navigate('learning')}>
										{t('actions.openLearning')}
									</DesktopAppButton>
									<DesktopAppButton onClick={() => navigate('brand')}>
										{t('actions.brandPlan')}
									</DesktopAppButton>
								</div>
							</div>
							<div className="grid gap-2">
								<span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--desktop-text-muted)">
									{t('overview.followUpCtas')}
								</span>
								{hasFollowUpActions ? (
									<div className="flex flex-wrap gap-2">
										{metrics.openDeals > 0 && pipelineModuleEnabled ? (
											<DesktopAppButton
												variant="ghost"
												onClick={() => openPipeline()}
											>
												{t('overview.openPipelineCta')}
											</DesktopAppButton>
										) : null}
										{crmFollowUpCount > 0 && tasksModuleEnabled ? (
											<DesktopAppButton
												variant="ghost"
												onClick={() =>
													openTasks(
														firstCrmFollowUp
															? {
																	draftTitle: firstCrmFollowUp.title,
																	dealId:
																		firstCrmFollowUp.source === 'deal'
																			? firstCrmFollowUp.entityId
																			: null,
																	clientId:
																		firstCrmFollowUp.source === 'client'
																			? firstCrmFollowUp.entityId
																			: null,
																	propertyId: selectedProperty?.id ?? null,
																}
															: undefined
													)
												}
											>
												{t('overview.reviewCrmTasksCta', {
													count: crmFollowUpCount,
												})}
											</DesktopAppButton>
										) : null}
										{crmFollowUpCount > 0 &&
										communicationsModuleEnabled &&
										crmFollowUpCommunicationFocus ? (
											<DesktopAppButton
												variant="ghost"
												onClick={() =>
													openCommunications(crmFollowUpCommunicationFocus)
												}
											>
												{t('overview.logFollowUpCommunicationsCta', {
													count: crmFollowUpCount,
												})}
											</DesktopAppButton>
										) : null}
										{metrics.activeClients === 0 && leadsModuleEnabled ? (
											<DesktopAppButton
												variant="ghost"
												onClick={() => openProfessionTool('realtor_leads')}
											>
												{t('clients.openLeadsInProfessionTools')}
											</DesktopAppButton>
										) : null}
										{dealsNeedingBackfill > 0 && pipelineModuleEnabled ? (
											<DesktopAppButton
												variant="ghost"
												onClick={() => openPipeline()}
											>
												{t('overview.reviewListingLinksCta', {
													count: dealsNeedingBackfill,
												})}
											</DesktopAppButton>
										) : null}
									</div>
								) : (
									<p className="text-xs text-(--desktop-text-muted)">
										{t('overview.noFollowUpCtas')}
									</p>
								)}
							</div>
						</div>
					</ProfessionalWorldsWorkspacePanel>
				</>
			) : null}
		</ProfessionalWorldsWorkspaceSection>
	);
}
