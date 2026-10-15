/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types and constants for companion operations progress / ready-artifact UI.
 *
 * Invariants:
 * - Type shapes stay source-compatible with the former companionOperationsProgressUi god-file.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsProgressUi.ts
 * - src/features/ewa/companionOperations/progressUi/
 */

export type MusicPipelineProgress = {
	current: number;
	total: number;
	title: string;
};

export type OperationReadyTrack = {
	unifiedContentId: string;
	trackName: string;
	thumbnailUrl: string | null;
};

export type OperationReadyImage = {
	unifiedContentId: string;
	promptPreview: string;
	previewUrl: string;
	downloadFilename: string;
	mimeType: string | null;
	mode: 'generate' | 'edit';
	sourceUnifiedContentId: string | null;
};

export type OperationReadyPresentation = {
	jobId: string;
	title: string;
	topic: string;
	numSlides: number | null;
	slidesCount: number | null;
	presentationTheme: string | null;
	pdfUrl: string | null;
	pdfDownloadToken: string | null;
};

export type OperationPresentationSummary = Omit<
	OperationReadyPresentation,
	'jobId'
> & {
	jobId: string | null;
	progress: number;
	ready: boolean;
};

export type WorkflowStepVisualState =
	| 'pending'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled';

/** How long completed workflow summaries stay pinned in the chat transcript. */
export const WORKFLOW_SUMMARY_FRESH_MS = 30 * 60 * 1000;

export type WorkflowStepArtifact =
	| {
			kind: 'image';
			stepIndex: number;
			label: string;
			unifiedContentId: string;
			promptPreview: string;
			previewUrl: string;
	  }
	| {
			kind: 'music';
			stepIndex: number;
			label: string;
			unifiedContentId: string;
			trackName: string;
			thumbnailUrl: string | null;
	  }
	| {
			kind: 'file';
			stepIndex: number;
			label: string;
			fileName: string;
			unifiedContentId: string | null;
	  }
	| {
			kind: 'catalog';
			stepIndex: number;
			label: string;
			rowCount: number;
			fileNames: string[];
	  }
	| {
			kind: 'text';
			stepIndex: number;
			label: string;
			toolKind: string;
			body: string;
	  }
	| {
			kind: 'presentation';
			stepIndex: number;
			label: string;
			jobId: string;
			title: string;
			topic: string;
	  }
	| {
			kind: 'plan';
			stepIndex: number;
			label: string;
			planId: string;
			body: string;
	  };

export type WorkflowStepResultRow = {
	stepIndex: number;
	label: string;
	toolKind: string;
	status: WorkflowStepVisualState;
	text: string | null;
	errorMessage: string | null;
	artifact: WorkflowStepArtifact | null;
};

export type WorkflowCompletionSummaryItem = {
	runId: string;
	title: string;
	completedAtMs: number;
	failed: boolean;
	artifacts: WorkflowStepArtifact[];
	stepResults: WorkflowStepResultRow[];
};
