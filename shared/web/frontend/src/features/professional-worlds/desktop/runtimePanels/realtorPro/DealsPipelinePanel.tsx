/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro deals pipeline panel — stage columns, timeline events, property backfill, and deep-links.
 *
 * Invariants:
 * - Reads deal/property/client data from the parent runtime snapshot; fetches timeline events per selected deal.
 * - Stage changes PATCH the deal and best-effort append a timeline event.
 * - Unlinked listings offer create-deal CTA via Clients capture workspace.
 *
 * Related:
 * - ../RealtorProPanels.tsx (barrel re-export pending split wave)
 * - ../../runtimeModuleRegistry.tsx
 * - ../../realtorLogic.ts
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTextarea,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';
import {
	appendRealtorDealEvent,
	backfillProfessionalDealPropertyLinks,
	listRealtorDealEvents,
	updateProfessionalDeal,
} from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import { useProfessionalToasts } from '../../ProfessionalToast';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import { prependDealToSnapshot } from '../../professionalWorldsSnapshotUtils';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import {
	countDealsNeedingPropertyBackfill,
	isProfessionalDealStage,
	listPropertiesWithoutDealLink,
	PROFESSIONAL_DEAL_STAGE_OPTIONS,
	resolveDealLinkedClientName,
	resolveDealLinkedPropertyTitle,
	resolveEffectiveDealPropertyId,
} from '../../realtorLogic';
import type { RealtorDealEvent } from '../../types';

type AsyncState<T> = {
	data: T;
	error: string | null;
	loading: boolean;
};

type RealtorPanelTranslate = (
	key: string,
	options?: Record<string, unknown>
) => string;

function humanizeRealtorIdentifier(value: string): string {
	return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatUnknownRealtorValue(
	t: RealtorPanelTranslate,
	value: string | null | undefined
): string {
	const humanValue = humanizeRealtorIdentifier(value?.trim() || '');
	return humanValue
		? t('realtorPro.formatters.customValue', { value: humanValue })
		: t('realtorPro.formatters.notSpecified');
}

function translateRealtorValue(
	t: RealtorPanelTranslate,
	key: string,
	fallback: string
): string {
	const value = t(key);
	return value === key ? fallback : value;
}

function formatDealStageLabel(
	t: RealtorPanelTranslate,
	stage: string | null | undefined
): string {
	if (!stage) {
		return t('realtorPro.deals.stageFromStart');
	}
	if (isProfessionalDealStage(stage)) {
		return t(`deals.stages.${stage}`);
	}
	return translateRealtorValue(
		t,
		`realtorPro.deals.stages.${stage}`,
		formatUnknownRealtorValue(t, stage)
	);
}

export function DealsPipelinePanel({ snapshot }: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const {
		activeVerticalSlug,
		consumePipelineFocus,
		openClients,
		openCommunications,
		openProperties,
		openShowings,
		patchSnapshot,
		pipelineFocusDealId,
		refresh,
		verticalAddonModules,
	} = useProfessionalWorldsWorkspace();
	const communicationsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_communications'
	);
	const showingsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_showings'
	);
	const [selectedDealId, setSelectedDealId] = useState(
		snapshot.deals[0]?.id ?? ''
	);
	const [backfillBusy, setBackfillBusy] = useState(false);
	const [stageBusy, setStageBusy] = useState(false);
	const [backfillBanner, setBackfillBanner] = useState<{
		kind: 'success' | 'error';
		text: string;
	} | null>(null);
	const [stageBanner, setStageBanner] = useState<{
		kind: 'success' | 'error';
		text: string;
	} | null>(null);
	const [draftEventStageTo, setDraftEventStageTo] = useState('');
	const [draftEventNote, setDraftEventNote] = useState('');
	const [eventBusy, setEventBusy] = useState(false);
	const [eventBanner, setEventBanner] = useState<{
		kind: 'success' | 'error';
		text: string;
	} | null>(null);
	const selectedDeal =
		snapshot.deals.find((deal) => deal.id === selectedDealId) ?? null;
	useEffect(() => {
		if (!pipelineFocusDealId) return;
		if (snapshot.deals.some((deal) => deal.id === pipelineFocusDealId)) {
			setSelectedDealId(pipelineFocusDealId);
		}
		consumePipelineFocus();
	}, [consumePipelineFocus, pipelineFocusDealId, snapshot.deals]);
	const [{ data: events }, setEventsState] = useState<
		AsyncState<RealtorDealEvent[]>
	>({
		data: [],
		error: null,
		loading: false,
	});
	useEffect(() => {
		if (!selectedDealId) {
			setEventsState({ data: [], error: null, loading: false });
			return;
		}
		let alive = true;
		setEventsState((current) => ({ ...current, loading: true, error: null }));
		listRealtorDealEvents(selectedDealId)
			.then((data) => {
				if (alive) setEventsState({ data, error: null, loading: false });
			})
			.catch((err: unknown) => {
				if (alive) {
					setEventsState({
						data: [],
						error: formatProfessionalWorldsApiError(err, (key) => t(key)),
						loading: false,
					});
				}
			});
		return () => {
			alive = false;
		};
	}, [selectedDealId, t]);
	useEffect(() => {
		if (selectedDeal) {
			setDraftEventStageTo(selectedDeal.stage);
		}
	}, [selectedDeal?.id, selectedDeal?.stage, selectedDeal]);
	const stages = [...new Set(snapshot.deals.map((deal) => deal.stage))];
	const unlinkedProperties = listPropertiesWithoutDealLink(
		snapshot.properties,
		snapshot.deals
	);
	const backfillableDeals = countDealsNeedingPropertyBackfill(
		snapshot.deals,
		snapshot.properties
	);

	const handleBackfillPropertyLinks = useCallback(async () => {
		setBackfillBusy(true);
		setBackfillBanner(null);
		try {
			const result =
				await backfillProfessionalDealPropertyLinks(activeVerticalSlug);
			await refresh({ silent: true });
			setBackfillBanner({
				kind: 'success',
				text: t('realtorPro.deals.backfillSuccess', { count: result.updated }),
			});
			notifySuccess(
				t('realtorPro.deals.backfillSuccess', { count: result.updated })
			);
		} catch (err: unknown) {
			setBackfillBanner({
				kind: 'error',
				text: formatProfessionalWorldsApiError(
					err,
					(key) => t(key),
					t('realtorPro.deals.backfillFailed')
				),
			});
			notifyApiError(err, t, t('realtorPro.deals.backfillFailed'));
		} finally {
			setBackfillBusy(false);
		}
	}, [activeVerticalSlug, notifyApiError, notifySuccess, refresh, t]);

	const handleStageChange = useCallback(
		async (dealId: string, nextStage: string) => {
			if (!nextStage.trim()) return;
			const previousStage =
				snapshot.deals.find((deal) => deal.id === dealId)?.stage ?? null;
			setStageBusy(true);
			setStageBanner(null);
			try {
				const updated = await updateProfessionalDeal(dealId, {
					stage: nextStage,
				});
				patchSnapshot((current) => prependDealToSnapshot(current, updated));
				if (previousStage && previousStage !== nextStage) {
					try {
						const event = await appendRealtorDealEvent(dealId, {
							stage_from: previousStage,
							stage_to: nextStage,
						});
						setEventsState((current) => ({
							...current,
							data: [event, ...current.data],
						}));
					} catch {
						// Stage update succeeded; timeline append is best-effort.
					}
				}
				setStageBanner({
					kind: 'success',
					text: t('realtorPro.deals.stageUpdated'),
				});
				notifySuccess(t('realtorPro.deals.stageUpdated'));
			} catch (err: unknown) {
				setStageBanner({
					kind: 'error',
					text: formatProfessionalWorldsApiError(
						err,
						(key) => t(key),
						t('realtorPro.deals.stageUpdateFailed')
					),
				});
				notifyApiError(err, t, t('realtorPro.deals.stageUpdateFailed'));
			} finally {
				setStageBusy(false);
			}
		},
		[notifyApiError, notifySuccess, patchSnapshot, snapshot.deals, t]
	);

	const handleAppendDealEvent = useCallback(async () => {
		if (!selectedDealId || !draftEventStageTo.trim()) return;
		setEventBusy(true);
		setEventBanner(null);
		try {
			const event = await appendRealtorDealEvent(selectedDealId, {
				stage_from: selectedDeal?.stage ?? null,
				stage_to: draftEventStageTo.trim(),
				note: draftEventNote.trim() || null,
			});
			setEventsState((current) => ({
				...current,
				data: [event, ...current.data],
			}));
			setDraftEventNote('');
			setEventBanner({
				kind: 'success',
				text: t('realtorPro.deals.eventAppendSuccess'),
			});
			notifySuccess(t('realtorPro.deals.eventAppendSuccess'));
		} catch (err: unknown) {
			setEventBanner({
				kind: 'error',
				text: formatProfessionalWorldsApiError(
					err,
					(key) => t(key),
					t('realtorPro.deals.eventAppendFailed')
				),
			});
			notifyApiError(err, t, t('realtorPro.deals.eventAppendFailed'));
		} finally {
			setEventBusy(false);
		}
	}, [
		draftEventNote,
		draftEventStageTo,
		selectedDeal?.stage,
		selectedDealId,
		t,
		notifyApiError,
		notifySuccess,
	]);

	return (
		<ProfessionalWorldsWorkspacePanel title={t('realtorPro.deals.title')}>
			{stageBanner ? (
				<ProfessionalWorldsStatusBanner kind={stageBanner.kind} role="status">
					{stageBanner.text}
				</ProfessionalWorldsStatusBanner>
			) : null}
			{backfillBanner ? (
				<ProfessionalWorldsStatusBanner
					kind={backfillBanner.kind}
					role="status"
				>
					{backfillBanner.text}
				</ProfessionalWorldsStatusBanner>
			) : null}
			{backfillableDeals > 0 ? (
				<div className="flex flex-wrap items-center gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-xs text-(--desktop-text-secondary)">
					<span>
						{t('realtorPro.deals.backfillHint', { count: backfillableDeals })}
					</span>
					<DesktopAppButton
						disabled={backfillBusy}
						size="sm"
						onClick={() => void handleBackfillPropertyLinks()}
					>
						{t('realtorPro.deals.backfillButton')}
					</DesktopAppButton>
				</div>
			) : null}
			<div className="grid gap-3 md:grid-cols-3">
				{stages.map((stage) => (
					<div
						key={stage}
						className="grid content-start gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3"
					>
						<strong className="text-sm capitalize">
							{isProfessionalDealStage(stage)
								? t(`deals.stages.${stage}`)
								: stage}
						</strong>
						{snapshot.deals
							.filter((deal) => deal.stage === stage)
							.map((deal) => {
								const linkedPropertyTitle = resolveDealLinkedPropertyTitle(
									deal,
									snapshot.properties
								);
								const linkedClientName = resolveDealLinkedClientName(
									deal,
									snapshot.clients
								);
								return (
									<button
										key={deal.id}
										type="button"
										onClick={() => setSelectedDealId(deal.id)}
										className="rounded-(--desktop-radius) bg-black/10 p-2 text-left text-xs text-(--desktop-text-secondary)"
									>
										<strong className="block text-(--desktop-text-primary)">
											{deal.title}
										</strong>
										{linkedClientName ? (
											<span className="mt-1 block">
												{t('realtorPro.deals.linkedClientShort', {
													name: linkedClientName,
												})}
											</span>
										) : null}
										{linkedPropertyTitle ? (
											<span className="mt-1 block">
												{t('realtorPro.deals.linkedListingShort', {
													title: linkedPropertyTitle,
												})}
											</span>
										) : null}
										<span className="mt-1 block">
											{deal.next_action ?? t('realtorPro.deals.noNextAction')}
										</span>
									</button>
								);
							})}
					</div>
				))}
			</div>
			{selectedDeal && (
				<div className="grid gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-3">
					<strong className="text-sm">
						{t('realtorPro.deals.timelineFor', { title: selectedDeal.title })}
					</strong>
					<ProfessionalWorldsFormField label={t('deals.stageLabel')}>
						<DesktopNativeSelect
							disabled={stageBusy}
							value={selectedDeal.stage}
							onChange={(event) =>
								void handleStageChange(selectedDeal.id, event.target.value)
							}
						>
							{PROFESSIONAL_DEAL_STAGE_OPTIONS.map((stage) => (
								<option key={stage} value={stage}>
									{isProfessionalDealStage(stage)
										? t(`deals.stages.${stage}`)
										: stage}
								</option>
							))}
						</DesktopNativeSelect>
					</ProfessionalWorldsFormField>
					<div className="flex flex-wrap gap-2">
						{selectedDeal.client_id ? (
							<DesktopAppButton
								size="sm"
								variant="ghost"
								onClick={() =>
									openClients({
										tab: 'directory',
										filterClientId: selectedDeal.client_id,
									})
								}
							>
								{t('realtorPro.deals.openClientDeals')}
							</DesktopAppButton>
						) : null}
						{resolveEffectiveDealPropertyId(
							selectedDeal,
							snapshot.properties
						) ? (
							<DesktopAppButton
								size="sm"
								variant="ghost"
								onClick={() =>
									openProperties({
										propertyId: resolveEffectiveDealPropertyId(
											selectedDeal,
											snapshot.properties
										),
									})
								}
							>
								{t('realtorPro.deals.openListing')}
							</DesktopAppButton>
						) : null}
						{communicationsModuleEnabled ? (
							<DesktopAppButton
								size="sm"
								variant="ghost"
								onClick={() =>
									openCommunications({
										relatedType: 'deal',
										relatedId: selectedDeal.id,
									})
								}
							>
								{t('realtorPro.communications.logCta')}
							</DesktopAppButton>
						) : null}
						{showingsModuleEnabled &&
						resolveEffectiveDealPropertyId(
							selectedDeal,
							snapshot.properties
						) ? (
							<DesktopAppButton
								size="sm"
								variant="ghost"
								onClick={() =>
									openShowings({
										propertyId: resolveEffectiveDealPropertyId(
											selectedDeal,
											snapshot.properties
										),
										clientId: selectedDeal.client_id,
									})
								}
							>
								{t('realtorPro.deals.scheduleShowingCta')}
							</DesktopAppButton>
						) : null}
					</div>
					{events.length === 0 ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('realtorPro.deals.noTimelineYet')}
						</p>
					) : (
						events.map((event) => (
							<p
								key={event.id}
								className="text-xs text-(--desktop-text-secondary)"
							>
								{formatDealStageLabel(t, event.stage_from)} →{' '}
								{formatDealStageLabel(t, event.stage_to)}:{' '}
								{event.note ?? t('realtorPro.deals.noNote')}
							</p>
						))
					)}
					<div className="grid gap-2 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) p-3">
						<strong className="text-xs">
							{t('realtorPro.deals.appendEventTitle')}
						</strong>
						<ProfessionalWorldsFormField
							label={t('realtorPro.deals.appendEventStageLabel')}
						>
							<DesktopNativeSelect
								disabled={eventBusy}
								value={draftEventStageTo}
								onChange={(event) => setDraftEventStageTo(event.target.value)}
								aria-label={t('realtorPro.deals.appendEventStageAria')}
							>
								{PROFESSIONAL_DEAL_STAGE_OPTIONS.map((stage) => (
									<option key={stage} value={stage}>
										{isProfessionalDealStage(stage)
											? t(`deals.stages.${stage}`)
											: stage}
									</option>
								))}
							</DesktopNativeSelect>
						</ProfessionalWorldsFormField>
						<ProfessionalWorldsFormField
							label={t('realtorPro.deals.appendEventNoteLabel')}
						>
							<ProfessionalWorldsTextarea
								value={draftEventNote}
								onChange={(event) => setDraftEventNote(event.target.value)}
								placeholder={t('realtorPro.deals.appendEventNotePlaceholder')}
								aria-label={t('realtorPro.deals.appendEventNoteLabel')}
								rows={2}
							/>
						</ProfessionalWorldsFormField>
						{eventBanner ? (
							<ProfessionalWorldsStatusBanner
								kind={eventBanner.kind}
								role="status"
							>
								{eventBanner.text}
							</ProfessionalWorldsStatusBanner>
						) : null}
						<div>
							<DesktopAppButton
								size="sm"
								disabled={eventBusy}
								onClick={() => void handleAppendDealEvent()}
							>
								{eventBusy
									? t('realtorPro.deals.appendEventSaving')
									: t('realtorPro.deals.appendEventButton')}
							</DesktopAppButton>
						</div>
					</div>
					<p className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-2 text-xs text-(--desktop-text-secondary)">
						{t('realtorPro.deals.recommendedNext')}{' '}
						{selectedDeal.next_action ?? t('realtorPro.deals.defaultFollowUp')}
					</p>
				</div>
			)}
			{unlinkedProperties.length > 0 ? (
				<div className="grid gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-xs text-(--desktop-text-secondary)">
					<p>{t('realtorPro.deals.unlinkedListingsHint')}</p>
					<ul className="grid gap-2">
						{unlinkedProperties.map((property) => (
							<li
								className="flex flex-wrap items-center justify-between gap-2 rounded-(--desktop-radius-sm) border border-(--desktop-border-subtle) bg-(--desktop-surface-raised)/40 p-2"
								key={property.id}
							>
								<span className="text-(--desktop-text-primary)">
									{property.title}
								</span>
								<DesktopAppButton
									size="sm"
									variant="ghost"
									onClick={() =>
										openClients({
											tab: 'capture',
											linkedPropertyId: property.id,
										})
									}
								>
									{t('realtorPro.deals.createDealForListing')}
								</DesktopAppButton>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</ProfessionalWorldsWorkspacePanel>
	);
}
