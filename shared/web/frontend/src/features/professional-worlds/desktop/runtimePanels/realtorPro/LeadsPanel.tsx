/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro leads inbox panel: kanban/list views, manual lead capture, and lead-to-client conversion.
 *
 * Invariants:
 * - Lead create uses active vertical slug and reloads list on success; conversion patches workspace snapshot with new client.
 * - Communications and pipeline CTAs appear only when respective addon modules are enabled.
 *
 * Related:
 * - ./shared.ts
 * - ../RealtorProPanels.tsx
 * - documentation/product/PROFESSIONAL-WORLDS.md
 * ---
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTextarea,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';

import {
	convertRealtorLeadToClient,
	createRealtorLead,
	listRealtorLeads,
} from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import { useProfessionalToasts } from '../../ProfessionalToast';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import { prependClientToSnapshot } from '../../professionalWorldsSnapshotUtils';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import type { RealtorLead } from '../../types';

import {
	type AsyncState,
	Badge,
	formatLeadStatusLabel,
	PanelStatus,
} from './shared';

function LeadCard({
	lead,
	onConvert,
	onLogCommunication,
	showLogCommunication = false,
}: {
	lead: RealtorLead;
	onConvert: () => void | Promise<void>;
	onLogCommunication?: () => void;
	showLogCommunication?: boolean;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [busy, setBusy] = useState(false);

	return (
		<article className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-black/10 p-3 text-sm">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<strong>{lead.name}</strong>
				<Badge>{lead.source ?? t('realtorPro.leads.sourceUnknown')}</Badge>
			</div>
			<p className="mt-1 text-xs text-(--desktop-text-secondary)">
				{lead.contact ?? t('realtorPro.leads.noContact')} ·{' '}
				{lead.notes ?? t('realtorPro.leads.noNotes')}
			</p>
			{lead.converted_client_id ? (
				<p className="mt-2 text-xs text-(--desktop-text-muted)">
					{t('realtorPro.leads.convertedLabel')}
				</p>
			) : (
				<div className="mt-2 grid gap-2">
					<div className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-2 text-xs text-(--desktop-text-secondary)">
						{t('realtorPro.leads.conversionHint')}
					</div>
					<div className="flex flex-wrap gap-2">
						{showLogCommunication && onLogCommunication ? (
							<DesktopAppButton
								size="sm"
								variant="ghost"
								onClick={onLogCommunication}
							>
								{t('realtorPro.communications.logCta')}
							</DesktopAppButton>
						) : null}
						<DesktopAppButton
							size="sm"
							disabled={busy}
							onClick={() => {
								setBusy(true);
								void Promise.resolve(onConvert()).finally(() => setBusy(false));
							}}
						>
							{t('realtorPro.leads.convertButton')}
						</DesktopAppButton>
					</div>
				</div>
			)}
		</article>
	);
}

export function LeadsPanel(_props: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const {
		activeVerticalSlug,
		openClients,
		openCommunications,
		openPipeline,
		patchSnapshot,
		verticalAddonModules,
	} = useProfessionalWorldsWorkspace();
	const pipelineModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_pipeline'
	);
	const communicationsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_communications'
	);
	const [view, setView] = useState<'list' | 'kanban'>('kanban');
	const [newLeadName, setNewLeadName] = useState('');
	const [newLeadContact, setNewLeadContact] = useState('');
	const [newLeadNotes, setNewLeadNotes] = useState('');
	const [createBusy, setCreateBusy] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [convertError, setConvertError] = useState<string | null>(null);
	const [convertNotice, setConvertNotice] = useState<{
		clientId: string;
		name: string;
	} | null>(null);
	const [{ data: leads, error, loading }, setLeadsState] = useState<
		AsyncState<RealtorLead[]>
	>({
		data: [],
		error: null,
		loading: true,
	});

	const reloadLeads = useCallback(async () => {
		setLeadsState((current) => ({ ...current, error: null, loading: true }));
		try {
			const data = await listRealtorLeads();
			setLeadsState({ data, error: null, loading: false });
		} catch (err: unknown) {
			setLeadsState({
				data: [],
				error: formatProfessionalWorldsApiError(err, (key) => t(key)),
				loading: false,
			});
		}
	}, [t]);

	useEffect(() => {
		void reloadLeads();
	}, [reloadLeads]);

	const handleCreateLead = useCallback(async () => {
		if (!newLeadName.trim()) return;
		setCreateBusy(true);
		setCreateError(null);
		try {
			await createRealtorLead({
				vertical_slug: activeVerticalSlug,
				name: newLeadName.trim(),
				contact: newLeadContact.trim() || null,
				notes: newLeadNotes.trim() || null,
				source: 'manual',
				status: 'new',
				lead_data: {},
			});
			setNewLeadName('');
			setNewLeadContact('');
			setNewLeadNotes('');
			await reloadLeads();
			notifySuccess(t('realtorPro.leads.createSuccess'));
		} catch (err: unknown) {
			setCreateError(formatProfessionalWorldsApiError(err, (key) => t(key)));
			notifyApiError(err, t, t('realtorPro.leads.createFailed'));
		} finally {
			setCreateBusy(false);
		}
	}, [
		activeVerticalSlug,
		newLeadContact,
		newLeadName,
		newLeadNotes,
		notifyApiError,
		notifySuccess,
		reloadLeads,
		t,
	]);

	const handleConvertLead = useCallback(
		async (leadId: string) => {
			setConvertError(null);
			setConvertNotice(null);
			try {
				const result = await convertRealtorLeadToClient(leadId);
				patchSnapshot((current) =>
					prependClientToSnapshot(current, result.client)
				);
				setConvertNotice({
					clientId: result.client.id,
					name: result.client.name,
				});
				notifySuccess(
					t('realtorPro.leads.convertSuccess', { name: result.client.name })
				);
				await reloadLeads();
			} catch (err: unknown) {
				setConvertNotice(null);
				const message = formatProfessionalWorldsApiError(
					err,
					(key) => t(key),
					t('realtorPro.leads.convertFailed')
				);
				setConvertError(message);
				notifyApiError(err, t, t('realtorPro.leads.convertFailed'));
			}
		},
		[notifyApiError, notifySuccess, patchSnapshot, reloadLeads, t]
	);

	const statuses = [...new Set(leads.map((lead) => lead.status || 'new'))];

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('realtorPro.leads.inboxTitle')}
			actions={
				<>
					<PanelStatus error={error} loading={loading} />
					<DesktopAppButton
						size="sm"
						variant="ghost"
						active={view === 'kanban'}
						onClick={() => setView('kanban')}
					>
						{t('realtorPro.leads.kanban')}
					</DesktopAppButton>
					<DesktopAppButton
						size="sm"
						variant="ghost"
						active={view === 'list'}
						onClick={() => setView('list')}
					>
						{t('realtorPro.leads.list')}
					</DesktopAppButton>
				</>
			}
		>
			<div className="mb-4 grid gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-3">
				<strong className="text-sm">{t('realtorPro.leads.createTitle')}</strong>
				{createError ? (
					<ProfessionalWorldsStatusBanner kind="error" role="alert">
						{createError}
					</ProfessionalWorldsStatusBanner>
				) : null}
				<div className="grid gap-2 md:grid-cols-2">
					<ProfessionalWorldsFormField label={t('realtorPro.leads.nameLabel')}>
						<DesktopAppInput
							value={newLeadName}
							onChange={(event) => setNewLeadName(event.target.value)}
							placeholder={t('realtorPro.leads.namePlaceholder')}
						/>
					</ProfessionalWorldsFormField>
					<ProfessionalWorldsFormField
						label={t('realtorPro.leads.contactLabel')}
					>
						<DesktopAppInput
							value={newLeadContact}
							onChange={(event) => setNewLeadContact(event.target.value)}
							placeholder={t('realtorPro.leads.contactPlaceholder')}
						/>
					</ProfessionalWorldsFormField>
				</div>
				<ProfessionalWorldsFormField label={t('realtorPro.leads.notesLabel')}>
					<ProfessionalWorldsTextarea
						value={newLeadNotes}
						onChange={(event) => setNewLeadNotes(event.target.value)}
						placeholder={t('realtorPro.leads.notesPlaceholder')}
					/>
				</ProfessionalWorldsFormField>
				<DesktopAppButton
					disabled={createBusy || !newLeadName.trim()}
					onClick={() => void handleCreateLead()}
				>
					{t('realtorPro.leads.createButton')}
				</DesktopAppButton>
			</div>
			{convertError ? (
				<ProfessionalWorldsStatusBanner kind="error" role="alert">
					{convertError}
				</ProfessionalWorldsStatusBanner>
			) : null}
			{convertNotice ? (
				<ProfessionalWorldsStatusBanner kind="success" role="status">
					<span>
						{t('realtorPro.leads.convertSuccess', {
							name: convertNotice.name,
						})}
					</span>
					<div className="mt-2 flex flex-wrap gap-2">
						<DesktopAppButton
							size="sm"
							variant="ghost"
							onClick={() =>
								openClients({
									tab: 'directory',
									filterClientId: convertNotice.clientId,
								})
							}
						>
							{t('realtorPro.leads.openClients')}
						</DesktopAppButton>
						<DesktopAppButton
							size="sm"
							onClick={() =>
								openClients({
									tab: 'capture',
									dealClientId: convertNotice.clientId,
								})
							}
						>
							{t('realtorPro.leads.createDeal')}
						</DesktopAppButton>
						{pipelineModuleEnabled ? (
							<DesktopAppButton
								size="sm"
								variant="ghost"
								onClick={() => openPipeline()}
							>
								{t('realtorPro.leads.openPipeline')}
							</DesktopAppButton>
						) : null}
					</div>
				</ProfessionalWorldsStatusBanner>
			) : null}
			{leads.length === 0 ? (
				<DesktopAppEmptyState
					title={t('realtorPro.leads.emptyTitle')}
					description={t('realtorPro.leads.emptyDescription')}
				/>
			) : view === 'kanban' ? (
				<div className="grid gap-3 md:grid-cols-3">
					{statuses.map((status) => (
						<div
							key={status}
							className="grid content-start gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3"
						>
							<strong className="text-sm">
								{formatLeadStatusLabel(t, status)}
							</strong>
							{leads
								.filter((lead) => (lead.status || 'new') === status)
								.map((lead) => (
									<LeadCard
										key={lead.id}
										lead={lead}
										onConvert={() => void handleConvertLead(lead.id)}
										showLogCommunication={communicationsModuleEnabled}
										onLogCommunication={() =>
											openCommunications({
												relatedType: 'lead',
												relatedId: lead.id,
											})
										}
									/>
								))}
						</div>
					))}
				</div>
			) : (
				<div className="grid gap-2">
					{leads.map((lead) => (
						<LeadCard
							key={lead.id}
							lead={lead}
							onConvert={() => void handleConvertLead(lead.id)}
							showLogCommunication={communicationsModuleEnabled}
							onLogCommunication={() =>
								openCommunications({
									relatedType: 'lead',
									relatedId: lead.id,
								})
							}
						/>
					))}
				</div>
			)}
		</ProfessionalWorldsWorkspacePanel>
	);
}
