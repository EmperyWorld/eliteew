/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro showings calendar — schedule viewings, link clients/deals, and capture outcomes.
 *
 * Invariants:
 * - Listing context prefers workspace `selectedPropertyId`; deep-links via `showingsFocus` consume once on mount.
 * - Delete requires `ProfessionalWorldsDeleteAction` confirm (`showingDeleteTarget`); no one-click DELETE.
 * - Deal auto-link uses `findUniqueDealForShowingContext` on save when property + client match one deal.
 *
 * Related:
 * - ../../components/ProfessionalWorldsDeleteAction.tsx
 * - ../../realtorLogic.ts
 * - ../RealtorProPanels.tsx (legacy export until Wave 3 barrel)
 */

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	createRealtorShowing,
	deleteRealtorShowing,
	listRealtorShowings,
	updateRealtorShowing,
} from '../../api';
import { ProfessionalWorldsDeleteAction } from '../../components/ProfessionalWorldsDeleteAction';
import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTextarea,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';
import { useProfessionalToasts } from '../../ProfessionalToast';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import {
	findUniqueDealForShowingContext,
	resolveClientNameById,
	resolveShowingCommunicationFocus,
	resolveShowingLinkedDealId,
} from '../../realtorLogic';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import type {
	ProfessionalClient,
	RealtorShowing,
	RealtorShowingUpdate,
} from '../../types';

type ShowingStatus = NonNullable<RealtorShowingUpdate['status']>;

const SHOWING_STATUSES = [
	'planned',
	'interested',
	'follow_up',
	'declined',
] as const satisfies readonly ShowingStatus[];

function isShowingStatus(value: string): value is ShowingStatus {
	return (SHOWING_STATUSES as readonly string[]).includes(value);
}

function formatShowingDatetimeLocal(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function resolvePreferredPropertyId(
	snapshot: RuntimeModulePanelProps['snapshot'],
	selectedPropertyId: string | null | undefined
): string {
	if (
		selectedPropertyId &&
		snapshot.properties.some((property) => property.id === selectedPropertyId)
	) {
		return selectedPropertyId;
	}
	return snapshot.properties[0]?.id ?? '';
}

export function ShowingsCalendarPanel({ snapshot }: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const {
		consumeShowingsFocus,
		openClients,
		openCommunications,
		openPipeline,
		openProperties,
		selectedPropertyId,
		setSelectedPropertyId,
		showingsFocus,
		verticalAddonModules,
	} = useProfessionalWorldsWorkspace();
	const communicationsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_communications'
	);
	const fieldIdPrefix = useId();
	const showingPropertyFilterId = `${fieldIdPrefix}-property-filter`;
	const showingDraftPropertyId = `${fieldIdPrefix}-draft-property`;
	const showingDraftScheduledId = `${fieldIdPrefix}-draft-scheduled`;
	const showingDraftClientId = `${fieldIdPrefix}-draft-client`;
	const showingDraftNotesId = `${fieldIdPrefix}-draft-notes`;
	const [showings, setShowings] = useState<RealtorShowing[]>([]);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [propertyFilter, setPropertyFilter] = useState<string>('');
	const [draftPropertyId, setDraftPropertyId] = useState(
		resolvePreferredPropertyId(snapshot, selectedPropertyId)
	);
	const [draftScheduled, setDraftScheduled] = useState('');
	const [draftClientId, setDraftClientId] = useState('');
	const [draftNotes, setDraftNotes] = useState('');
	const [editingShowingId, setEditingShowingId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [showingDeleteTarget, setShowingDeleteTarget] = useState<{
		id: string;
		label: string;
	} | null>(null);

	const loadShowings = useCallback(async () => {
		setLoading(true);
		try {
			const rows = await listRealtorShowings(
				propertyFilter ? { propertyId: propertyFilter } : {}
			);
			setShowings(
				[...rows].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
			);
			setLoadError(null);
		} catch (caught: unknown) {
			setLoadError(
				caught instanceof Error
					? caught.message
					: t('realtorPro.showings.loadError')
			);
			setShowings([]);
		} finally {
			setLoading(false);
		}
	}, [propertyFilter, t]);

	useEffect(() => {
		void loadShowings();
	}, [loadShowings]);

	useEffect(() => {
		const preferred = resolvePreferredPropertyId(snapshot, selectedPropertyId);
		if (preferred && preferred !== draftPropertyId && !editingShowingId) {
			setDraftPropertyId(preferred);
		}
	}, [draftPropertyId, editingShowingId, selectedPropertyId, snapshot]);

	useEffect(() => {
		if (!showingsFocus) return;
		if (showingsFocus.propertyId?.trim()) {
			const propertyId = showingsFocus.propertyId.trim();
			setPropertyFilter(propertyId);
			setDraftPropertyId(propertyId);
			setSelectedPropertyId(propertyId);
		}
		if (showingsFocus.clientId?.trim()) {
			setDraftClientId(showingsFocus.clientId.trim());
		}
		consumeShowingsFocus();
	}, [consumeShowingsFocus, setSelectedPropertyId, showingsFocus]);

	const resetShowingForm = useCallback(() => {
		setEditingShowingId(null);
		setDraftPropertyId(
			resolvePreferredPropertyId(snapshot, selectedPropertyId)
		);
		setDraftScheduled('');
		setDraftClientId('');
		setDraftNotes('');
	}, [selectedPropertyId, snapshot]);

	const beginEditShowing = useCallback(
		(showing: RealtorShowing) => {
			setEditingShowingId(showing.id);
			setDraftPropertyId(showing.property_id);
			setDraftScheduled(formatShowingDatetimeLocal(showing.scheduled_at));
			setDraftClientId(showing.client_id ?? '');
			setDraftNotes(showing.notes ?? '');
			setSelectedPropertyId(showing.property_id);
		},
		[setSelectedPropertyId]
	);

	const resolvePropertyTitle = useCallback(
		(id: string) => snapshot.properties.find((p) => p.id === id)?.title ?? id,
		[snapshot.properties]
	);

	const matchedDraftDeal = useMemo(
		() =>
			findUniqueDealForShowingContext(
				snapshot.deals,
				snapshot.properties,
				draftPropertyId,
				draftClientId
			),
		[draftClientId, draftPropertyId, snapshot.deals, snapshot.properties]
	);

	const handleSaveShowing = useCallback(async () => {
		if (!draftPropertyId.trim() || !draftScheduled.trim()) return;
		setSaving(true);
		try {
			const linkedDeal = findUniqueDealForShowingContext(
				snapshot.deals,
				snapshot.properties,
				draftPropertyId,
				draftClientId
			);
			if (editingShowingId) {
				const updated = await updateRealtorShowing(editingShowingId, {
					client_id: draftClientId.trim() ? draftClientId.trim() : null,
					clear_client: !draftClientId.trim(),
					deal_id: linkedDeal?.id ?? null,
					clear_deal: !linkedDeal,
					scheduled_at: new Date(draftScheduled).toISOString(),
					notes: draftNotes.trim() || null,
				});
				setShowings((current) =>
					current.map((item) => (item.id === editingShowingId ? updated : item))
				);
				resetShowingForm();
				notifySuccess(t('realtorPro.showings.updateSuccess'));
				return;
			}
			await createRealtorShowing({
				property_id: draftPropertyId,
				client_id: draftClientId.trim() ? draftClientId.trim() : null,
				deal_id: linkedDeal?.id ?? null,
				scheduled_at: new Date(draftScheduled).toISOString(),
				status: 'planned',
				notes: draftNotes.trim() || null,
				duration_minutes: null,
				location_notes: null,
			});
			resetShowingForm();
			await loadShowings();
			notifySuccess(t('realtorPro.showings.createSuccess'));
		} catch (caught: unknown) {
			notifyApiError(
				caught,
				t,
				editingShowingId
					? t('realtorPro.showings.updateFailed')
					: t('realtorPro.showings.saveFailed')
			);
		} finally {
			setSaving(false);
		}
	}, [
		draftClientId,
		draftNotes,
		draftPropertyId,
		draftScheduled,
		editingShowingId,
		loadShowings,
		notifyApiError,
		notifySuccess,
		resetShowingForm,
		snapshot.deals,
		snapshot.properties,
		t,
	]);

	const handleStatusChange = useCallback(
		async (showingId: string, nextStatus: string) => {
			if (!isShowingStatus(nextStatus)) {
				return;
			}
			setSaving(true);
			try {
				const updated = await updateRealtorShowing(showingId, {
					status: nextStatus,
					clear_client: false,
					clear_deal: false,
				});
				setShowings((current) =>
					current.map((item) => (item.id === showingId ? updated : item))
				);
				notifySuccess(t('realtorPro.showings.statusUpdated'));
			} catch (caught: unknown) {
				notifyApiError(caught, t, t('realtorPro.showings.saveFailed'));
			} finally {
				setSaving(false);
			}
		},
		[notifyApiError, notifySuccess, t]
	);

	const handleDeleteShowing = useCallback(async () => {
		if (!showingDeleteTarget) return;
		setSaving(true);
		try {
			await deleteRealtorShowing(showingDeleteTarget.id);
			setShowings((current) =>
				current.filter((item) => item.id !== showingDeleteTarget.id)
			);
			if (editingShowingId === showingDeleteTarget.id) {
				resetShowingForm();
			}
			notifySuccess(t('realtorPro.showings.deleteSuccess'));
			setShowingDeleteTarget(null);
		} catch (caught: unknown) {
			notifyApiError(caught, t, t('realtorPro.showings.saveFailed'));
		} finally {
			setSaving(false);
		}
	}, [
		editingShowingId,
		notifyApiError,
		notifySuccess,
		resetShowingForm,
		showingDeleteTarget,
		t,
	]);

	const buildShowingDeleteLabel = useCallback(
		(showing: RealtorShowing) => {
			const propertyTitle = resolvePropertyTitle(showing.property_id);
			const when = new Date(showing.scheduled_at).toLocaleString();
			return `${propertyTitle} · ${when}`;
		},
		[resolvePropertyTitle]
	);

	const summaryCount = showings.filter((row) =>
		['planned', 'follow_up', 'interested'].includes(row.status)
	).length;

	return (
		<ProfessionalWorldsWorkspacePanel title={t('realtorPro.showings.title')}>
			{loadError ? (
				<ProfessionalWorldsStatusBanner kind="error" role="alert">
					{loadError}
				</ProfessionalWorldsStatusBanner>
			) : null}
			<div className="grid gap-2 md:grid-cols-2">
				<ProfessionalWorldsFormField
					htmlFor={showingPropertyFilterId}
					label={t('realtorPro.showings.propertyFilter')}
				>
					<DesktopNativeSelect
						id={showingPropertyFilterId}
						value={propertyFilter}
						onChange={(event) => setPropertyFilter(event.target.value)}
					>
						<option value="">{t('realtorPro.showings.allProperties')}</option>
						{snapshot.properties.map((property) => (
							<option key={property.id} value={property.id}>
								{property.title}
							</option>
						))}
					</DesktopNativeSelect>
				</ProfessionalWorldsFormField>
				<div className="flex items-end justify-end">
					<DesktopAppButton
						size="sm"
						variant="ghost"
						disabled={loading}
						onClick={() => void loadShowings()}
					>
						{t('actions.refresh')}
					</DesktopAppButton>
				</div>
			</div>
			<p className="text-xs text-(--desktop-text-muted)">
				{t('realtorPro.showings.scheduledSummary', { count: summaryCount })}
			</p>
			<div className="grid gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-3">
				<strong className="text-sm">
					{editingShowingId
						? t('realtorPro.showings.editHeading')
						: t('realtorPro.showings.scheduleHeading')}
				</strong>
				<ProfessionalWorldsFormField
					htmlFor={showingDraftPropertyId}
					label={t('realtorPro.showings.assignmentListing')}
				>
					<DesktopNativeSelect
						id={showingDraftPropertyId}
						value={draftPropertyId}
						disabled={Boolean(editingShowingId)}
						onChange={(event) => {
							setDraftPropertyId(event.target.value);
							setSelectedPropertyId(event.target.value || null);
						}}
					>
						{snapshot.properties.length === 0 ? (
							<option value="">
								{t('properties.workspaceNeedsListingTitle')}
							</option>
						) : null}
						{snapshot.properties.map((property) => (
							<option key={property.id} value={property.id}>
								{property.title}
							</option>
						))}
					</DesktopNativeSelect>
				</ProfessionalWorldsFormField>
				<ProfessionalWorldsFormField
					htmlFor={showingDraftScheduledId}
					label={t('realtorPro.showings.datetimeLabel')}
				>
					<DesktopAppInput
						id={showingDraftScheduledId}
						type="datetime-local"
						value={draftScheduled}
						onChange={(event) => setDraftScheduled(event.target.value)}
					/>
				</ProfessionalWorldsFormField>
				<ProfessionalWorldsFormField
					htmlFor={showingDraftClientId}
					label={t('realtorPro.showings.clientLabel')}
				>
					<DesktopNativeSelect
						id={showingDraftClientId}
						value={draftClientId}
						onChange={(event) => setDraftClientId(event.target.value)}
					>
						<option value="">{t('realtorPro.showings.noClient')}</option>
						{snapshot.clients.map((client: ProfessionalClient) => (
							<option key={client.id} value={client.id}>
								{client.name}
							</option>
						))}
					</DesktopNativeSelect>
				</ProfessionalWorldsFormField>
				<ProfessionalWorldsFormField
					htmlFor={showingDraftNotesId}
					label={t('realtorPro.showings.notesLabel')}
				>
					<ProfessionalWorldsTextarea
						id={showingDraftNotesId}
						className="min-h-16"
						value={draftNotes}
						onChange={(event) => setDraftNotes(event.target.value)}
					/>
				</ProfessionalWorldsFormField>
				{matchedDraftDeal ? (
					<p className="text-xs text-(--desktop-text-secondary)">
						{t('realtorPro.showings.dealLinkHint', {
							title: matchedDraftDeal.title,
						})}
					</p>
				) : null}
				<DesktopAppButton
					disabled={saving || !draftPropertyId || !draftScheduled}
					onClick={() => void handleSaveShowing()}
				>
					{saving
						? t('realtorPro.showings.creating')
						: editingShowingId
							? t('realtorPro.showings.saveChangesButton')
							: t('realtorPro.showings.createButton')}
				</DesktopAppButton>
				{editingShowingId ? (
					<DesktopAppButton
						variant="ghost"
						disabled={saving}
						onClick={resetShowingForm}
					>
						{t('realtorPro.showings.cancelEditButton')}
					</DesktopAppButton>
				) : null}
			</div>
			{loading ? (
				<span className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.loading')}
				</span>
			) : showings.length === 0 ? (
				<DesktopAppEmptyState
					description={t('realtorPro.showings.emptyDescription')}
					title={t('realtorPro.showings.emptyTitle')}
				/>
			) : (
				<div className="grid gap-2">
					{showings.map((showing) => {
						const linkedClientName = resolveClientNameById(
							snapshot.clients,
							showing.client_id
						);
						const linkedDealId = resolveShowingLinkedDealId(
							showing,
							snapshot.deals,
							snapshot.properties
						);
						return (
							<article
								key={showing.id}
								className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-xs text-(--desktop-text-secondary)"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<strong className="text-sm text-(--desktop-text-primary)">
										{resolvePropertyTitle(showing.property_id)}
									</strong>
									<div className="flex flex-wrap items-center gap-2">
										<span>
											{new Date(showing.scheduled_at).toLocaleString()}
										</span>
										<DesktopAppButton
											size="sm"
											variant="ghost"
											disabled={saving}
											onClick={() => beginEditShowing(showing)}
										>
											{t('realtorPro.showings.editShowing')}
										</DesktopAppButton>
										<DesktopAppButton
											size="sm"
											variant="ghost"
											disabled={saving}
											onClick={() =>
												setShowingDeleteTarget({
													id: showing.id,
													label: buildShowingDeleteLabel(showing),
												})
											}
										>
											{t('realtorPro.showings.deleteAction')}
										</DesktopAppButton>
									</div>
								</div>
								{linkedClientName ? (
									<p className="mt-1 text-[11px] text-(--desktop-text-muted)">
										{t('realtorPro.showings.linkedClientShort', {
											name: linkedClientName,
										})}
									</p>
								) : null}
								<div className="mt-2 flex flex-wrap gap-2">
									<DesktopAppButton
										size="sm"
										variant="ghost"
										onClick={() =>
											openProperties({ propertyId: showing.property_id })
										}
									>
										{t('realtorPro.showings.openListing')}
									</DesktopAppButton>
									{showing.client_id ? (
										<DesktopAppButton
											size="sm"
											variant="ghost"
											onClick={() =>
												openClients({
													tab: 'directory',
													filterClientId: showing.client_id,
												})
											}
										>
											{t('realtorPro.showings.openClient')}
										</DesktopAppButton>
									) : null}
									{linkedDealId ? (
										<DesktopAppButton
											size="sm"
											variant="ghost"
											onClick={() => openPipeline({ dealId: linkedDealId })}
										>
											{t('realtorPro.showings.openDealInPipeline')}
										</DesktopAppButton>
									) : null}
									{communicationsModuleEnabled ? (
										<DesktopAppButton
											size="sm"
											variant="ghost"
											onClick={() =>
												openCommunications(
													resolveShowingCommunicationFocus(
														showing,
														snapshot.deals,
														snapshot.properties
													)
												)
											}
										>
											{t('realtorPro.communications.logCta')}
										</DesktopAppButton>
									) : null}
								</div>
								<ProfessionalWorldsFormField
									className="mt-2 text-[11px] uppercase tracking-wide text-(--desktop-text-muted)"
									htmlFor={`${fieldIdPrefix}-outcome-${showing.id}`}
									label={t('realtorPro.showings.tableOutcome')}
								>
									<DesktopNativeSelect
										id={`${fieldIdPrefix}-outcome-${showing.id}`}
										disabled={saving}
										value={
											['interested', 'follow_up', 'declined'].includes(
												showing.status
											)
												? showing.status
												: 'planned'
										}
										onChange={(event) =>
											void handleStatusChange(showing.id, event.target.value)
										}
									>
										<option value="planned">
											{t('realtorPro.showings.plannedStatus')}
										</option>
										<option value="interested">
											{t('realtorPro.showings.outcomeInterested')}
										</option>
										<option value="follow_up">
											{t('realtorPro.showings.outcomeFollowUp')}
										</option>
										<option value="declined">
											{t('realtorPro.showings.outcomeDeclined')}
										</option>
									</DesktopNativeSelect>
								</ProfessionalWorldsFormField>
								{showing.notes ? (
									<p className="mt-2 text-[11px] text-(--desktop-text-muted)">
										{showing.notes}
									</p>
								) : null}
							</article>
						);
					})}
				</div>
			)}
			<ProfessionalWorldsDeleteAction
				isOpen={showingDeleteTarget !== null}
				onClose={() => setShowingDeleteTarget(null)}
				onConfirm={handleDeleteShowing}
				title={t('realtorPro.showings.deleteTitle')}
				itemName={showingDeleteTarget?.label}
				warningMessage={t('realtorPro.showings.deleteWarning')}
				confirmButtonLabel={t('realtorPro.showings.deleteAction')}
			/>
		</ProfessionalWorldsWorkspacePanel>
	);
}
