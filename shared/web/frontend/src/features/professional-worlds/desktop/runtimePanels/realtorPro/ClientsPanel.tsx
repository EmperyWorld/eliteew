/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro clients addon panel — buyer/seller segments, buyer requirements, and property matcher.
 *
 * Invariants:
 * - Client segments derive from snapshot via `classifyClientSegment`; requirements load via REST.
 * - Buyer matcher ranks properties against requirements and deep-links to clients, listings, and pipeline.
 *
 * Related:
 * - ../RealtorProPanels.tsx (barrel re-export target)
 * - ../../runtimeModuleRegistry.tsx
 * - ./shared.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';

import {
	createRealtorBuyerRequirement,
	listRealtorBuyerRequirements,
} from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import { useProfessionalToasts } from '../../ProfessionalToast';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import {
	classifyClientSegment,
	rankBuyerPropertyMatches,
	resolveBuyerMatchLinkedDealId,
} from '../../realtorLogic';
import type { RealtorBuyerRequirement } from '../../types';

import { PanelStatus, type AsyncState } from './shared';

export function ClientsPanel({ snapshot }: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const { openClients, openPipeline, openProperties } =
		useProfessionalWorldsWorkspace();
	const [segment, setSegment] = useState<'buyer' | 'seller'>('buyer');
	const [{ data: requirements, error, loading }, setRequirementsState] =
		useState<AsyncState<RealtorBuyerRequirement[]>>({
			data: [],
			error: null,
			loading: true,
		});

	const reloadRequirements = useCallback(async () => {
		setRequirementsState((current) => ({
			...current,
			error: null,
			loading: true,
		}));
		try {
			const data = await listRealtorBuyerRequirements();
			setRequirementsState({ data, error: null, loading: false });
		} catch (caught: unknown) {
			setRequirementsState({
				data: [],
				error: formatProfessionalWorldsApiError(caught, (key) => t(key)),
				loading: false,
			});
		}
	}, [t]);

	useEffect(() => {
		void reloadRequirements();
	}, [reloadRequirements]);

	const buyerClients = useMemo(
		() =>
			snapshot.clients.filter(
				(client) => classifyClientSegment(client) === 'buyer'
			),
		[snapshot.clients]
	);
	const [draftRequirementTitle, setDraftRequirementTitle] = useState('');
	const [draftRequirementClientId, setDraftRequirementClientId] = useState('');
	const [requirementSaving, setRequirementSaving] = useState(false);
	const [requirementFormError, setRequirementFormError] = useState<
		string | null
	>(null);
	const [requirementFormSuccess, setRequirementFormSuccess] = useState<
		string | null
	>(null);

	async function handleCreateBuyerRequirement() {
		const title = draftRequirementTitle.trim();
		if (!title) {
			setRequirementFormError(t('realtorPro.clients.requirementValidation'));
			setRequirementFormSuccess(null);
			return;
		}
		setRequirementSaving(true);
		setRequirementFormError(null);
		setRequirementFormSuccess(null);
		try {
			await createRealtorBuyerRequirement({
				title,
				...(draftRequirementClientId
					? { client_id: draftRequirementClientId }
					: {}),
			});
			setDraftRequirementTitle('');
			setRequirementFormSuccess(t('realtorPro.clients.requirementSaveSuccess'));
			notifySuccess(t('realtorPro.clients.requirementSaveSuccess'));
			await reloadRequirements();
		} catch (caught: unknown) {
			const message = formatProfessionalWorldsApiError(caught, (key) => t(key));
			setRequirementFormError(message);
			notifyApiError(caught, t, t('realtorPro.clients.requirementSaveFailed'));
		} finally {
			setRequirementSaving(false);
		}
	}

	const clients = snapshot.clients.filter(
		(client) => classifyClientSegment(client) === segment
	);
	const topMatches = useMemo(
		() => rankBuyerPropertyMatches(requirements, snapshot.properties),
		[requirements, snapshot.properties]
	);

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('realtorPro.clients.sectionLabel')}
			actions={
				<>
					<PanelStatus error={error} loading={loading} />
					<DesktopNativeSelect
						aria-label={t('realtorPro.clients.segmentAria')}
						value={segment}
						onChange={(event) =>
							setSegment(event.target.value as typeof segment)
						}
						className="w-40"
					>
						<option value="buyer">{t('realtorPro.clients.buyers')}</option>
						<option value="seller">{t('realtorPro.clients.sellers')}</option>
					</DesktopNativeSelect>
				</>
			}
		>
			<div className="mb-3">
				<DesktopAppButton
					size="sm"
					variant="ghost"
					onClick={() => openClients({ tab: 'directory' })}
				>
					{t('realtorPro.clients.openClientsDirectory')}
				</DesktopAppButton>
			</div>
			<div className="grid gap-2 md:grid-cols-2">
				{clients.map((client) => (
					<article
						key={client.id}
						className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm"
					>
						<strong>{client.name}</strong>
						<p className="mt-1 text-xs text-(--desktop-text-secondary)">
							{client.need_summary ??
								client.next_action ??
								t('realtorPro.clients.needsDiscovery')}
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							<DesktopAppButton
								size="sm"
								variant="ghost"
								onClick={() =>
									openClients({
										tab: 'directory',
										filterClientId: client.id,
									})
								}
							>
								{t('realtorPro.clients.openClientDirectory')}
							</DesktopAppButton>
							<DesktopAppButton
								size="sm"
								variant="ghost"
								onClick={() =>
									openClients({
										tab: 'capture',
										dealClientId: client.id,
									})
								}
							>
								{t('realtorPro.clients.createDealForClient')}
							</DesktopAppButton>
						</div>
					</article>
				))}
			</div>
			{segment === 'buyer' ? (
				<div className="mb-4 grid gap-3 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) p-3">
					<strong className="text-sm">
						{t('realtorPro.clients.requirementCreateTitle')}
					</strong>
					<p className="text-xs text-(--desktop-text-muted)">
						{t('realtorPro.clients.requirementCreateHint')}
					</p>
					<div className="grid gap-2 sm:grid-cols-2">
						<ProfessionalWorldsFormField
							label={t('realtorPro.clients.requirementTitleLabel')}
						>
							<DesktopAppInput
								value={draftRequirementTitle}
								onChange={(event) =>
									setDraftRequirementTitle(event.target.value)
								}
								placeholder={t(
									'realtorPro.clients.requirementTitlePlaceholder'
								)}
								aria-label={t('realtorPro.clients.requirementTitleLabel')}
							/>
						</ProfessionalWorldsFormField>
						<ProfessionalWorldsFormField
							label={t('realtorPro.clients.requirementClientLabel')}
						>
							<DesktopNativeSelect
								value={draftRequirementClientId}
								onChange={(event) =>
									setDraftRequirementClientId(event.target.value)
								}
								aria-label={t('realtorPro.clients.requirementClientLabel')}
							>
								<option value="">
									{t('realtorPro.clients.requirementClientNone')}
								</option>
								{buyerClients.map((client) => (
									<option key={client.id} value={client.id}>
										{client.name}
									</option>
								))}
							</DesktopNativeSelect>
						</ProfessionalWorldsFormField>
					</div>
					{requirementFormError ? (
						<ProfessionalWorldsStatusBanner kind="error" role="alert">
							{requirementFormError}
						</ProfessionalWorldsStatusBanner>
					) : null}
					{requirementFormSuccess ? (
						<ProfessionalWorldsStatusBanner kind="success" role="status">
							{requirementFormSuccess}
						</ProfessionalWorldsStatusBanner>
					) : null}
					<div>
						<DesktopAppButton
							size="sm"
							disabled={requirementSaving}
							onClick={() => void handleCreateBuyerRequirement()}
						>
							{requirementSaving
								? t('realtorPro.clients.requirementSaving')
								: t('realtorPro.clients.requirementCreateButton')}
						</DesktopAppButton>
					</div>
				</div>
			) : null}
			<div className="grid gap-2 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) p-3">
				<strong className="text-sm">
					{t('realtorPro.clients.matcherTitle')}
				</strong>
				{topMatches.length === 0 ? (
					<p className="text-xs text-(--desktop-text-muted)">
						{t('realtorPro.clients.matcherEmpty')}
					</p>
				) : (
					topMatches.map((match) => {
						const linkedDealId = resolveBuyerMatchLinkedDealId(
							match.requirement,
							match.property.id,
							snapshot.deals,
							snapshot.properties
						);
						return (
							<article
								key={`${match.requirement.id}-${match.property.id}`}
								className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm"
							>
								<p className="text-xs text-(--desktop-text-secondary)">
									{match.requirement.title} → {match.property.title}:{' '}
									{match.score}%
								</p>
								<div className="mt-2 flex flex-wrap gap-2">
									<DesktopAppButton
										size="sm"
										variant="ghost"
										onClick={() =>
											openProperties({ propertyId: match.property.id })
										}
									>
										{t('realtorPro.documents.openListing')}
									</DesktopAppButton>
									{match.requirement.client_id ? (
										<DesktopAppButton
											size="sm"
											variant="ghost"
											onClick={() =>
												openClients({
													tab: 'directory',
													filterClientId: match.requirement.client_id,
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
											{t('realtorPro.documents.openDealInPipeline')}
										</DesktopAppButton>
									) : null}
								</div>
							</article>
						);
					})
				)}
			</div>
		</ProfessionalWorldsWorkspacePanel>
	);
}
