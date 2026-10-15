/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Orchestrates realtor objects/listing workspace panels (Wave 2b split shell).
 *
 * Invariants:
 * - Rendered only when `verticalSupportsListingWorkspace` is true (parent gates nav).
 * - Panel modules read bindings from `RealtorObjectsPanelProvider` only.
 *
 * Related:
 * - ../RealtorObjectsWorkspacePanel.tsx
 * - hooks/useRealtorObjectsWorkspace.ts
 */

import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	ProfessionalWorldsHeroPanel,
	ProfessionalWorldsProgressRail,
	ProfessionalWorldsTrustNote,
	ProfessionalWorldsWorkspaceSection,
	ProfessionalWorldsWorkspaceSubtabs,
} from '../../layout';
import { PROFESSIONAL_WORLDS_FIELD_CLASS } from '../../utils/professionalWorldsFormUtils';
import { resolveListingCommunicationFocus } from '../../realtorLogic';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import { ProfessionalWorldsDeleteAction } from '../../components/ProfessionalWorldsDeleteAction';
import { deleteRealtorProperty } from '../../api';
import { removePropertyFromSnapshot } from '../../professionalWorldsSnapshotUtils';
import { useProfessionalToasts } from '../../ProfessionalToast';
import { useListingPrimaryUnifiedContentIds } from '../../hooks/useListingPrimaryUnifiedContentIds';
import { buildRealtorObjectsWorkspaceHost } from '../../hooks/useRealtorObjectsWorkspaceHost';
import { useRealtorObjectsWorkspace } from '../../hooks/useRealtorObjectsWorkspace';

import { ObjectIntakePanel } from './ObjectIntakePanel';
import { SavedListingsPanel } from './SavedListingsPanel';
import { ListingWorkspacePanel } from './ListingWorkspacePanel';
import { RealtorObjectsMobilePanel } from './RealtorObjectsMobilePanel';
import { LISTING_MEDIA_SECTION_ID } from './shared';
import {
	RealtorObjectsPanelProvider,
	type RealtorObjectsPanelVm,
} from './panelVm';

export function RealtorObjectsWorkspaceShell() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const listingMediaFieldIdPrefix = useId();
	const batchTargetAlbumSelectId = `${listingMediaFieldIdPrefix}-batch-album`;
	const workspace = useProfessionalWorldsWorkspace();
	const host = buildRealtorObjectsWorkspaceHost(workspace, t);
	const ws = useRealtorObjectsWorkspace(host);
	const propertyIdsForCovers = useMemo(
		() => workspace.snapshot.properties.map((property) => property.id),
		[workspace.snapshot.properties]
	);
	const eagerListingCoverIds = useMemo(
		() => (workspace.selectedPropertyId ? [workspace.selectedPropertyId] : []),
		[workspace.selectedPropertyId]
	);
	const fieldClassName = PROFESSIONAL_WORLDS_FIELD_CLASS;
	const {
		propertyDraft,
		setPropertyDraft,
		infrastructureCsv,
		setInfrastructureCsv,
		tone,
		setTone,
		mediaPickerItems,
		setMediaPickerItems,
		listingMediaRefreshAt,
		setListingMediaRefreshAt,
	} = ws;

	const {
		coverStates: listingCoverStatesByPropertyId,
		registerListingCoverInterest,
		selectedCoverPending,
	} = useListingPrimaryUnifiedContentIds(
		propertyIdsForCovers,
		listingMediaRefreshAt,
		eagerListingCoverIds
	);
	const workspaceListingThumbPending = selectedCoverPending(
		workspace.selectedPropertyId
	);

	const {
		uploadEnhanceInputRef,
		mediaPipelineBusy,
		uploadProgressRows,
		listingAlbums,
		batchTargetAlbumId,
		setBatchTargetAlbumId,
		objectIntakeText,
		setObjectIntakeText,
		objectIntakePreview,
		photoPresetKey,
		setPhotoPresetKey,
		photoInstruction,
		setPhotoInstruction,
		uploadWithoutProcessing,
		setUploadWithoutProcessing,
		propertiesWorkspaceTab,
		setPropertiesWorkspaceTab,
		lastCreatedProperty,
		clearLastCreatedProperty,
		handleCreateProperty,
		handleUpdateSelectedProperty,
		handleStream,
		handleObjectIntake,
		handleCommitObjectIntake,
		handleMultiPhotoUploadEnhance,
		handleMediaLibraryBatch,
		resetPropertyDraft,
		saving,
	} = ws;

	const {
		snapshot,
		selectedProperty,
		selectedPropertyId,
		setSelectedPropertyId,
		patchSnapshot,
		resolvedPhotoPresets,
		mediaStudioEnabled,
		setLaneStatus,
		openClients,
		openCommunications,
		openProfessionTool,
		verticalAddonModules,
		embeddedMobileLayout,
		propertiesWorkspaceFocus,
		consumePropertiesWorkspaceFocus,
	} = workspace;
	const communicationsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_communications'
	);
	const showingsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_showings'
	);
	const documentsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_documents'
	);
	const marketingModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_marketing'
	);
	const insightsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_insights'
	);
	const selectedListingCommunicationFocus = selectedProperty
		? resolveListingCommunicationFocus(selectedProperty.id)
		: null;
	const { notifySuccess, notifyApiError } = useProfessionalToasts();
	const [propertyDeleteTarget, setPropertyDeleteTarget] = useState<{
		id: string;
		title: string;
	} | null>(null);

	const handleDeleteProperty = useCallback(async () => {
		if (!propertyDeleteTarget) return;
		try {
			await deleteRealtorProperty(propertyDeleteTarget.id);
			patchSnapshot((current) =>
				removePropertyFromSnapshot(current, propertyDeleteTarget.id)
			);
			if (selectedPropertyId === propertyDeleteTarget.id) {
				setSelectedPropertyId(null);
				setPropertiesWorkspaceTab('savedListings');
			}
			notifySuccess(t('properties.deleteSuccess'));
			setPropertyDeleteTarget(null);
		} catch (caught: unknown) {
			notifyApiError(caught, t, t('properties.deleteFailed'));
			throw caught instanceof Error
				? caught
				: new Error(t('properties.deleteFailed'));
		}
	}, [
		notifyApiError,
		notifySuccess,
		patchSnapshot,
		propertyDeleteTarget,
		selectedPropertyId,
		setPropertiesWorkspaceTab,
		setSelectedPropertyId,
		t,
	]);

	useEffect(() => {
		if (!propertiesWorkspaceFocus) {
			return;
		}
		if (propertiesWorkspaceFocus.tab) {
			setPropertiesWorkspaceTab(propertiesWorkspaceFocus.tab);
		}
		if (propertiesWorkspaceFocus.focusMedia) {
			const scrollTarget = () => {
				document
					.getElementById(LISTING_MEDIA_SECTION_ID)
					?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			};
			window.requestAnimationFrame(scrollTarget);
		}
		consumePropertiesWorkspaceFocus();
	}, [
		consumePropertiesWorkspaceFocus,
		propertiesWorkspaceFocus,
		setPropertiesWorkspaceTab,
	]);

	useEffect(() => {
		if (!embeddedMobileLayout) {
			return;
		}
		if (uploadWithoutProcessing) {
			return;
		}
		setUploadWithoutProcessing(true);
	}, [
		embeddedMobileLayout,
		setUploadWithoutProcessing,
		uploadWithoutProcessing,
	]);

	const listingCount = snapshot.properties.length;
	const hasListings = listingCount > 0;
	const heroCopy = useMemo(() => {
		if (!hasListings) {
			return {
				title: t('properties.visible.emptyTitle'),
				description: t('properties.visible.emptyDescription'),
			};
		}
		if (propertiesWorkspaceTab === 'listingWorkspace') {
			if (selectedProperty) {
				return {
					title: t('properties.visible.activeTitle'),
					description: t('properties.visible.activeDescription'),
				};
			}
			return {
				title: t('properties.visible.needsListingTitle'),
				description: t('properties.visible.needsListingDescription'),
			};
		}
		return {
			title: t('properties.visible.portfolioTitle'),
			description: t('properties.visible.portfolioDescription'),
		};
	}, [hasListings, propertiesWorkspaceTab, selectedProperty, t]);
	const progressItems = useMemo(
		() => [
			{
				id: 'listings',
				label: t('properties.visible.progressListings'),
				value: hasListings
					? String(listingCount)
					: t('properties.visible.progressTodo'),
				complete: hasListings,
			},
			{
				id: 'selected',
				label: t('properties.visible.progressSelected'),
				value: selectedProperty
					? selectedProperty.title
					: t('properties.visible.progressPickOne'),
				complete: Boolean(selectedProperty),
			},
		],
		[hasListings, listingCount, selectedProperty, t]
	);
	const heroPrimaryAction = useMemo(() => {
		if (propertiesWorkspaceTab === 'newDraft') {
			if (!hasListings) {
				return undefined;
			}
			return {
				label: t('properties.visible.actions.openSaved'),
				onClick: () => setPropertiesWorkspaceTab('savedListings'),
			};
		}
		if (propertiesWorkspaceTab === 'savedListings') {
			return {
				label: t('properties.visible.actions.addListing'),
				onClick: () => setPropertiesWorkspaceTab('newDraft'),
			};
		}
		if (!selectedProperty) {
			return {
				label: t('properties.visible.actions.openSaved'),
				onClick: () => setPropertiesWorkspaceTab('savedListings'),
			};
		}
		return {
			label: t('properties.visible.actions.addPhotos'),
			onClick: () => {
				document
					.getElementById(LISTING_MEDIA_SECTION_ID)
					?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			},
		};
	}, [
		hasListings,
		propertiesWorkspaceTab,
		selectedProperty,
		setPropertiesWorkspaceTab,
		t,
	]);

	const panelVm: RealtorObjectsPanelVm = {
		t,
		fieldClassName,
		batchTargetAlbumSelectId,
		workspace,
		propertyDraft,
		setPropertyDraft,
		infrastructureCsv,
		setInfrastructureCsv,
		tone,
		setTone,
		mediaPickerItems,
		setMediaPickerItems,
		listingMediaRefreshAt,
		setListingMediaRefreshAt,
		listingCoverStatesByPropertyId,
		registerListingCoverInterest,
		workspaceListingThumbPending,
		uploadEnhanceInputRef,
		mediaPipelineBusy,
		uploadProgressRows,
		listingAlbums,
		batchTargetAlbumId,
		setBatchTargetAlbumId,
		objectIntakeText,
		setObjectIntakeText,
		objectIntakePreview,
		photoPresetKey,
		setPhotoPresetKey,
		photoInstruction,
		setPhotoInstruction,
		uploadWithoutProcessing,
		setUploadWithoutProcessing,
		propertiesWorkspaceTab,
		setPropertiesWorkspaceTab,
		lastCreatedProperty,
		clearLastCreatedProperty,
		handleCreateProperty,
		handleUpdateSelectedProperty,
		handleStream,
		handleObjectIntake,
		handleCommitObjectIntake,
		handleMultiPhotoUploadEnhance,
		handleMediaLibraryBatch,
		resetPropertyDraft,
		saving,
		snapshot,
		selectedProperty,
		selectedPropertyId,
		setSelectedPropertyId,
		resolvedPhotoPresets,
		mediaStudioEnabled,
		setLaneStatus,
		openClients,
		openCommunications,
		openProfessionTool,
		embeddedMobileLayout,
		communicationsModuleEnabled,
		showingsModuleEnabled,
		documentsModuleEnabled,
		marketingModuleEnabled,
		insightsModuleEnabled,
		selectedListingCommunicationFocus,
		setPropertyDeleteTarget,
	};

	if (embeddedMobileLayout) {
		return (
			<RealtorObjectsPanelProvider value={panelVm}>
				<RealtorObjectsMobilePanel />
			</RealtorObjectsPanelProvider>
		);
	}

	return (
		<RealtorObjectsPanelProvider value={panelVm}>
			<ProfessionalWorldsWorkspaceSection
				subtabs={
					<ProfessionalWorldsWorkspaceSubtabs
						active={propertiesWorkspaceTab}
						ariaLabel={t('properties.workspaceAria')}
						items={[
							{
								id: 'newDraft',
								label: t('properties.workspaceTabs.newDraft'),
							},
							{
								id: 'savedListings',
								label: t('properties.workspaceTabs.savedListings'),
							},
							{
								id: 'listingWorkspace',
								label: t('properties.workspaceTabs.listingWorkspace'),
							},
						]}
						onSelect={(id) =>
							setPropertiesWorkspaceTab(
								id as 'newDraft' | 'savedListings' | 'listingWorkspace'
							)
						}
					/>
				}
			>
				<ProfessionalWorldsHeroPanel
					eyebrow={t('properties.visible.eyebrow')}
					title={heroCopy.title}
					description={heroCopy.description}
					primaryAction={
						heroPrimaryAction ? (
							<DesktopAppButton
								type="button"
								onClick={heroPrimaryAction.onClick}
							>
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
				<ProfessionalWorldsTrustNote title={t('properties.visible.trustTitle')}>
					{t('properties.visible.trustBody')}
				</ProfessionalWorldsTrustNote>
				{propertiesWorkspaceTab === 'newDraft' && <ObjectIntakePanel />}
				{propertiesWorkspaceTab === 'savedListings' && <SavedListingsPanel />}
				{propertiesWorkspaceTab === 'listingWorkspace' && !selectedProperty ? (
					<DesktopAppEmptyState
						description={t('properties.workspaceNeedsListing')}
						title={t('properties.workspaceNeedsListingTitle')}
					>
						<DesktopAppButton
							onClick={() => setPropertiesWorkspaceTab('savedListings')}
						>
							{t('properties.workspaceOpenListings')}
						</DesktopAppButton>
					</DesktopAppEmptyState>
				) : null}
				{propertiesWorkspaceTab === 'listingWorkspace' && selectedProperty ? (
					<ListingWorkspacePanel />
				) : null}
				<ProfessionalWorldsDeleteAction
					isOpen={propertyDeleteTarget !== null}
					onClose={() => setPropertyDeleteTarget(null)}
					onConfirm={handleDeleteProperty}
					title={t('properties.deleteTitle')}
					itemName={propertyDeleteTarget?.title}
					warningMessage={t('properties.deleteWarning')}
					confirmButtonLabel={t('properties.deleteAction')}
				/>
			</ProfessionalWorldsWorkspaceSection>
		</RealtorObjectsPanelProvider>
	);
}
