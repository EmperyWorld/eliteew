/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro documents checklist panel — per-listing document rows, create/update forms, and pipeline deep-links.
 *
 * Invariants:
 * - Prefers workspace `selectedPropertyId` so Object -> Documents keeps listing context.
 * - Checklist rows load via REST per selected property; CRM bridge exposes listing/deal/communications actions.
 *
 * Related:
 * - ../RealtorProPanels.tsx (barrel re-export target)
 * - ./shared.ts
 * - ../../runtimeModuleRegistry.tsx
 */

import { useCallback, useEffect, useState } from 'react';
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
	createRealtorDocument,
	listRealtorDocuments,
	updateRealtorDocument,
} from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import { useProfessionalToasts } from '../../ProfessionalToast';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import { resolveDocumentLinkedDealId } from '../../realtorLogic';
import type { RealtorDocument } from '../../types';

import {
	formatDocumentTypeLabel,
	JsonPreview,
	ListingCrmBridgeActions,
	PanelStatus,
	resolvePreferredPropertyId,
	useListingCrmBridge,
	type AsyncState,
} from './shared';

export function DocumentsPanel({ snapshot }: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const { openPipeline, selectedPropertyId, setSelectedPropertyId } =
		useProfessionalWorldsWorkspace();
	const [propertyId, setPropertyId] = useState(
		resolvePreferredPropertyId(snapshot, selectedPropertyId)
	);
	const { selectedProperty, uniqueDeal } = useListingCrmBridge(
		snapshot,
		propertyId
	);
	const [{ data: documents, error, loading }, setDocumentsState] = useState<
		AsyncState<RealtorDocument[]>
	>({
		data: [],
		error: null,
		loading: true,
	});
	useEffect(() => {
		const preferred = resolvePreferredPropertyId(snapshot, selectedPropertyId);
		if (preferred && preferred !== propertyId) {
			setPropertyId(preferred);
			return;
		}
		if (!propertyId) {
			setDocumentsState({ data: [], error: null, loading: false });
			return;
		}
		let alive = true;
		setDocumentsState((current) => ({
			...current,
			error: null,
			loading: true,
		}));
		listRealtorDocuments({ propertyId })
			.then((data) => {
				if (alive) setDocumentsState({ data, error: null, loading: false });
			})
			.catch((err: unknown) => {
				if (alive) {
					setDocumentsState({
						data: [],
						error: formatProfessionalWorldsApiError(err, (key) => t(key)),
						loading: false,
					});
				}
			});
		return () => {
			alive = false;
		};
	}, [propertyId, selectedPropertyId, snapshot, t]);

	const reloadDocuments = useCallback(async () => {
		if (!propertyId) {
			setDocumentsState({ data: [], error: null, loading: false });
			return;
		}
		setDocumentsState((current) => ({
			...current,
			error: null,
			loading: true,
		}));
		try {
			const data = await listRealtorDocuments({ propertyId });
			setDocumentsState({ data, error: null, loading: false });
		} catch (err: unknown) {
			setDocumentsState({
				data: [],
				error: formatProfessionalWorldsApiError(err, (key) => t(key)),
				loading: false,
			});
		}
	}, [propertyId, t]);

	const [draftDocTitle, setDraftDocTitle] = useState('');
	const [draftDocType, setDraftDocType] = useState('other');
	const [editingDocumentId, setEditingDocumentId] = useState<string | null>(
		null
	);
	const [docSaving, setDocSaving] = useState(false);
	const [docFormError, setDocFormError] = useState<string | null>(null);
	const [docFormSuccess, setDocFormSuccess] = useState<string | null>(null);

	function beginEditDocument(document: RealtorDocument) {
		setEditingDocumentId(document.id);
		setDraftDocTitle(document.title);
		setDraftDocType(document.doc_type || 'other');
		setDocFormError(null);
		setDocFormSuccess(null);
	}

	function resetDocumentForm() {
		setEditingDocumentId(null);
		setDraftDocTitle('');
		setDraftDocType('other');
		setDocFormError(null);
		setDocFormSuccess(null);
	}

	async function handleSaveDocument() {
		const title = draftDocTitle.trim();
		if (!title || !propertyId) {
			setDocFormError(t('realtorPro.documents.createValidation'));
			setDocFormSuccess(null);
			return;
		}
		setDocSaving(true);
		setDocFormError(null);
		setDocFormSuccess(null);
		try {
			if (editingDocumentId) {
				await updateRealtorDocument(editingDocumentId, {
					title,
					doc_type: draftDocType,
				});
				setDocFormSuccess(t('realtorPro.documents.updateSuccess'));
				notifySuccess(t('realtorPro.documents.updateSuccess'));
			} else {
				await createRealtorDocument({
					title,
					property_id: propertyId,
					doc_type: draftDocType,
				});
				setDocFormSuccess(t('realtorPro.documents.createSuccess'));
				notifySuccess(t('realtorPro.documents.createSuccess'));
			}
			resetDocumentForm();
			await reloadDocuments();
		} catch (caught: unknown) {
			const message = formatProfessionalWorldsApiError(caught, (key) => t(key));
			setDocFormError(message);
			notifyApiError(
				caught,
				t,
				editingDocumentId
					? t('realtorPro.documents.updateFailed')
					: t('realtorPro.documents.createFailed')
			);
		} finally {
			setDocSaving(false);
		}
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('realtorPro.documents.title')}
			actions={<PanelStatus error={error} loading={loading} />}
		>
			<ProfessionalWorldsFormField
				label={t('realtorPro.documents.listingLabel')}
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
					{editingDocumentId
						? t('realtorPro.documents.updateTitle')
						: t('realtorPro.documents.createTitle')}
				</strong>
				<p className="text-xs text-(--desktop-text-muted)">
					{editingDocumentId
						? t('realtorPro.documents.updateHint')
						: t('realtorPro.documents.createHint')}
				</p>
				<div className="grid gap-2 sm:grid-cols-2">
					<ProfessionalWorldsFormField
						label={t('realtorPro.documents.createTitleLabel')}
					>
						<DesktopAppInput
							value={draftDocTitle}
							onChange={(event) => setDraftDocTitle(event.target.value)}
							placeholder={t('realtorPro.documents.createTitlePlaceholder')}
							aria-label={t('realtorPro.documents.createTitleLabel')}
						/>
					</ProfessionalWorldsFormField>
					<ProfessionalWorldsFormField
						label={t('realtorPro.documents.createTypeLabel')}
					>
						<DesktopNativeSelect
							value={draftDocType}
							onChange={(event) => setDraftDocType(event.target.value)}
							aria-label={t('realtorPro.documents.createTypeLabel')}
						>
							<option value="identity">
								{t('realtorPro.documents.docTypeIdentity')}
							</option>
							<option value="contract">
								{t('realtorPro.documents.docTypeContract')}
							</option>
							<option value="other">
								{t('realtorPro.documents.docTypeOther')}
							</option>
						</DesktopNativeSelect>
					</ProfessionalWorldsFormField>
				</div>
				{docFormError ? (
					<ProfessionalWorldsStatusBanner kind="error" role="alert">
						{docFormError}
					</ProfessionalWorldsStatusBanner>
				) : null}
				{docFormSuccess ? (
					<ProfessionalWorldsStatusBanner kind="success" role="status">
						{docFormSuccess}
					</ProfessionalWorldsStatusBanner>
				) : null}
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						size="sm"
						disabled={docSaving || !propertyId}
						onClick={() => void handleSaveDocument()}
					>
						{docSaving
							? t('realtorPro.documents.createSaving')
							: editingDocumentId
								? t('realtorPro.documents.updateButton')
								: t('realtorPro.documents.createButton')}
					</DesktopAppButton>
					{editingDocumentId ? (
						<DesktopAppButton
							size="sm"
							variant="ghost"
							disabled={docSaving}
							onClick={resetDocumentForm}
						>
							{t('realtorPro.documents.cancelEdit')}
						</DesktopAppButton>
					) : null}
				</div>
			</div>
			<div className="grid gap-2 md:grid-cols-2">
				{documents.map((document) => {
					const linkedDealId = resolveDocumentLinkedDealId(
						document,
						snapshot.deals,
						snapshot.properties
					);
					return (
						<article
							key={document.id}
							className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm"
						>
							<div className="flex flex-wrap items-start justify-between gap-2">
								<strong>{document.title}</strong>
								<DesktopAppButton
									size="sm"
									variant="ghost"
									onClick={() => beginEditDocument(document)}
								>
									{t('realtorPro.documents.editButton')}
								</DesktopAppButton>
							</div>
							<p className="mt-1 text-xs text-(--desktop-text-secondary)">
								{formatDocumentTypeLabel(t, document.doc_type)} ·{' '}
								{t('realtorPro.documents.slotLabel')}{' '}
								{document.unified_content_id
									? t('realtorPro.documents.slotFilled')
									: t('realtorPro.documents.slotWaiting')}
							</p>
							{linkedDealId ? (
								<div className="mt-2">
									<DesktopAppButton
										size="sm"
										variant="ghost"
										onClick={() => openPipeline({ dealId: linkedDealId })}
									>
										{t('realtorPro.documents.openDealInPipeline')}
									</DesktopAppButton>
								</div>
							) : null}
							<JsonPreview
								value={document.checklist_state}
								summaryKey="realtorPro.documents.checklistSupportDetails"
							/>
						</article>
					);
				})}
			</div>
		</ProfessionalWorldsWorkspacePanel>
	);
}
