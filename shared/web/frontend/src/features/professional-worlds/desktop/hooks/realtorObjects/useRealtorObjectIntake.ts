/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Object intake parse/commit flow for the realtor new-draft workspace tab.
 *
 * Invariants:
 * - Intake preview fills draft fields only; commit persists via dedicated API.
 *
 * Related:
 * - useRealtorObjectsWorkspace.ts
 * - runtimePanels/realtorObjects/ObjectIntakePanel.tsx
 */

import { useCallback, useState } from 'react';

import { commitObjectIntake, streamObjectIntakeParse } from '../../api';
import { createEmptyRealtorProperty } from '../../realtorLogic';
import { upsertPropertyInSnapshot } from '../../professionalWorldsSnapshotUtils';
import type { ObjectIntakePreview, RealtorPropertyCreate } from '../../types';
import type { Dispatch, SetStateAction } from 'react';

import type {
	RealtorObjectIntakeState,
	UseRealtorObjectsWorkspaceArgs,
} from './types';

type UseRealtorObjectIntakeArgs = Pick<
	UseRealtorObjectsWorkspaceArgs,
	| 'patchSnapshot'
	| 'setLaneStatus'
	| 'setSaving'
	| 'setSelectedPropertyId'
	| 't'
> & {
	setPropertyDraft: Dispatch<SetStateAction<RealtorPropertyCreate>>;
	setInfrastructureCsv: Dispatch<SetStateAction<string>>;
};

export function useRealtorObjectIntake({
	patchSnapshot,
	setLaneStatus,
	setSaving,
	setSelectedPropertyId,
	setPropertyDraft,
	setInfrastructureCsv,
	t,
}: UseRealtorObjectIntakeArgs): RealtorObjectIntakeState {
	const [objectIntakeText, setObjectIntakeText] = useState('');
	const [objectIntakePreview, setObjectIntakePreview] =
		useState<ObjectIntakePreview | null>(null);

	const handleObjectIntake = useCallback(async () => {
		if (!objectIntakeText.trim()) return;
		setObjectIntakePreview(null);
		setLaneStatus('listing', t('stream.starting'));
		await streamObjectIntakeParse(objectIntakeText, {
			onStarted: (requestId) =>
				setLaneStatus('listing', `${t('stream.started')} ${requestId}`),
			onProgress: (message) => setLaneStatus('listing', message),
			onPreview: (preview) => {
				setObjectIntakePreview(preview);
				setPropertyDraft({
					...createEmptyRealtorProperty(),
					...preview.property,
				});
				setInfrastructureCsv(preview.property.infrastructure?.join(', ') ?? '');
				const needsReview =
					preview.intake_diagnostics?.intake_fallback === true;
				setLaneStatus(
					'listing',
					needsReview
						? t('properties.intakeStreamDoneReview')
						: t('properties.intakeStreamDone')
				);
			},
			onError: (message) =>
				setLaneStatus('listing', `${t('stream.error')}: ${message}`),
		});
	}, [
		objectIntakeText,
		setInfrastructureCsv,
		setLaneStatus,
		setPropertyDraft,
		t,
	]);

	const handleCommitObjectIntake = useCallback(async () => {
		if (!objectIntakePreview) return;
		setSaving(true);
		try {
			const committed = await commitObjectIntake(
				objectIntakePreview.job_id,
				Object.keys(objectIntakePreview.property)
			);
			setObjectIntakePreview(null);
			setObjectIntakeText('');
			setSelectedPropertyId(committed.id);
			patchSnapshot((current) => upsertPropertyInSnapshot(current, committed));
			setLaneStatus('listing', t('properties.intakeCommitted'));
		} finally {
			setSaving(false);
		}
	}, [
		objectIntakePreview,
		patchSnapshot,
		setLaneStatus,
		setSelectedPropertyId,
		setSaving,
		t,
	]);

	return {
		objectIntakeText,
		setObjectIntakeText,
		objectIntakePreview,
		setObjectIntakePreview,
		handleObjectIntake,
		handleCommitObjectIntake,
	};
}
