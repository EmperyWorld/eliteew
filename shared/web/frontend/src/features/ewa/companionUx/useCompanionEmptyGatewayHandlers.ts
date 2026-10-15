/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns empty-transcript gateway handlers for tools, workflows, missions, media, and documents.
 *
 * Invariants:
 * - Starter actions seed the existing composer instead of creating a parallel submit path.
 * - Media gateway opens the existing tools catalog after drafting its starter prompt.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionTranscriptEmptyState.tsx
 * - src/features/ewa/companionUx/useCompanionChatTranscriptBundle.tsx
 */

import type { TFunction } from 'i18next';
import { useCallback } from 'react';

import type { CompanionChatOrchestrationBaseResult } from '@/features/ewa/companionUx/useCompanionChatOrchestrationBase';

export type UseCompanionEmptyGatewayHandlersInput = Pick<
	CompanionChatOrchestrationBaseResult,
	| 'openToolsCatalogRef'
	| 'handleOutputSurfaceChange'
	| 'updateDraft'
	| 'inputRef'
> & {
	t: TFunction<'marketing'>;
};

export function useCompanionEmptyGatewayHandlers({
	openToolsCatalogRef,
	handleOutputSurfaceChange,
	updateDraft,
	inputRef,
	t,
}: UseCompanionEmptyGatewayHandlersInput) {
	const handleOpenTools = useCallback(
		() => openToolsCatalogRef.current(),
		[openToolsCatalogRef]
	);
	const handleOpenWorkflows = useCallback(
		() => handleOutputSurfaceChange({ mode: 'workflow_edit' }),
		[handleOutputSurfaceChange]
	);
	const handleChooseEmptyMissionPrompt = useCallback(
		(promptText: string) => {
			updateDraft(promptText);
			inputRef.current?.focus({ preventScroll: true });
		},
		[inputRef, updateDraft]
	);
	const handleGatewayStartAgentic = useCallback(() => {
		handleChooseEmptyMissionPrompt(
			t(
				'ewaCompanion.gatewayAgenticStarter',
				'Plan and execute a multi-step agentic task for my current goal. Keep progress visible in this workspace.'
			)
		);
	}, [handleChooseEmptyMissionPrompt, t]);
	const handleGatewayCreateMedia = useCallback(() => {
		handleChooseEmptyMissionPrompt(
			t(
				'ewaCompanion.gatewayMediaStarter',
				'Create media for my goal and keep the result in this workspace (preview here first).'
			)
		);
		openToolsCatalogRef.current();
	}, [handleChooseEmptyMissionPrompt, openToolsCatalogRef, t]);
	const handleGatewayAccessDocuments = useCallback(() => {
		handleChooseEmptyMissionPrompt(
			t(
				'ewaCompanion.gatewayDocumentsStarter',
				'List my documents and open the most relevant one in this companion window.'
			)
		);
	}, [handleChooseEmptyMissionPrompt, t]);

	return {
		handleOpenTools,
		handleOpenWorkflows,
		handleChooseEmptyMissionPrompt,
		handleGatewayStartAgentic,
		handleGatewayCreateMedia,
		handleGatewayAccessDocuments,
	};
}
