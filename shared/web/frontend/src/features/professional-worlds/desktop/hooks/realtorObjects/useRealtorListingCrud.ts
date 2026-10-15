/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Listing draft, tab navigation, create/update, and AI stream handlers for realtor objects workspace.
 *
 * Invariants:
 * - Selected property changes sync draft fields from snapshot; no silent auto-save.
 *
 * Related:
 * - useRealtorObjectsWorkspace.ts
 * - runtimePanels/realtorObjects/
 */

import { useCallback, useEffect, useState } from 'react';

import {
	createRealtorProperty,
	streamPropertyContentPack,
	streamPropertyDescription,
	updateRealtorProperty,
} from '../../api';
import {
	buildRealtorPropertyPatchPayload,
	createEmptyRealtorProperty,
	normalizeCsvList,
	realtorPropertyToCreateDraft,
	resolveDefaultRealtorPropertyCity,
	selectRecipeKey,
} from '../../realtorLogic';
import {
	prependPropertyToSnapshot,
	upsertPropertyInSnapshot,
} from '../../professionalWorldsSnapshotUtils';
import { createIdempotencyKey } from '../../utils/professionalWorldsFormUtils';
import type { ProfessionalArtifact, RealtorGenerationTone } from '../../types';

import type {
	PropertiesWorkspaceTab,
	RealtorListingCrudState,
	UseRealtorObjectsWorkspaceArgs,
} from './types';

export function useRealtorListingCrud({
	snapshot,
	selectedPropertyId: _selectedPropertyId,
	setSelectedPropertyId,
	selectedProperty,
	saving: _saving,
	setSaving,
	addArtifactToSnapshot,
	patchSnapshot,
	setLaneText,
	setLaneStatus,
	t,
}: UseRealtorObjectsWorkspaceArgs): RealtorListingCrudState {
	const defaultPropertyCity = resolveDefaultRealtorPropertyCity(
		snapshot.profile
	);
	const createFreshPropertyDraft = useCallback(
		() => createEmptyRealtorProperty({ city: defaultPropertyCity }),
		[defaultPropertyCity]
	);
	const [propertyDraft, setPropertyDraft] = useState(() =>
		createEmptyRealtorProperty({ city: defaultPropertyCity })
	);
	const [infrastructureCsv, setInfrastructureCsv] = useState('');
	const [tone, setTone] = useState<RealtorGenerationTone>('jtbd');
	const [propertiesWorkspaceTab, setPropertiesWorkspaceTab] =
		useState<PropertiesWorkspaceTab>('savedListings');
	const [lastCreatedProperty, setLastCreatedProperty] = useState<{
		id: string;
		title: string;
	} | null>(null);

	useEffect(() => {
		if (!selectedProperty) return;
		setPropertyDraft(realtorPropertyToCreateDraft(selectedProperty));
		setInfrastructureCsv(selectedProperty.infrastructure?.join(', ') ?? '');
	}, [selectedProperty]);

	const handleCreateProperty = useCallback(async () => {
		setSaving(true);
		try {
			const payload = {
				...propertyDraft,
				infrastructure: normalizeCsvList(infrastructureCsv),
			};
			const created = await createRealtorProperty(payload);
			setPropertyDraft(createFreshPropertyDraft());
			setInfrastructureCsv('');
			setSelectedPropertyId(created.id);
			setLastCreatedProperty({ id: created.id, title: created.title });
			patchSnapshot((current) => prependPropertyToSnapshot(current, created));
		} finally {
			setSaving(false);
		}
	}, [
		createFreshPropertyDraft,
		infrastructureCsv,
		patchSnapshot,
		propertyDraft,
		setSaving,
		setSelectedPropertyId,
	]);

	const clearLastCreatedProperty = useCallback(() => {
		setLastCreatedProperty(null);
	}, []);

	const handleUpdateSelectedProperty = useCallback(async () => {
		if (!selectedProperty) return;
		setSaving(true);
		try {
			const patchBody = buildRealtorPropertyPatchPayload(
				propertyDraft,
				infrastructureCsv
			);
			const updated = await updateRealtorProperty(
				selectedProperty.id,
				patchBody
			);
			patchSnapshot((current) => upsertPropertyInSnapshot(current, updated));
		} finally {
			setSaving(false);
		}
	}, [
		infrastructureCsv,
		patchSnapshot,
		propertyDraft,
		selectedProperty,
		setSaving,
	]);

	const handleStream = useCallback(
		async (kind: 'description' | 'contentPack') => {
			if (!selectedProperty) return;
			setLaneText('listing', '');
			setLaneStatus('listing', t('stream.starting'));
			const callbacks = {
				onStarted: (requestId: string) =>
					setLaneStatus('listing', `${t('stream.started')} ${requestId}`),
				onProgress: (message: string) => setLaneStatus('listing', message),
				onResult: (text: string, artifact?: ProfessionalArtifact) => {
					setLaneText('listing', text);
					addArtifactToSnapshot(artifact);
					setLaneStatus('listing', t('stream.done'));
				},
				onError: (message: string) =>
					setLaneStatus('listing', `${t('stream.error')}: ${message}`),
			};
			const payload = {
				tone,
				idempotency_key: createIdempotencyKey(selectRecipeKey(kind)),
			};
			if (kind === 'contentPack') {
				await streamPropertyContentPack(
					selectedProperty.id,
					payload,
					callbacks
				);
			} else {
				await streamPropertyDescription(
					selectedProperty.id,
					payload,
					callbacks
				);
			}
		},
		[
			addArtifactToSnapshot,
			selectedProperty,
			setLaneStatus,
			setLaneText,
			t,
			tone,
		]
	);

	return {
		propertyDraft,
		setPropertyDraft,
		resetPropertyDraft: createFreshPropertyDraft,
		infrastructureCsv,
		setInfrastructureCsv,
		tone,
		setTone,
		propertiesWorkspaceTab,
		setPropertiesWorkspaceTab,
		lastCreatedProperty,
		clearLastCreatedProperty,
		handleCreateProperty,
		handleUpdateSelectedProperty,
		handleStream,
	};
}
