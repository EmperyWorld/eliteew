/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable thin barrel for companion operations progress / ready-artifact / label UI helpers.
 *
 * Invariants:
 * - Imports from this path stay source-compatible; implementations live under progressUi/.
 *
 * Related:
 * - src/features/ewa/companionOperations/progressUi/
 * - documentation/product/ewa/EWA-COMPANION-OPERATIONS-PANEL.md
 */

export type {
	MusicPipelineProgress,
	OperationPresentationSummary,
	OperationReadyImage,
	OperationReadyPresentation,
	OperationReadyTrack,
	WorkflowCompletionSummaryItem,
	WorkflowStepArtifact,
	WorkflowStepResultRow,
	WorkflowStepVisualState,
} from '@/features/ewa/companionOperations/progressUi/progressUiTypes';
export { WORKFLOW_SUMMARY_FRESH_MS } from '@/features/ewa/companionOperations/progressUi/progressUiTypes';

export {
	extractBackgroundPlayAction,
	mergePolledOperationRuns,
	MUSIC_WIZARD_STEP_KINDS,
	musicPipelineProgressForRun,
	runUsesMusicPipelineProgress,
	userWorkflowProgressForRun,
} from '@/features/ewa/companionOperations/progressUi/musicPipelineProgress';

export {
	operationCompletedWithoutArtifact,
	operationImageContentUnavailable,
	operationPresentationSummary,
	operationReadyImage,
	operationReadyPresentation,
	operationReadyTrack,
	resolveOperationImagePreviewUrl,
} from '@/features/ewa/companionOperations/progressUi/readyArtifacts';

export {
	appDisplayName,
	companionToolIdLabel,
	operationDetailLabel,
	operationErrorLabel,
	operationIntentLabel,
	operationPlayPrompt,
	operationStatusLabel,
	operationStepDisplayTitle,
	operationStepStatusLabel,
	operationTimeLabel,
	resolveWorkflowStepKindLabel,
	workflowStepToolKind,
	workflowStepVisualState,
} from '@/features/ewa/companionOperations/progressUi/operationLabels';

export {
	agenticProgressFromRun,
	deriveTranscriptProgressItems,
} from '@/features/ewa/companionOperations/progressUi/transcriptProgress';

export {
	applyTaskTerminalToOperationRuns,
	deriveTranscriptWorkflowSummaries,
	extractWorkflowStepArtifacts,
	extractWorkflowStepResultRows,
	mergeTaskStepIntoOperationRuns,
	resolveWorkflowStepOutputPayload,
} from '@/features/ewa/companionOperations/progressUi/workflowSummary';
