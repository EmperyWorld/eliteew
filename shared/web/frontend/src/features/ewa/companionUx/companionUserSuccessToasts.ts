/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing success toast copy for companion operations (U3.10) — plain language, no stack terms.
 *
 * Invariants:
 * - Returns null when the run is not a celebratory completed outcome worth a toast.
 * - Subtitle uses track name / prompt preview when available; never raw intent_kind ids in UI.
 *
 * Related:
 * - src/features/ewa/companionOperations/useCompanionOperationRuns.ts
 * - documentation/product/ewa/EWA-COMPANION-USER-UX-MAP.md §U3.10
 */

import type { TFunction } from 'i18next';

import {
	operationReadyImage,
	operationReadyPresentation,
	operationReadyTrack,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

export type CompanionUserSuccessToast = {
	title: string;
	message?: string;
};

export function resolveCompanionOperationCompletedToast(
	run: EwaCompanionTaskRun,
	t: TFunction<'marketing', undefined>
): CompanionUserSuccessToast | null {
	const status = (run.status || '').trim().toLowerCase();
	if (status !== 'completed') return null;

	const track = operationReadyTrack(run);
	if (track) {
		return {
			title: t('ewaCompanion.userToast.musicReadyTitle'),
			message: track.trackName
				? t('ewaCompanion.userToast.musicReadyMessage', {
						name: track.trackName,
					})
				: undefined,
		};
	}

	const image = operationReadyImage(run);
	if (image) {
		return {
			title: t('ewaCompanion.userToast.imageReadyTitle'),
			message: image.promptPreview
				? t('ewaCompanion.userToast.imageReadyMessage', {
						hint: image.promptPreview,
					})
				: undefined,
		};
	}

	const presentation = operationReadyPresentation(run);
	if (presentation) {
		return {
			title: t('ewaCompanion.userToast.presentationReadyTitle'),
			message: presentation.title
				? t('ewaCompanion.userToast.presentationReadyMessage', {
						title: presentation.title,
					})
				: undefined,
		};
	}

	const intent = (run.intent_kind || '').trim().toLowerCase();
	if (intent.includes('workflow') || intent === 'action_workflow') {
		return {
			title: t('ewaCompanion.userToast.workflowReadyTitle'),
		};
	}

	return {
		title: t('ewaCompanion.userToast.taskReadyTitle'),
	};
}
