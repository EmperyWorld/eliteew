/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro communications timeline panel — quick log capture, filtered log list, and CRM deep-links.
 *
 * Invariants:
 * - Extracted from RealtorProPanels.tsx (Wave 3 FE split); behavior unchanged until barrel rewire.
 * - `communicationsFocus` from workspace pre-fills quick log form once per focus payload.
 * - Log rows resolve CRM actions via `resolveCommunicationLogCrmAction` (pipeline, clients, properties, leads).
 *
 * Related:
 * - ../RealtorProPanels.tsx (barrel re-export pending)
 * - ../../realtorLogic.ts
 * - ../../runtimeModuleRegistry.tsx
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTextarea,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';

import {
	createRealtorCommunicationLog,
	listRealtorCommunicationLogs,
	listRealtorLeads,
} from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import { useProfessionalToasts } from '../../ProfessionalToast';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import {
	buildCommunicationLogCreatePayload,
	listCommunicationLeadEntityOptions,
	listCommunicationRelatedEntityOptions,
	normalizeCommunicationRelatedType,
	resolveCommunicationLogCrmAction,
} from '../../realtorLogic';
import type { RealtorCommunicationLog, RealtorLead } from '../../types';

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

function formatCommunicationTypeLabel(
	t: RealtorPanelTranslate,
	relatedType: string | null | undefined
): string {
	const normalized = relatedType?.trim() || 'note';
	return translateRealtorValue(
		t,
		`realtorPro.communications.relatedTypes.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

function formatCommunicationChannelLabel(
	t: RealtorPanelTranslate,
	channel: string | null | undefined
): string {
	const normalized = channel?.trim() || 'note';
	return translateRealtorValue(
		t,
		`realtorPro.communications.channels.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

export function CommunicationTimelinePanel({
	snapshot,
}: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const {
		openClients,
		openPipeline,
		openProperties,
		openProfessionTool,
		communicationsFocus,
		consumeCommunicationsFocus,
	} = useProfessionalWorldsWorkspace();
	const [relatedTypeFilter, setRelatedTypeFilter] = useState('');
	const [draftRelatedType, setDraftRelatedType] = useState('deal');
	const [draftRelatedId, setDraftRelatedId] = useState(
		() => snapshot.deals[0]?.id ?? ''
	);
	const [draftChannel, setDraftChannel] = useState('');
	const [draftBody, setDraftBody] = useState('');
	const [draftLeads, setDraftLeads] = useState<RealtorLead[]>([]);
	const [draftLeadsLoading, setDraftLeadsLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [formSuccess, setFormSuccess] = useState<string | null>(null);
	const [{ data: logs, error, loading }, setLogsState] = useState<
		AsyncState<RealtorCommunicationLog[]>
	>({
		data: [],
		error: null,
		loading: true,
	});

	const draftRelatedKind = useMemo(
		() => normalizeCommunicationRelatedType(draftRelatedType),
		[draftRelatedType]
	);
	const relatedEntityOptions = useMemo(() => {
		if (!draftRelatedKind || draftRelatedKind === 'lead') {
			return [];
		}
		return listCommunicationRelatedEntityOptions(draftRelatedKind, snapshot);
	}, [draftRelatedKind, snapshot]);
	const leadEntityOptions = useMemo(
		() => listCommunicationLeadEntityOptions(draftLeads),
		[draftLeads]
	);
	const activeRelatedEntityOptions =
		draftRelatedKind === 'lead' ? leadEntityOptions : relatedEntityOptions;

	const reloadDraftLeads = useCallback(async () => {
		setDraftLeadsLoading(true);
		try {
			const data = await listRealtorLeads();
			setDraftLeads(data);
		} catch {
			setDraftLeads([]);
		} finally {
			setDraftLeadsLoading(false);
		}
	}, []);

	const reloadLogs = useCallback(
		async (relatedType: string) => {
			setLogsState((current) => ({ ...current, error: null, loading: true }));
			try {
				const data = await listRealtorCommunicationLogs({
					relatedType: relatedType || null,
					limit: 100,
				});
				setLogsState({ data, error: null, loading: false });
			} catch (caught: unknown) {
				setLogsState({
					data: [],
					error: formatProfessionalWorldsApiError(caught, (key) => t(key)),
					loading: false,
				});
			}
		},
		[t]
	);

	useEffect(() => {
		void reloadLogs(relatedTypeFilter);
	}, [relatedTypeFilter, reloadLogs]);

	useEffect(() => {
		if (draftRelatedKind !== 'lead') {
			return;
		}
		void reloadDraftLeads();
	}, [draftRelatedKind, reloadDraftLeads]);

	useEffect(() => {
		if (!communicationsFocus) {
			return;
		}
		if (communicationsFocus.relatedType?.trim()) {
			setDraftRelatedType(communicationsFocus.relatedType.trim());
		}
		if (communicationsFocus.relatedId?.trim()) {
			setDraftRelatedId(communicationsFocus.relatedId.trim());
		}
		consumeCommunicationsFocus();
	}, [communicationsFocus, consumeCommunicationsFocus]);

	const handleDraftRelatedTypeChange = useCallback(
		(nextType: string) => {
			setDraftRelatedType(nextType);
			const kind = normalizeCommunicationRelatedType(nextType);
			if (!kind || kind === 'lead') {
				setDraftRelatedId('');
				return;
			}
			const options = listCommunicationRelatedEntityOptions(kind, snapshot);
			setDraftRelatedId(options[0]?.id ?? '');
		},
		[snapshot]
	);

	const handleCreateLog = useCallback(async () => {
		const payload = buildCommunicationLogCreatePayload({
			relatedType: draftRelatedType,
			relatedId: draftRelatedId,
			channel: draftChannel,
			body: draftBody,
		});
		if (!payload) {
			setFormError(t('realtorPro.communications.validationMissingFields'));
			setFormSuccess(null);
			return;
		}
		setSaving(true);
		setFormError(null);
		setFormSuccess(null);
		try {
			await createRealtorCommunicationLog(payload);
			setDraftChannel('');
			setDraftBody('');
			setFormSuccess(t('realtorPro.communications.addLogSuccess'));
			notifySuccess(t('realtorPro.communications.addLogSuccess'));
			if (draftRelatedType && relatedTypeFilter !== draftRelatedType) {
				setRelatedTypeFilter(draftRelatedType);
			} else {
				await reloadLogs(relatedTypeFilter);
			}
		} catch (caught: unknown) {
			setFormError(formatProfessionalWorldsApiError(caught, (key) => t(key)));
			notifyApiError(caught, t, t('realtorPro.communications.addLogFailed'));
		} finally {
			setSaving(false);
		}
	}, [
		draftBody,
		draftChannel,
		draftRelatedId,
		draftRelatedType,
		notifyApiError,
		notifySuccess,
		relatedTypeFilter,
		reloadLogs,
		t,
	]);

	const applyCommunicationCrmAction = useCallback(
		(action: ReturnType<typeof resolveCommunicationLogCrmAction>) => {
			if (!action) {
				return;
			}
			switch (action.kind) {
				case 'pipeline':
					openPipeline({ dealId: action.dealId });
					break;
				case 'clients':
					openClients({
						tab: action.tab,
						filterClientId: action.filterClientId,
					});
					break;
				case 'properties':
					openProperties({ propertyId: action.propertyId });
					break;
				case 'leads':
					openProfessionTool('realtor_leads');
					break;
			}
		},
		[openClients, openPipeline, openProperties, openProfessionTool]
	);

	const communicationCrmLabel = useCallback(
		(
			action: NonNullable<ReturnType<typeof resolveCommunicationLogCrmAction>>
		) => {
			switch (action.kind) {
				case 'pipeline':
					return t('realtorPro.documents.openDealInPipeline');
				case 'clients':
					return t('realtorPro.tasks.openClientDirectory');
				case 'properties':
					return t('realtorPro.documents.openListing');
				case 'leads':
					return t('clients.openLeadsInProfessionTools');
			}
		},
		[t]
	);

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('realtorPro.communications.title')}
		>
			<div className="mb-4 grid gap-3 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) p-3">
				<strong className="text-sm">
					{t('realtorPro.communications.quickLogTitle')}
				</strong>
				<p className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.communications.quickLogHint')}
				</p>
				<div className="grid gap-2 sm:grid-cols-2">
					<ProfessionalWorldsFormField
						label={t('realtorPro.communications.relatedTypeLabel')}
					>
						<DesktopNativeSelect
							value={draftRelatedType}
							onChange={(event) =>
								handleDraftRelatedTypeChange(event.target.value)
							}
							aria-label={t('realtorPro.communications.relatedTypeAria')}
						>
							<option value="deal">
								{t('realtorPro.communications.filterDeal')}
							</option>
							<option value="client">
								{t('realtorPro.communications.filterClient')}
							</option>
							<option value="property">
								{t('realtorPro.communications.filterProperty')}
							</option>
							<option value="lead">
								{t('realtorPro.communications.filterLead')}
							</option>
						</DesktopNativeSelect>
					</ProfessionalWorldsFormField>
					{draftRelatedKind ? (
						<ProfessionalWorldsFormField
							label={t('realtorPro.communications.relatedEntityLabel')}
						>
							<DesktopNativeSelect
								value={draftRelatedId}
								onChange={(event) => setDraftRelatedId(event.target.value)}
								aria-label={t('realtorPro.communications.relatedEntityLabel')}
								disabled={
									draftRelatedKind === 'lead'
										? draftLeadsLoading
										: activeRelatedEntityOptions.length === 0
								}
							>
								<option value="">
									{draftRelatedKind === 'lead'
										? t('realtorPro.communications.relatedLeadOptional')
										: t('realtorPro.communications.relatedEntityPlaceholder')}
								</option>
								{activeRelatedEntityOptions.map((option) => (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								))}
							</DesktopNativeSelect>
							{draftRelatedKind === 'lead' && draftLeadsLoading ? (
								<span className="mt-1 block text-xs text-(--desktop-text-muted)">
									{t('realtorPro.loading')}
								</span>
							) : null}
						</ProfessionalWorldsFormField>
					) : null}
					<ProfessionalWorldsFormField
						label={t('realtorPro.communications.channelLabel')}
					>
						<DesktopAppInput
							value={draftChannel}
							onChange={(event) => setDraftChannel(event.target.value)}
							placeholder={t('realtorPro.communications.channelPlaceholder')}
							aria-label={t('realtorPro.communications.channelLabel')}
						/>
					</ProfessionalWorldsFormField>
				</div>
				<ProfessionalWorldsFormField
					label={t('realtorPro.communications.bodyLabel')}
				>
					<ProfessionalWorldsTextarea
						value={draftBody}
						onChange={(event) => setDraftBody(event.target.value)}
						placeholder={t('realtorPro.communications.bodyPlaceholder')}
						aria-label={t('realtorPro.communications.bodyLabel')}
						rows={3}
					/>
				</ProfessionalWorldsFormField>
				{formError ? (
					<ProfessionalWorldsStatusBanner kind="error" role="alert">
						{formError}
					</ProfessionalWorldsStatusBanner>
				) : null}
				{formSuccess ? (
					<ProfessionalWorldsStatusBanner kind="success" role="status">
						{formSuccess}
					</ProfessionalWorldsStatusBanner>
				) : null}
				<div>
					<DesktopAppButton
						size="sm"
						onClick={() => void handleCreateLog()}
						disabled={saving}
					>
						{saving
							? t('realtorPro.communications.addLogSaving')
							: t('realtorPro.communications.addLogCta')}
					</DesktopAppButton>
				</div>
			</div>
			<ProfessionalWorldsFormField
				label={t('realtorPro.communications.filterLabel')}
			>
				<DesktopNativeSelect
					value={relatedTypeFilter}
					onChange={(event) => setRelatedTypeFilter(event.target.value)}
					aria-label={t('realtorPro.communications.relatedTypeAria')}
				>
					<option value="">{t('realtorPro.communications.filterAll')}</option>
					<option value="deal">
						{t('realtorPro.communications.filterDeal')}
					</option>
					<option value="client">
						{t('realtorPro.communications.filterClient')}
					</option>
					<option value="property">
						{t('realtorPro.communications.filterProperty')}
					</option>
					<option value="lead">
						{t('realtorPro.communications.filterLead')}
					</option>
				</DesktopNativeSelect>
			</ProfessionalWorldsFormField>
			{error ? (
				<ProfessionalWorldsStatusBanner kind="error" role="alert">
					{error}
				</ProfessionalWorldsStatusBanner>
			) : null}
			{loading ? (
				<span className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.loading')}
				</span>
			) : logs.length === 0 ? (
				<DesktopAppEmptyState
					title={t('realtorPro.communications.emptyTitle')}
					description={t('realtorPro.communications.emptyDescription')}
				/>
			) : (
				<div className="grid gap-2">
					{logs.map((log) => {
						const crmAction = resolveCommunicationLogCrmAction(log);
						const relatedKind = normalizeCommunicationRelatedType(
							log.related_type
						);
						return (
							<article
								key={log.id}
								className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm"
							>
								<strong>
									{formatCommunicationChannelLabel(t, log.channel)}
								</strong>
								<p className="mt-1 text-xs text-(--desktop-text-secondary)">
									{formatCommunicationTypeLabel(
										t,
										relatedKind ?? log.related_type
									)}{' '}
									· {log.body}
								</p>
								{crmAction ? (
									<div className="mt-2">
										<DesktopAppButton
											size="sm"
											variant="ghost"
											onClick={() => applyCommunicationCrmAction(crmAction)}
										>
											{communicationCrmLabel(crmAction)}
										</DesktopAppButton>
									</div>
								) : null}
							</article>
						);
					})}
				</div>
			)}
		</ProfessionalWorldsWorkspacePanel>
	);
}
