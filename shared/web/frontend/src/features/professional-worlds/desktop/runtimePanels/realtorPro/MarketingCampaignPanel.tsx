/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro marketing campaigns and publication channels panel for listing-centric outreach.
 *
 * Invariants:
 * - Listing context follows workspace `selectedPropertyId` via `resolvePreferredPropertyId`.
 * - Campaign CRUD uses OpenAPI-aligned REST clients; publication channels load per listing.
 * - `ListingCrmBridgeActions` deep-links pipeline, clients, and communications without auto-send.
 *
 * Related:
 * - ../../api.ts
 * - ../../runtimeModuleRegistry.tsx
 * - RealtorProPanels.tsx (barrel re-export target)
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
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';

import {
	createRealtorMarketingCampaign,
	listRealtorMarketingCampaigns,
	listRealtorPublicationChannels,
	patchRealtorPublicationChannel,
	updateRealtorMarketingCampaign,
	upsertRealtorPublicationChannel,
} from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import { useProfessionalToasts } from '../../ProfessionalToast';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import {
	findUniqueDealForPropertyId,
	resolveListingCommunicationFocus,
} from '../../realtorLogic';
import type {
	ProfessionalDeal,
	RealtorMarketingCampaign,
	RealtorProperty,
	RealtorPublicationChannel,
} from '../../types';

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

function formatMarketingStatusLabel(
	t: RealtorPanelTranslate,
	status: string | null | undefined
): string {
	const normalized = status?.trim() || 'draft';
	return translateRealtorValue(
		t,
		`realtorPro.marketing.statuses.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

function formatPublicationChannelLabel(
	t: RealtorPanelTranslate,
	channelKey: string
): string {
	return translateRealtorValue(
		t,
		`realtorPro.marketing.publicationChannelNames.${channelKey}`,
		t('realtorPro.marketing.publicationChannelCustom', {
			channel: humanizeRealtorIdentifier(channelKey),
		})
	);
}

function formatPublicationStatusLabel(
	t: RealtorPanelTranslate,
	status: string
): string {
	return translateRealtorValue(
		t,
		`realtorPro.marketing.publicationStatuses.${status}`,
		formatUnknownRealtorValue(t, status)
	);
}

function PanelStatus({
	error,
	loading,
}: {
	error: string | null;
	loading: boolean;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);

	if (loading) {
		return (
			<span className="text-xs text-(--desktop-text-muted)">
				{t('realtorPro.loading')}
			</span>
		);
	}
	if (error) {
		return (
			<ProfessionalWorldsStatusBanner kind="error" className="max-w-md">
				{error}
			</ProfessionalWorldsStatusBanner>
		);
	}
	return null;
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

function useListingCrmBridge(
	snapshot: RuntimeModulePanelProps['snapshot'],
	propertyId: string
) {
	return useMemo(() => {
		const selectedProperty =
			snapshot.properties.find((property) => property.id === propertyId) ??
			null;
		const uniqueDeal = propertyId
			? findUniqueDealForPropertyId(
					snapshot.deals,
					snapshot.properties,
					propertyId
				)
			: null;
		return { selectedProperty, uniqueDeal };
	}, [propertyId, snapshot.deals, snapshot.properties]);
}

function ListingCrmBridgeActions({
	property,
	uniqueDeal,
}: {
	property: RealtorProperty | null;
	uniqueDeal: ProfessionalDeal | null;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		openClients,
		openCommunications,
		openPipeline,
		openProperties,
		verticalAddonModules,
	} = useProfessionalWorldsWorkspace();
	const communicationsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_communications'
	);

	if (!property) {
		return null;
	}

	const listingCommunicationFocus = resolveListingCommunicationFocus(
		property.id
	);

	return (
		<>
			<div className="mb-3 flex flex-wrap gap-2">
				<DesktopAppButton
					size="sm"
					variant="ghost"
					onClick={() => openProperties({ propertyId: property.id })}
				>
					{t('realtorPro.documents.openListing')}
				</DesktopAppButton>
				{uniqueDeal ? (
					<DesktopAppButton
						size="sm"
						variant="ghost"
						onClick={() => openPipeline({ dealId: uniqueDeal.id })}
					>
						{t('realtorPro.documents.openDealInPipeline')}
					</DesktopAppButton>
				) : (
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
						{t('realtorPro.documents.createDealForListing')}
					</DesktopAppButton>
				)}
				{communicationsModuleEnabled && listingCommunicationFocus ? (
					<DesktopAppButton
						size="sm"
						variant="ghost"
						onClick={() => openCommunications(listingCommunicationFocus)}
					>
						{t('realtorPro.communications.logCta')}
					</DesktopAppButton>
				) : null}
			</div>
			{uniqueDeal ? (
				<p className="mb-3 text-xs text-(--desktop-text-secondary)">
					{t('realtorPro.documents.linkedDealHint', {
						title: uniqueDeal.title,
					})}
				</p>
			) : null}
		</>
	);
}

function Badge({ children }: { children: string }) {
	return (
		<span className="rounded-full bg-(--desktop-surface-soft-hover) px-2 py-0.5 text-[11px] text-(--desktop-text-secondary)">
			{children}
		</span>
	);
}

const PUBLICATION_CHANNEL_PRESETS = [
	'vk',
	'telegram',
	'avito',
	'cian',
	'site',
] as const;

const PUBLICATION_CHANNEL_STATUSES = [
	'pending',
	'published',
	'failed',
] as const;

export function PublicationChannelsPanel({
	property,
}: {
	property: RealtorProperty | null;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const [channels, setChannels] = useState<RealtorPublicationChannel[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [draftChannelKey, setDraftChannelKey] = useState<string>(
		PUBLICATION_CHANNEL_PRESETS[0]
	);
	const [saving, setSaving] = useState(false);

	const reloadChannels = useCallback(
		async (listingId: string) => {
			if (!listingId) {
				setChannels([]);
				setError(null);
				setLoading(false);
				return;
			}
			setLoading(true);
			setError(null);
			try {
				const rows = await listRealtorPublicationChannels(listingId);
				setChannels(rows);
			} catch (caught: unknown) {
				setChannels([]);
				setError(formatProfessionalWorldsApiError(caught, (key) => t(key)));
			} finally {
				setLoading(false);
			}
		},
		[t]
	);

	useEffect(() => {
		if (!property) {
			setChannels([]);
			return;
		}
		void reloadChannels(property.id);
	}, [property, reloadChannels]);

	async function handleAddChannel() {
		if (!property || !draftChannelKey.trim()) return;
		setSaving(true);
		setError(null);
		try {
			const row = await upsertRealtorPublicationChannel(property.id, {
				channel_key: draftChannelKey.trim(),
				status: 'pending',
			});
			setChannels((current) => [
				row,
				...current.filter((item) => item.channel_key !== row.channel_key),
			]);
			notifySuccess(t('realtorPro.marketing.publicationChannelAddSuccess'));
		} catch (caught: unknown) {
			setError(formatProfessionalWorldsApiError(caught, (key) => t(key)));
			notifyApiError(
				caught,
				t,
				t('realtorPro.marketing.publicationChannelAddFailed')
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleStatusChange(
		channelId: string,
		status: (typeof PUBLICATION_CHANNEL_STATUSES)[number]
	) {
		setError(null);
		try {
			const row = await patchRealtorPublicationChannel(channelId, { status });
			setChannels((current) =>
				current.map((item) => (item.id === row.id ? row : item))
			);
		} catch (caught: unknown) {
			setError(formatProfessionalWorldsApiError(caught, (key) => t(key)));
			notifyApiError(
				caught,
				t,
				t('realtorPro.marketing.publicationChannelStatusFailed')
			);
		}
	}

	return (
		<div className="grid gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<strong className="text-sm">
					{t('realtorPro.marketing.publicationChannelsTitle')}
				</strong>
				<PanelStatus error={error} loading={loading} />
			</div>
			<p className="text-xs text-(--desktop-text-muted)">
				{t('realtorPro.marketing.publicationChannelsHint')}
			</p>
			<div className="flex flex-wrap items-end gap-2">
				<ProfessionalWorldsFormField
					label={t('realtorPro.marketing.publicationChannelKeyLabel')}
				>
					<DesktopNativeSelect
						value={draftChannelKey}
						onChange={(event) => setDraftChannelKey(event.target.value)}
					>
						{PUBLICATION_CHANNEL_PRESETS.map((key) => (
							<option key={key} value={key}>
								{formatPublicationChannelLabel(t, key)}
							</option>
						))}
					</DesktopNativeSelect>
				</ProfessionalWorldsFormField>
				<DesktopAppButton
					size="sm"
					disabled={!property || saving}
					onClick={() => void handleAddChannel()}
				>
					{t('realtorPro.marketing.publicationChannelAdd')}
				</DesktopAppButton>
			</div>
			{!loading && channels.length === 0 ? (
				<p className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.marketing.publicationChannelsEmpty')}
				</p>
			) : (
				<div className="grid gap-2">
					{channels.map((channel) => (
						<article
							key={channel.id}
							className="flex flex-wrap items-center justify-between gap-2 rounded-(--desktop-radius) bg-(--desktop-surface) p-2 text-sm"
						>
							<div>
								<strong>
									{formatPublicationChannelLabel(t, channel.channel_key)}
								</strong>
								<p className="text-xs text-(--desktop-text-secondary)">
									{formatPublicationStatusLabel(t, channel.status)}
								</p>
							</div>
							<DesktopNativeSelect
								value={channel.status}
								onChange={(event) =>
									void handleStatusChange(
										channel.id,
										event.target
											.value as (typeof PUBLICATION_CHANNEL_STATUSES)[number]
									)
								}
								aria-label={t(
									'realtorPro.marketing.publicationChannelStatusAria',
									{ channel: channel.channel_key }
								)}
							>
								{PUBLICATION_CHANNEL_STATUSES.map((status) => (
									<option key={status} value={status}>
										{formatPublicationStatusLabel(t, status)}
									</option>
								))}
							</DesktopNativeSelect>
						</article>
					))}
				</div>
			)}
		</div>
	);
}

export function MarketingCampaignPanel({ snapshot }: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const { selectedPropertyId, setSelectedPropertyId } =
		useProfessionalWorldsWorkspace();
	const [propertyId, setPropertyId] = useState(
		resolvePreferredPropertyId(snapshot, selectedPropertyId)
	);
	const { selectedProperty, uniqueDeal } = useListingCrmBridge(
		snapshot,
		propertyId
	);
	const [{ data: campaigns, error, loading }, setCampaignsState] = useState<
		AsyncState<RealtorMarketingCampaign[]>
	>({
		data: [],
		error: null,
		loading: true,
	});

	const reloadCampaigns = useCallback(
		async (listingId: string) => {
			if (!listingId) {
				setCampaignsState({ data: [], error: null, loading: false });
				return;
			}
			setCampaignsState((current) => ({
				...current,
				error: null,
				loading: true,
			}));
			try {
				const data = await listRealtorMarketingCampaigns({
					propertyId: listingId,
				});
				setCampaignsState({ data, error: null, loading: false });
			} catch (caught: unknown) {
				setCampaignsState({
					data: [],
					error: formatProfessionalWorldsApiError(caught, (key) => t(key)),
					loading: false,
				});
			}
		},
		[t]
	);

	useEffect(() => {
		const preferred = resolvePreferredPropertyId(snapshot, selectedPropertyId);
		if (preferred && preferred !== propertyId) {
			setPropertyId(preferred);
			return;
		}
		void reloadCampaigns(propertyId);
	}, [propertyId, reloadCampaigns, selectedPropertyId, snapshot]);

	const [draftCampaignTitle, setDraftCampaignTitle] = useState('');
	const [draftCampaignStatus, setDraftCampaignStatus] = useState('draft');
	const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
		null
	);
	const [campaignSaving, setCampaignSaving] = useState(false);
	const [campaignFormError, setCampaignFormError] = useState<string | null>(
		null
	);
	const [campaignFormSuccess, setCampaignFormSuccess] = useState<string | null>(
		null
	);

	function beginEditCampaign(campaign: RealtorMarketingCampaign) {
		setEditingCampaignId(campaign.id);
		setDraftCampaignTitle(campaign.title);
		setDraftCampaignStatus(campaign.status || 'draft');
		setCampaignFormError(null);
		setCampaignFormSuccess(null);
	}

	function resetCampaignForm() {
		setEditingCampaignId(null);
		setDraftCampaignTitle('');
		setDraftCampaignStatus('draft');
		setCampaignFormError(null);
		setCampaignFormSuccess(null);
	}

	async function handleSaveCampaign() {
		const title = draftCampaignTitle.trim();
		if (!title || !propertyId) {
			setCampaignFormError(t('realtorPro.marketing.createValidation'));
			setCampaignFormSuccess(null);
			return;
		}
		setCampaignSaving(true);
		setCampaignFormError(null);
		setCampaignFormSuccess(null);
		try {
			if (editingCampaignId) {
				await updateRealtorMarketingCampaign(editingCampaignId, {
					title,
					status: draftCampaignStatus,
				});
				setCampaignFormSuccess(t('realtorPro.marketing.updateSuccess'));
				notifySuccess(t('realtorPro.marketing.updateSuccess'));
			} else {
				await createRealtorMarketingCampaign({
					title,
					property_id: propertyId,
					status: draftCampaignStatus,
				});
				setCampaignFormSuccess(t('realtorPro.marketing.createSuccess'));
				notifySuccess(t('realtorPro.marketing.createSuccess'));
			}
			resetCampaignForm();
			await reloadCampaigns(propertyId);
		} catch (caught: unknown) {
			const message = formatProfessionalWorldsApiError(caught, (key) => t(key));
			setCampaignFormError(message);
			notifyApiError(
				caught,
				t,
				editingCampaignId
					? t('realtorPro.marketing.updateFailed')
					: t('realtorPro.marketing.createFailed')
			);
		} finally {
			setCampaignSaving(false);
		}
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('realtorPro.marketing.title')}
			actions={<PanelStatus error={error} loading={loading} />}
		>
			<ProfessionalWorldsFormField
				label={t('realtorPro.marketing.listingLabel')}
			>
				<DesktopNativeSelect
					value={propertyId}
					onChange={(event) => {
						setPropertyId(event.target.value);
						setSelectedPropertyId(event.target.value || null);
					}}
				>
					{snapshot.properties.map((property) => (
						<option key={property.id} value={property.id}>
							{property.title}
						</option>
					))}
				</DesktopNativeSelect>
			</ProfessionalWorldsFormField>
			<ListingCrmBridgeActions
				property={selectedProperty}
				uniqueDeal={uniqueDeal}
			/>
			<div className="mb-4 grid gap-3 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) p-3">
				<strong className="text-sm">
					{editingCampaignId
						? t('realtorPro.marketing.updateTitle')
						: t('realtorPro.marketing.createTitle')}
				</strong>
				<p className="text-xs text-(--desktop-text-muted)">
					{editingCampaignId
						? t('realtorPro.marketing.updateHint')
						: t('realtorPro.marketing.createHint')}
				</p>
				<div className="grid gap-2 sm:grid-cols-2">
					<ProfessionalWorldsFormField
						label={t('realtorPro.marketing.createTitleLabel')}
					>
						<DesktopAppInput
							value={draftCampaignTitle}
							onChange={(event) => setDraftCampaignTitle(event.target.value)}
							placeholder={t('realtorPro.marketing.createTitlePlaceholder')}
							aria-label={t('realtorPro.marketing.createTitleLabel')}
						/>
					</ProfessionalWorldsFormField>
					<ProfessionalWorldsFormField
						label={t('realtorPro.marketing.createStatusLabel')}
					>
						<DesktopNativeSelect
							value={draftCampaignStatus}
							onChange={(event) => setDraftCampaignStatus(event.target.value)}
							aria-label={t('realtorPro.marketing.createStatusLabel')}
						>
							<option value="draft">
								{t('realtorPro.marketing.statusDraft')}
							</option>
							<option value="active">
								{t('realtorPro.marketing.statusActive')}
							</option>
							<option value="paused">
								{t('realtorPro.marketing.statusPaused')}
							</option>
						</DesktopNativeSelect>
					</ProfessionalWorldsFormField>
				</div>
				{campaignFormError ? (
					<ProfessionalWorldsStatusBanner kind="error" role="alert">
						{campaignFormError}
					</ProfessionalWorldsStatusBanner>
				) : null}
				{campaignFormSuccess ? (
					<ProfessionalWorldsStatusBanner kind="success" role="status">
						{campaignFormSuccess}
					</ProfessionalWorldsStatusBanner>
				) : null}
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						size="sm"
						disabled={campaignSaving || !propertyId}
						onClick={() => void handleSaveCampaign()}
					>
						{campaignSaving
							? t('realtorPro.marketing.createSaving')
							: editingCampaignId
								? t('realtorPro.marketing.updateButton')
								: t('realtorPro.marketing.createButton')}
					</DesktopAppButton>
					{editingCampaignId ? (
						<DesktopAppButton
							size="sm"
							variant="ghost"
							disabled={campaignSaving}
							onClick={resetCampaignForm}
						>
							{t('realtorPro.marketing.cancelEdit')}
						</DesktopAppButton>
					) : null}
				</div>
			</div>
			{!loading && campaigns.length === 0 ? (
				<DesktopAppEmptyState
					title={t('realtorPro.marketing.emptyTitle')}
					description={t('realtorPro.marketing.emptyDescription')}
				/>
			) : (
				<div className="grid gap-2">
					{campaigns.map((campaign) => (
						<article
							key={campaign.id}
							className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm"
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<strong>{campaign.title}</strong>
								<div className="flex flex-wrap items-center gap-2">
									<Badge>
										{formatMarketingStatusLabel(t, campaign.status)}
									</Badge>
									<DesktopAppButton
										size="sm"
										variant="ghost"
										onClick={() => beginEditCampaign(campaign)}
									>
										{t('realtorPro.marketing.editButton')}
									</DesktopAppButton>
								</div>
							</div>
							<p className="mt-1 text-xs text-(--desktop-text-secondary)">
								{t('realtorPro.marketing.channelsPrefix')}{' '}
								{Array.isArray(campaign.channels)
									? campaign.channels
											.map((channel) =>
												formatPublicationChannelLabel(t, String(channel))
											)
											.join(', ') || t('realtorPro.marketing.notSelected')
									: t('realtorPro.marketing.notSelected')}
							</p>
						</article>
					))}
				</div>
			)}
			<PublicationChannelsPanel property={selectedProperty} />
		</ProfessionalWorldsWorkspacePanel>
	);
}
