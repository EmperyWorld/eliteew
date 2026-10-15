/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro seller onboarding panel — seller context profiles and client directory bridge.
 *
 * Invariants:
 * - Seller clients are derived from snapshot via `classifyClientSegment`; profiles load via REST.
 * - Create/update forms require at least one non-empty seller_context field.
 *
 * Related:
 * - ../RealtorProPanels.tsx (barrel re-export target)
 * - ../../runtimeModuleRegistry.tsx
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { SupportDetailsPanel } from '../../components/SupportDetailsPanel';
import {
	createRealtorSellerProfile,
	listRealtorSellerProfiles,
	updateRealtorSellerProfile,
} from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import { useProfessionalToasts } from '../../ProfessionalToast';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import { classifyClientSegment } from '../../realtorLogic';
import type { RealtorSellerProfile } from '../../types';
import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTextarea,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';

type AsyncState<T> = {
	data: T;
	error: string | null;
	loading: boolean;
};

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

function JsonPreview({
	value,
	summaryKey = 'shared.supportDetails',
}: {
	value: Record<string, unknown> | undefined;
	summaryKey?: string;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	if (!value || Object.keys(value).length === 0) {
		return null;
	}
	return (
		<SupportDetailsPanel summary={t(summaryKey)}>
			<pre className="max-h-40 overflow-auto rounded-(--desktop-radius) bg-black/20 p-2 text-[11px] text-(--desktop-text-secondary)">
				{JSON.stringify(value, null, 2)}
			</pre>
		</SupportDetailsPanel>
	);
}

function readSellerContextField(
	context: Record<string, unknown> | null | undefined,
	key: string
): string {
	const value = context?.[key];
	return typeof value === 'string' ? value : '';
}

export function SellerOnboardingPanel({ snapshot }: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const { openClients } = useProfessionalWorldsWorkspace();
	const sellerClients = useMemo(
		() =>
			snapshot.clients.filter(
				(client) => classifyClientSegment(client) === 'seller'
			),
		[snapshot.clients]
	);
	const [motivation, setMotivation] = useState('');
	const [valuationExpectation, setValuationExpectation] = useState('');
	const [readiness, setReadiness] = useState('');
	const [createBusy, setCreateBusy] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
	const [updateBusy, setUpdateBusy] = useState(false);
	const [{ data: profiles, error, loading }, setProfilesState] = useState<
		AsyncState<RealtorSellerProfile[]>
	>({
		data: [],
		error: null,
		loading: true,
	});

	const reloadProfiles = useCallback(async () => {
		setProfilesState((current) => ({ ...current, error: null, loading: true }));
		try {
			const data = await listRealtorSellerProfiles();
			setProfilesState({ data, error: null, loading: false });
		} catch (err: unknown) {
			setProfilesState({
				data: [],
				error: formatProfessionalWorldsApiError(err, (key) => t(key)),
				loading: false,
			});
		}
	}, [t]);

	useEffect(() => {
		void reloadProfiles();
	}, [reloadProfiles]);

	const resetSellerForm = useCallback(() => {
		setEditingProfileId(null);
		setMotivation('');
		setValuationExpectation('');
		setReadiness('');
		setCreateError(null);
	}, []);

	const handleCreateProfile = useCallback(async () => {
		setCreateBusy(true);
		setCreateError(null);
		try {
			await createRealtorSellerProfile({
				seller_context: {
					motivation: motivation.trim(),
					valuation_expectation: valuationExpectation.trim(),
					readiness: readiness.trim(),
				},
			});
			resetSellerForm();
			await reloadProfiles();
			notifySuccess(t('realtorPro.sellerOnboarding.createSuccess'));
		} catch (err: unknown) {
			setCreateError(formatProfessionalWorldsApiError(err, (key) => t(key)));
			notifyApiError(err, t, t('realtorPro.sellerOnboarding.createFailed'));
		} finally {
			setCreateBusy(false);
		}
	}, [
		motivation,
		notifyApiError,
		notifySuccess,
		readiness,
		reloadProfiles,
		resetSellerForm,
		valuationExpectation,
		t,
	]);

	const beginEditSellerProfile = useCallback(
		(profile: RealtorSellerProfile) => {
			setEditingProfileId(profile.id);
			setMotivation(
				readSellerContextField(profile.seller_context, 'motivation')
			);
			setValuationExpectation(
				readSellerContextField(profile.seller_context, 'valuation_expectation')
			);
			setReadiness(readSellerContextField(profile.seller_context, 'readiness'));
			setCreateError(null);
		},
		[]
	);

	const handleUpdateProfile = useCallback(async () => {
		if (!editingProfileId) return;
		setUpdateBusy(true);
		setCreateError(null);
		try {
			await updateRealtorSellerProfile(editingProfileId, {
				seller_context: {
					motivation: motivation.trim(),
					valuation_expectation: valuationExpectation.trim(),
					readiness: readiness.trim(),
				},
			});
			resetSellerForm();
			await reloadProfiles();
			notifySuccess(t('realtorPro.sellerOnboarding.updateSuccess'));
		} catch (err: unknown) {
			setCreateError(formatProfessionalWorldsApiError(err, (key) => t(key)));
			notifyApiError(err, t, t('realtorPro.sellerOnboarding.updateFailed'));
		} finally {
			setUpdateBusy(false);
		}
	}, [
		editingProfileId,
		motivation,
		notifyApiError,
		notifySuccess,
		readiness,
		reloadProfiles,
		resetSellerForm,
		valuationExpectation,
		t,
	]);

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('realtorPro.sellerOnboarding.title')}
			actions={<PanelStatus error={error} loading={loading} />}
		>
			{sellerClients.length > 0 ? (
				<div className="mb-4 grid gap-2 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) p-3">
					<strong className="text-sm">
						{t('realtorPro.sellerOnboarding.sellerClientsTitle')}
					</strong>
					<p className="text-xs text-(--desktop-text-muted)">
						{t('realtorPro.sellerOnboarding.sellerClientsHint')}
					</p>
					<div className="grid gap-2">
						{sellerClients.map((client) => (
							<article
								key={client.id}
								className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm"
							>
								<strong>{client.name}</strong>
								<div className="mt-2">
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
										{t('realtorPro.sellerOnboarding.openClientDirectory')}
									</DesktopAppButton>
								</div>
							</article>
						))}
					</div>
				</div>
			) : null}
			<div className="mb-4 grid gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-3">
				<strong className="text-sm">
					{editingProfileId
						? t('realtorPro.sellerOnboarding.editTitle')
						: t('realtorPro.sellerOnboarding.createTitle')}
				</strong>
				{createError ? (
					<ProfessionalWorldsStatusBanner kind="error" role="alert">
						{createError}
					</ProfessionalWorldsStatusBanner>
				) : null}
				<ProfessionalWorldsFormField
					label={t('realtorPro.sellerOnboarding.motivationLabel')}
				>
					<ProfessionalWorldsTextarea
						value={motivation}
						onChange={(event) => setMotivation(event.target.value)}
						placeholder={t('realtorPro.sellerOnboarding.motivationPlaceholder')}
					/>
				</ProfessionalWorldsFormField>
				<ProfessionalWorldsFormField
					label={t('realtorPro.sellerOnboarding.valuationLabel')}
				>
					<ProfessionalWorldsTextarea
						value={valuationExpectation}
						onChange={(event) => setValuationExpectation(event.target.value)}
						placeholder={t('realtorPro.sellerOnboarding.valuationPlaceholder')}
					/>
				</ProfessionalWorldsFormField>
				<ProfessionalWorldsFormField
					label={t('realtorPro.sellerOnboarding.readinessLabel')}
				>
					<ProfessionalWorldsTextarea
						value={readiness}
						onChange={(event) => setReadiness(event.target.value)}
						placeholder={t('realtorPro.sellerOnboarding.readinessPlaceholder')}
					/>
				</ProfessionalWorldsFormField>
				<DesktopAppButton
					disabled={
						createBusy ||
						updateBusy ||
						(!motivation.trim() &&
							!valuationExpectation.trim() &&
							!readiness.trim())
					}
					onClick={() =>
						void (editingProfileId
							? handleUpdateProfile()
							: handleCreateProfile())
					}
				>
					{editingProfileId
						? t('realtorPro.sellerOnboarding.saveChangesButton')
						: t('realtorPro.sellerOnboarding.createButton')}
				</DesktopAppButton>
				{editingProfileId ? (
					<DesktopAppButton
						variant="ghost"
						disabled={createBusy || updateBusy}
						onClick={resetSellerForm}
					>
						{t('realtorPro.sellerOnboarding.cancelEditButton')}
					</DesktopAppButton>
				) : null}
			</div>
			{profiles.length === 0 ? (
				<DesktopAppEmptyState
					title={t('realtorPro.sellerOnboarding.emptyTitle')}
					description={t('realtorPro.sellerOnboarding.emptyDescription')}
				/>
			) : (
				profiles.map((profile) => (
					<article
						key={profile.id}
						className="grid gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm"
					>
						<strong>{t('realtorPro.sellerOnboarding.contextHeading')}</strong>
						<JsonPreview
							value={profile.seller_context}
							summaryKey="realtorPro.sellerOnboarding.contextSupportDetails"
						/>
						<div className="flex flex-wrap gap-2">
							<DesktopAppButton
								size="sm"
								variant="ghost"
								onClick={() => beginEditSellerProfile(profile)}
							>
								{t('realtorPro.sellerOnboarding.editProfile')}
							</DesktopAppButton>
							{profile.client_id ? (
								<div>
									<DesktopAppButton
										size="sm"
										variant="ghost"
										onClick={() =>
											openClients({
												tab: 'directory',
												filterClientId: profile.client_id,
											})
										}
									>
										{t('realtorPro.sellerOnboarding.openClientDirectory')}
									</DesktopAppButton>
								</div>
							) : null}
						</div>
					</article>
				))
			)}
		</ProfessionalWorldsWorkspacePanel>
	);
}
