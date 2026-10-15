/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Generic CRM-lite clients/deals workspace for any profession vertical in Professional Worlds.
 *
 * Invariants:
 * - Data is scoped by `vertical_slug` on the parent snapshot loader, not inside this panel.
 * - Realtor pack tools live under Profession tools, not here.
 * - Deal create inherits `property_id` from the workspace-selected listing when present.
 * - Deal create may attach an existing client via `client_id` picker.
 * - Directory client rows filter the deals panel; explicit action opens deal capture.
 * - Deal rows deep-link to pipeline or linked listing when modules are enabled; optional **Log communication** when `realtor_communications` is enabled.
 * - Deal stage updates PATCH `/deals/{id}` and patch snapshot without full refresh.
 *
 * Related:
 * - layout/*
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import { useProfessionalWorldsWorkspace } from '../ProfessionalWorldsWorkspaceContext';

import {
	deleteProfessionalClient,
	deleteProfessionalDeal,
	updateProfessionalDeal,
} from '../api';
import { ProfessionalWorldsDeleteAction } from '../components/ProfessionalWorldsDeleteAction';
import { parseClientHasDealsConflict } from '../professionalWorldsApiError';
import {
	prependDealToSnapshot,
	removeClientFromSnapshot,
	removeDealFromSnapshot,
} from '../professionalWorldsSnapshotUtils';
import { useProfessionalToasts } from '../ProfessionalToast';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsHeroPanel,
	ProfessionalWorldsProgressRail,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTextarea,
	ProfessionalWorldsTrustNote,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
	ProfessionalWorldsWorkspaceSubtabs,
	pwFormGridClass,
	pwSplitCaptureClass,
	pwSplitDirectoryClass,
} from '../layout';
import {
	PROFESSIONAL_DEAL_STAGE_OPTIONS,
	countDealsForClient,
	filterDealsByClientId,
	isProfessionalDealStage,
	resolveDealLinkedClientName,
	resolveDealLinkedPropertyTitle,
	resolveEffectiveDealPropertyId,
} from '../realtorLogic';
import type {
	ProfessionalClient,
	ProfessionalClientCreate,
	ProfessionalDealCreate,
	ProfessionalWorldsSnapshot,
} from '../types';

export type ClientsWorkspacePanelProps = {
	activeVerticalSlug: string;
	snapshot: ProfessionalWorldsSnapshot;
	clientDraft: ProfessionalClientCreate;
	setClientDraft: React.Dispatch<
		React.SetStateAction<ProfessionalClientCreate>
	>;
	dealDraft: ProfessionalDealCreate;
	setDealDraft: React.Dispatch<React.SetStateAction<ProfessionalDealCreate>>;
	saving: boolean;
	clientsBanner: { kind: 'success' | 'error'; text: string } | null;
	onCreateClient: () => void | Promise<void>;
	onCreateDeal: () => void | Promise<void>;
};

export function ClientsWorkspacePanel({
	activeVerticalSlug: _activeVerticalSlug,
	snapshot,
	clientDraft,
	setClientDraft,
	dealDraft,
	setDealDraft,
	saving,
	clientsBanner,
	onCreateClient,
	onCreateDeal,
}: ClientsWorkspacePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		clientsWorkspaceFocus,
		consumeClientsWorkspaceFocus,
		dealsModuleEnabled,
		embeddedMobileLayout,
		openCommunications,
		openPipeline,
		openProfessionTool,
		openProperties,
		patchSnapshot,
		selectedProperty,
		verticalAddonModules,
	} = useProfessionalWorldsWorkspace();
	const leadsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_leads'
	);
	const pipelineModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_pipeline'
	);
	const communicationsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_communications'
	);
	const [clientsWorkspaceTab, setClientsWorkspaceTab] = useState<
		'capture' | 'directory'
	>('capture');
	const [directoryClientFilterId, setDirectoryClientFilterId] = useState<
		string | null
	>(null);
	const [stageUpdateDealId, setStageUpdateDealId] = useState<string | null>(
		null
	);
	const [dealStageBanner, setDealStageBanner] = useState<{
		kind: 'success' | 'error';
		text: string;
	} | null>(null);
	const [clientDeleteTarget, setClientDeleteTarget] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [dealDeleteTarget, setDealDeleteTarget] = useState<{
		id: string;
		title: string;
	} | null>(null);
	const [clientDeleteBlocked, setClientDeleteBlocked] = useState<{
		clientId: string;
		clientName: string;
		dealCount: number;
	} | null>(null);
	const dealsDirectoryRef = useRef<HTMLDivElement | null>(null);
	const { notifySuccess } = useProfessionalToasts();

	const handleDealStageChange = useCallback(
		async (dealId: string, nextStage: string) => {
			if (!nextStage.trim()) return;
			setStageUpdateDealId(dealId);
			setDealStageBanner(null);
			try {
				const updated = await updateProfessionalDeal(dealId, {
					stage: nextStage,
				});
				patchSnapshot((current) => prependDealToSnapshot(current, updated));
				setDealStageBanner({
					kind: 'success',
					text: t('deals.stageUpdated'),
				});
			} catch (err: unknown) {
				setDealStageBanner({
					kind: 'error',
					text:
						err instanceof Error ? err.message : t('deals.stageUpdateFailed'),
				});
			} finally {
				setStageUpdateDealId(null);
			}
		},
		[patchSnapshot, t]
	);

	const handleDeleteClient = useCallback(async () => {
		if (!clientDeleteTarget) return;
		try {
			await deleteProfessionalClient(clientDeleteTarget.id);
			patchSnapshot((current) =>
				removeClientFromSnapshot(current, clientDeleteTarget.id)
			);
			if (directoryClientFilterId === clientDeleteTarget.id) {
				setDirectoryClientFilterId(null);
			}
			setClientDeleteBlocked(null);
			notifySuccess(t('clients.deleteSuccess'));
			setClientDeleteTarget(null);
		} catch (err: unknown) {
			const conflict = parseClientHasDealsConflict(err);
			if (conflict) {
				setClientDeleteBlocked({
					clientId: clientDeleteTarget.id,
					clientName: clientDeleteTarget.name,
					dealCount: conflict.deal_count,
				});
				setDirectoryClientFilterId(clientDeleteTarget.id);
				dealsDirectoryRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
				});
				setClientDeleteTarget(null);
				return;
			}
			setDealStageBanner({
				kind: 'error',
				text: err instanceof Error ? err.message : t('clients.deleteFailed'),
			});
			throw err instanceof Error ? err : new Error(t('clients.deleteFailed'));
		}
	}, [
		clientDeleteTarget,
		directoryClientFilterId,
		notifySuccess,
		patchSnapshot,
		t,
	]);

	const handleDeleteDeal = useCallback(async () => {
		if (!dealDeleteTarget) return;
		try {
			await deleteProfessionalDeal(dealDeleteTarget.id);
			patchSnapshot((current) =>
				removeDealFromSnapshot(current, dealDeleteTarget.id)
			);
			notifySuccess(t('deals.deleteSuccess'));
			setDealDeleteTarget(null);
		} catch (err: unknown) {
			setDealStageBanner({
				kind: 'error',
				text: err instanceof Error ? err.message : t('deals.deleteFailed'),
			});
			throw err instanceof Error ? err : new Error(t('deals.deleteFailed'));
		}
	}, [dealDeleteTarget, notifySuccess, patchSnapshot, t]);

	const filteredDirectoryDeals = useMemo(
		() => filterDealsByClientId(snapshot.deals, directoryClientFilterId),
		[directoryClientFilterId, snapshot.deals]
	);
	const selectedDirectoryClient = useMemo(
		() =>
			directoryClientFilterId
				? (snapshot.clients.find(
						(client) => client.id === directoryClientFilterId
					) ?? null)
				: null,
		[directoryClientFilterId, snapshot.clients]
	);

	useEffect(() => {
		if (!clientsWorkspaceFocus) {
			return;
		}
		if (clientsWorkspaceFocus.tab) {
			setClientsWorkspaceTab(clientsWorkspaceFocus.tab);
		}
		if (clientsWorkspaceFocus.filterClientId?.trim()) {
			setDirectoryClientFilterId(clientsWorkspaceFocus.filterClientId.trim());
		}
		consumeClientsWorkspaceFocus();
	}, [clientsWorkspaceFocus, consumeClientsWorkspaceFocus]);

	const clientCount = snapshot.clients.length;
	const dealCount = snapshot.deals.length;
	const hasClients = clientCount > 0;
	const heroCopy = useMemo(
		() =>
			hasClients
				? {
						title: t('clients.visible.activeTitle'),
						description: t('clients.visible.activeDescription'),
					}
				: {
						title: t('clients.visible.emptyTitle'),
						description: t('clients.visible.emptyDescription'),
					},
		[hasClients, t]
	);
	const progressItems = useMemo(
		() => [
			{
				id: 'clients',
				label: t('clients.visible.progressClients'),
				value: String(clientCount),
				complete: clientCount > 0,
			},
			{
				id: 'deals',
				label: t('clients.visible.progressDeals'),
				value: String(dealCount),
				complete: dealCount > 0,
			},
		],
		[clientCount, dealCount, t]
	);
	const heroPrimaryAction = useMemo(() => {
		if (clientsWorkspaceTab === 'capture') {
			return hasClients
				? {
						label: t('clients.visible.actions.viewDirectory'),
						onClick: () => setClientsWorkspaceTab('directory'),
					}
				: undefined;
		}
		return {
			label: hasClients
				? t('clients.visible.actions.addClient')
				: t('clients.visible.actions.captureClient'),
			onClick: () => setClientsWorkspaceTab('capture'),
		};
	}, [clientsWorkspaceTab, hasClients, t]);

	return (
		<ProfessionalWorldsWorkspaceSection
			title={t('nav.clients')}
			subtabs={
				<ProfessionalWorldsWorkspaceSubtabs
					active={clientsWorkspaceTab}
					ariaLabel={t('clients.workspaceAria')}
					items={[
						{ id: 'capture', label: t('clients.tabs.capture') },
						{ id: 'directory', label: t('clients.tabs.directory') },
					]}
					onSelect={(id) =>
						setClientsWorkspaceTab(id as 'capture' | 'directory')
					}
				/>
			}
			banner={
				clientsBanner ? (
					<ProfessionalWorldsStatusBanner kind={clientsBanner.kind}>
						{clientsBanner.text}
					</ProfessionalWorldsStatusBanner>
				) : null
			}
		>
			<ProfessionalWorldsHeroPanel
				eyebrow={t('clients.visible.eyebrow')}
				title={heroCopy.title}
				description={heroCopy.description}
				primaryAction={
					heroPrimaryAction ? (
						<DesktopAppButton type="button" onClick={heroPrimaryAction.onClick}>
							{heroPrimaryAction.label}
						</DesktopAppButton>
					) : undefined
				}
				meta={
					<ProfessionalWorldsProgressRail
						title={t('overview.visible.progress.title')}
						items={progressItems}
					/>
				}
			/>
			<ProfessionalWorldsTrustNote title={t('clients.visible.trustTitle')}>
				{t('clients.visible.trustBody')}
			</ProfessionalWorldsTrustNote>
			{clientsWorkspaceTab === 'capture' ? (
				<div className={pwSplitCaptureClass(embeddedMobileLayout)}>
					<ProfessionalWorldsWorkspacePanel title={t('clients.new')}>
						<div className={pwFormGridClass(embeddedMobileLayout)}>
							<ProfessionalWorldsFormField label={t('clients.name')}>
								<DesktopAppInput
									value={clientDraft.name}
									onChange={(event) =>
										setClientDraft((current) => ({
											...current,
											name: event.target.value,
										}))
									}
									placeholder={t('clients.namePlaceholder')}
								/>
							</ProfessionalWorldsFormField>
							<ProfessionalWorldsFormField label={t('clients.emotion')}>
								<DesktopAppInput
									value={clientDraft.emotional_motive ?? ''}
									onChange={(event) =>
										setClientDraft((current) => ({
											...current,
											emotional_motive: event.target.value,
										}))
									}
									placeholder={t('clients.emotionPlaceholder')}
								/>
							</ProfessionalWorldsFormField>
						</div>
						<ProfessionalWorldsFormField label={t('clients.need')}>
							<ProfessionalWorldsTextarea
								value={clientDraft.need_summary ?? ''}
								onChange={(event) =>
									setClientDraft((current) => ({
										...current,
										need_summary: event.target.value,
									}))
								}
								placeholder={t('clients.needPlaceholder')}
							/>
						</ProfessionalWorldsFormField>
						<DesktopAppButton
							disabled={saving || !clientDraft.name.trim()}
							onClick={() => void onCreateClient()}
						>
							{t('actions.createClient')}
						</DesktopAppButton>
					</ProfessionalWorldsWorkspacePanel>
					{dealsModuleEnabled ? (
						<ProfessionalWorldsWorkspacePanel title={t('deals.new')}>
							<p className="mb-3 text-sm text-(--desktop-text-secondary)">
								{t('deals.captureLead')}
							</p>
							{selectedProperty ? (
								<p className="mb-3 text-xs text-(--desktop-text-secondary)">
									{t('deals.linkedListingHint', {
										title: selectedProperty.title,
									})}
								</p>
							) : null}
							{snapshot.clients.length === 0 ? (
								<p className="mb-3 text-xs text-(--desktop-text-secondary)">
									{t('deals.noClientsHint')}
									{leadsModuleEnabled ? (
										<>
											{' '}
											<button
												type="button"
												className="text-(--desktop-accent) underline-offset-2 hover:underline"
												onClick={() => openProfessionTool('realtor_leads')}
											>
												{t('clients.openLeadsInProfessionTools')}
											</button>
										</>
									) : null}
								</p>
							) : null}
							<div className={pwFormGridClass(embeddedMobileLayout)}>
								<ProfessionalWorldsFormField label={t('deals.clientLabel')}>
									<DesktopNativeSelect
										value={dealDraft.client_id ?? ''}
										onChange={(event) =>
											setDealDraft((current) => ({
												...current,
												client_id: event.target.value.trim()
													? event.target.value.trim()
													: null,
											}))
										}
									>
										<option value="">{t('deals.clientNone')}</option>
										{snapshot.clients.map((client) => (
											<option key={client.id} value={client.id}>
												{client.name}
											</option>
										))}
									</DesktopNativeSelect>
								</ProfessionalWorldsFormField>
								<ProfessionalWorldsFormField label={t('deals.stageLabel')}>
									<DesktopNativeSelect
										value={dealDraft.stage}
										onChange={(event) =>
											setDealDraft((current) => ({
												...current,
												stage: event.target.value,
											}))
										}
									>
										{PROFESSIONAL_DEAL_STAGE_OPTIONS.map((stage) => (
											<option key={stage} value={stage}>
												{t(`deals.stages.${stage}`)}
											</option>
										))}
									</DesktopNativeSelect>
								</ProfessionalWorldsFormField>
								<ProfessionalWorldsFormField label={t('deals.title')}>
									<DesktopAppInput
										value={dealDraft.title}
										onChange={(event) =>
											setDealDraft((current) => ({
												...current,
												title: event.target.value,
											}))
										}
										placeholder={t('deals.titlePlaceholder')}
									/>
								</ProfessionalWorldsFormField>
								<ProfessionalWorldsFormField label={t('deals.nextAction')}>
									<DesktopAppInput
										value={dealDraft.next_action ?? ''}
										onChange={(event) =>
											setDealDraft((current) => ({
												...current,
												next_action: event.target.value,
											}))
										}
										placeholder={t('deals.nextActionPlaceholder')}
									/>
								</ProfessionalWorldsFormField>
							</div>
							<DesktopAppButton
								disabled={saving || !dealDraft.title.trim()}
								onClick={() => void onCreateDeal()}
							>
								{t('actions.createDeal')}
							</DesktopAppButton>
						</ProfessionalWorldsWorkspacePanel>
					) : null}
				</div>
			) : null}
			{clientsWorkspaceTab === 'directory' ? (
				<>
					<p className="text-xs text-(--desktop-text-muted)">
						{t('clients.directorySummary', {
							clients: snapshot.clients.length,
							deals: snapshot.deals.length,
						})}
					</p>
					<div className={pwSplitDirectoryClass(embeddedMobileLayout)}>
						<ProfessionalWorldsWorkspacePanel
							title={t('clients.directoryPanel')}
						>
							{snapshot.clients.length === 0 ? (
								<DesktopAppEmptyState
									description={t('clients.directoryEmptyBody')}
									title={t('clients.directoryEmptyTitle')}
								>
									{leadsModuleEnabled ? (
										<DesktopAppButton
											className="mt-3"
											size="sm"
											variant="ghost"
											onClick={() => openProfessionTool('realtor_leads')}
										>
											{t('clients.openLeadsInProfessionTools')}
										</DesktopAppButton>
									) : null}
								</DesktopAppEmptyState>
							) : (
								<div className="grid gap-2">
									{snapshot.clients.map((client: ProfessionalClient) => {
										const dealCount = countDealsForClient(
											snapshot.deals,
											client.id
										);
										const selected = directoryClientFilterId === client.id;
										return (
											<div
												className={cn(
													'rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm',
													selected &&
														'ring-2 ring-(--desktop-accent) ring-offset-2 ring-offset-(--desktop-surface)'
												)}
												key={client.id}
											>
												<button
													type="button"
													className="w-full text-left transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--desktop-accent)"
													onClick={() =>
														setDirectoryClientFilterId((current) =>
															current === client.id ? null : client.id
														)
													}
												>
													<strong>{client.name}</strong>
													<p className="mt-1 text-xs text-(--desktop-text-secondary)">
														{client.need_summary ||
															client.emotional_motive ||
															t('clients.noNeed')}
													</p>
													{dealsModuleEnabled && dealCount > 0 ? (
														<span className="mt-2 block text-xs text-(--desktop-text-muted)">
															{t('clients.dealsCount', { count: dealCount })}
														</span>
													) : null}
												</button>
												<div className="mt-2 flex flex-wrap gap-2">
													{dealsModuleEnabled ? (
														<>
															<DesktopAppButton
																size="sm"
																variant="ghost"
																onClick={() => {
																	setDealDraft((current) => ({
																		...current,
																		client_id: client.id,
																	}));
																	setClientsWorkspaceTab('capture');
																}}
															>
																{t('clients.useForDeal')}
															</DesktopAppButton>
															{communicationsModuleEnabled ? (
																<DesktopAppButton
																	size="sm"
																	variant="ghost"
																	onClick={() =>
																		openCommunications({
																			relatedType: 'client',
																			relatedId: client.id,
																		})
																	}
																>
																	{t('realtorPro.communications.logCta')}
																</DesktopAppButton>
															) : null}
														</>
													) : null}
													<DesktopAppButton
														size="sm"
														variant="ghost"
														onClick={() =>
															setClientDeleteTarget({
																id: client.id,
																name: client.name,
															})
														}
													>
														{t('clients.deleteAction')}
													</DesktopAppButton>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</ProfessionalWorldsWorkspacePanel>
						{dealsModuleEnabled ? (
							<div ref={dealsDirectoryRef}>
								<ProfessionalWorldsWorkspacePanel
									title={t('deals.directoryPanel')}
								>
									{clientDeleteBlocked ? (
										<ProfessionalWorldsStatusBanner kind="error" role="alert">
											<strong>{t('clients.deleteBlockedTitle')}</strong>
											<p className="mt-1">
												{t('clients.deleteBlockedBody', {
													count: clientDeleteBlocked.dealCount,
												})}
											</p>
											<DesktopAppButton
												className="mt-2"
												size="sm"
												variant="ghost"
												onClick={() => {
													setDirectoryClientFilterId(
														clientDeleteBlocked.clientId
													);
													dealsDirectoryRef.current?.scrollIntoView({
														behavior: 'smooth',
														block: 'nearest',
													});
												}}
											>
												{t('clients.deleteBlockedCta')}
											</DesktopAppButton>
										</ProfessionalWorldsStatusBanner>
									) : null}
									{dealStageBanner ? (
										<ProfessionalWorldsStatusBanner
											kind={dealStageBanner.kind}
											role="status"
										>
											{dealStageBanner.text}
										</ProfessionalWorldsStatusBanner>
									) : null}
									{snapshot.deals.length === 0 ? (
										<DesktopAppEmptyState
											description={t('deals.directoryEmptyBody')}
											title={t('deals.directoryEmptyTitle')}
										/>
									) : (
										<>
											<ProfessionalWorldsFormField
												label={t('deals.filterClientLabel')}
											>
												<DesktopNativeSelect
													value={directoryClientFilterId ?? ''}
													onChange={(event) =>
														setDirectoryClientFilterId(
															event.target.value.trim()
																? event.target.value.trim()
																: null
														)
													}
												>
													<option value="">
														{t('deals.filterAllClients')}
													</option>
													{snapshot.clients.map((client) => (
														<option key={client.id} value={client.id}>
															{client.name}
														</option>
													))}
												</DesktopNativeSelect>
											</ProfessionalWorldsFormField>
											{selectedDirectoryClient ? (
												<div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-(--desktop-text-secondary)">
													<span>
														{t('deals.filteredForClient', {
															name: selectedDirectoryClient.name,
														})}
													</span>
													<DesktopAppButton
														size="sm"
														variant="ghost"
														onClick={() => setDirectoryClientFilterId(null)}
													>
														{t('deals.clearClientFilter')}
													</DesktopAppButton>
												</div>
											) : null}
											{filteredDirectoryDeals.length === 0 ? (
												<DesktopAppEmptyState
													description={t('deals.filteredEmptyBody')}
													title={t('deals.filteredEmptyTitle')}
												>
													{selectedDirectoryClient ? (
														<DesktopAppButton
															className="mt-3"
															size="sm"
															onClick={() => {
																setDealDraft((current) => ({
																	...current,
																	client_id: selectedDirectoryClient.id,
																}));
																setClientsWorkspaceTab('capture');
															}}
														>
															{t('clients.newDealForClient', {
																name: selectedDirectoryClient.name,
															})}
														</DesktopAppButton>
													) : null}
												</DesktopAppEmptyState>
											) : (
												<ul className="grid gap-2 text-sm">
													{filteredDirectoryDeals.map((deal) => {
														const linkedPropertyTitle =
															resolveDealLinkedPropertyTitle(
																deal,
																snapshot.properties
															);
														const linkedPropertyId =
															resolveEffectiveDealPropertyId(
																deal,
																snapshot.properties
															);
														const linkedClientName =
															resolveDealLinkedClientName(
																deal,
																snapshot.clients
															);
														return (
															<li
																className="rounded-(--desktop-radius-sm) border border-(--desktop-border-subtle) bg-(--desktop-surface-raised)/50 p-3"
																key={deal.id}
															>
																<strong>{deal.title}</strong>
																<p className="mt-1 text-xs text-(--desktop-text-muted)">
																	{deal.next_action || t('deals.noNext')}
																</p>
																<ProfessionalWorldsFormField
																	className="mt-2"
																	label={t('deals.stageLabel')}
																>
																	<DesktopNativeSelect
																		disabled={stageUpdateDealId === deal.id}
																		value={deal.stage}
																		onChange={(event) =>
																			void handleDealStageChange(
																				deal.id,
																				event.target.value
																			)
																		}
																	>
																		{PROFESSIONAL_DEAL_STAGE_OPTIONS.map(
																			(stage) => (
																				<option key={stage} value={stage}>
																					{isProfessionalDealStage(stage)
																						? t(`deals.stages.${stage}`)
																						: stage}
																				</option>
																			)
																		)}
																	</DesktopNativeSelect>
																</ProfessionalWorldsFormField>
																{linkedClientName &&
																!directoryClientFilterId ? (
																	<p className="mt-1 text-xs text-(--desktop-text-secondary)">
																		{t('deals.linkedClient', {
																			name: linkedClientName,
																		})}
																	</p>
																) : null}
																{linkedPropertyTitle ? (
																	<p className="mt-1 text-xs text-(--desktop-text-secondary)">
																		{t('deals.linkedListing', {
																			title: linkedPropertyTitle,
																		})}
																	</p>
																) : null}
																<div className="mt-2 flex flex-wrap gap-2">
																	{pipelineModuleEnabled ? (
																		<DesktopAppButton
																			size="sm"
																			variant="ghost"
																			onClick={() =>
																				openPipeline({ dealId: deal.id })
																			}
																		>
																			{t('deals.openInPipeline')}
																		</DesktopAppButton>
																	) : null}
																	{linkedPropertyId ? (
																		<DesktopAppButton
																			size="sm"
																			variant="ghost"
																			onClick={() =>
																				openProperties({
																					propertyId: linkedPropertyId,
																				})
																			}
																		>
																			{t('deals.openListing')}
																		</DesktopAppButton>
																	) : null}
																	{communicationsModuleEnabled ? (
																		<DesktopAppButton
																			size="sm"
																			variant="ghost"
																			onClick={() =>
																				openCommunications({
																					relatedType: 'deal',
																					relatedId: deal.id,
																				})
																			}
																		>
																			{t('realtorPro.communications.logCta')}
																		</DesktopAppButton>
																	) : null}
																	<DesktopAppButton
																		size="sm"
																		variant="ghost"
																		onClick={() =>
																			setDealDeleteTarget({
																				id: deal.id,
																				title: deal.title,
																			})
																		}
																	>
																		{t('deals.deleteAction')}
																	</DesktopAppButton>
																</div>
															</li>
														);
													})}
												</ul>
											)}
										</>
									)}
								</ProfessionalWorldsWorkspacePanel>
							</div>
						) : null}
					</div>
				</>
			) : null}
			<ProfessionalWorldsDeleteAction
				isOpen={clientDeleteTarget !== null}
				onClose={() => setClientDeleteTarget(null)}
				onConfirm={handleDeleteClient}
				title={t('clients.deleteTitle')}
				itemName={clientDeleteTarget?.name}
				warningMessage={t('clients.deleteWarning')}
				confirmButtonLabel={t('clients.deleteAction')}
			/>
			<ProfessionalWorldsDeleteAction
				isOpen={dealDeleteTarget !== null}
				onClose={() => setDealDeleteTarget(null)}
				onConfirm={handleDeleteDeal}
				title={t('deals.deleteTitle')}
				itemName={dealDeleteTarget?.title}
				warningMessage={t('deals.deleteWarning')}
				confirmButtonLabel={t('deals.deleteAction')}
			/>
		</ProfessionalWorldsWorkspaceSection>
	);
}
