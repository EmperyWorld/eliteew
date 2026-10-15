/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — companionOperationsProgressUi barrel stays thin and re-exports public API.
 *
 * Invariants:
 * - Barrel path ≤80 LOC; each progressUi child ≤800 LOC.
 * - Key public symbols remain importable from the stable barrel path.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsProgressUi.ts
 * - documentation/product/ewa/EWA-COMPANION-OPERATIONS-PANEL.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	MUSIC_WIZARD_STEP_KINDS,
	WORKFLOW_SUMMARY_FRESH_MS,
	agenticProgressFromRun,
	applyTaskTerminalToOperationRuns,
	companionToolIdLabel,
	deriveTranscriptProgressItems,
	deriveTranscriptWorkflowSummaries,
	extractBackgroundPlayAction,
	extractWorkflowStepArtifacts,
	extractWorkflowStepResultRows,
	mergePolledOperationRuns,
	mergeTaskStepIntoOperationRuns,
	musicPipelineProgressForRun,
	operationCompletedWithoutArtifact,
	operationDetailLabel,
	operationErrorLabel,
	operationImageContentUnavailable,
	operationIntentLabel,
	operationPlayPrompt,
	operationPresentationSummary,
	operationReadyImage,
	operationReadyPresentation,
	operationReadyTrack,
	operationStatusLabel,
	operationStepDisplayTitle,
	operationStepStatusLabel,
	operationTimeLabel,
	resolveOperationImagePreviewUrl,
	resolveWorkflowStepKindLabel,
	resolveWorkflowStepOutputPayload,
	runUsesMusicPipelineProgress,
	userWorkflowProgressForRun,
	workflowStepToolKind,
	workflowStepVisualState,
	appDisplayName,
} from '@/features/ewa/companionOperations/companionOperationsProgressUi';

const PUBLIC_EXPORT_NAMES = [
	'MUSIC_WIZARD_STEP_KINDS',
	'WORKFLOW_SUMMARY_FRESH_MS',
	'agenticProgressFromRun',
	'appDisplayName',
	'applyTaskTerminalToOperationRuns',
	'companionToolIdLabel',
	'deriveTranscriptProgressItems',
	'deriveTranscriptWorkflowSummaries',
	'extractBackgroundPlayAction',
	'extractWorkflowStepArtifacts',
	'extractWorkflowStepResultRows',
	'mergePolledOperationRuns',
	'mergeTaskStepIntoOperationRuns',
	'musicPipelineProgressForRun',
	'operationCompletedWithoutArtifact',
	'operationDetailLabel',
	'operationErrorLabel',
	'operationImageContentUnavailable',
	'operationIntentLabel',
	'operationPlayPrompt',
	'operationPresentationSummary',
	'operationReadyImage',
	'operationReadyPresentation',
	'operationReadyTrack',
	'operationStatusLabel',
	'operationStepDisplayTitle',
	'operationStepStatusLabel',
	'operationTimeLabel',
	'resolveOperationImagePreviewUrl',
	'resolveWorkflowStepKindLabel',
	'resolveWorkflowStepOutputPayload',
	'runUsesMusicPipelineProgress',
	'userWorkflowProgressForRun',
	'workflowStepToolKind',
	'workflowStepVisualState',
] as const;

describe('companionOperationsProgressUi atomization contract', () => {
	it('re-exports key public symbols from the stable barrel path', () => {
		expect(MUSIC_WIZARD_STEP_KINDS).toBeInstanceOf(Set);
		expect(WORKFLOW_SUMMARY_FRESH_MS).toBeGreaterThan(0);
		expect(typeof userWorkflowProgressForRun).toBe('function');
		expect(typeof runUsesMusicPipelineProgress).toBe('function');
		expect(typeof extractBackgroundPlayAction).toBe('function');
		expect(typeof mergePolledOperationRuns).toBe('function');
		expect(typeof musicPipelineProgressForRun).toBe('function');
		expect(typeof resolveOperationImagePreviewUrl).toBe('function');
		expect(typeof operationReadyImage).toBe('function');
		expect(typeof operationImageContentUnavailable).toBe('function');
		expect(typeof operationPresentationSummary).toBe('function');
		expect(typeof operationReadyPresentation).toBe('function');
		expect(typeof operationReadyTrack).toBe('function');
		expect(typeof operationCompletedWithoutArtifact).toBe('function');
		expect(typeof operationIntentLabel).toBe('function');
		expect(typeof companionToolIdLabel).toBe('function');
		expect(typeof workflowStepToolKind).toBe('function');
		expect(typeof resolveWorkflowStepKindLabel).toBe('function');
		expect(typeof workflowStepVisualState).toBe('function');
		expect(typeof operationStepDisplayTitle).toBe('function');
		expect(typeof operationStepStatusLabel).toBe('function');
		expect(typeof operationStatusLabel).toBe('function');
		expect(typeof operationTimeLabel).toBe('function');
		expect(typeof appDisplayName).toBe('function');
		expect(typeof operationDetailLabel).toBe('function');
		expect(typeof operationErrorLabel).toBe('function');
		expect(typeof operationPlayPrompt).toBe('function');
		expect(typeof agenticProgressFromRun).toBe('function');
		expect(typeof deriveTranscriptProgressItems).toBe('function');
		expect(typeof resolveWorkflowStepOutputPayload).toBe('function');
		expect(typeof extractWorkflowStepArtifacts).toBe('function');
		expect(typeof extractWorkflowStepResultRows).toBe('function');
		expect(typeof deriveTranscriptWorkflowSummaries).toBe('function');
		expect(typeof mergeTaskStepIntoOperationRuns).toBe('function');
		expect(typeof applyTaskTerminalToOperationRuns).toBe('function');
	});

	it('barrel stays ≤80 LOC and only re-exports progressUi modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const barrelPath = join(dir, '../companionOperationsProgressUi.ts');
		const src = readFileSync(barrelPath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(80);
		expect(src).toContain("progressUi/progressUiTypes'");
		expect(src).toContain("progressUi/musicPipelineProgress'");
		expect(src).toContain("progressUi/readyArtifacts'");
		expect(src).toContain("progressUi/operationLabels'");
		expect(src).toContain("progressUi/transcriptProgress'");
		expect(src).toContain("progressUi/workflowSummary'");
		expect(src).not.toMatch(/export function\s+\w+/);
	});

	it('progressUi child modules stay ≤800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../progressUi');
		for (const name of readdirSync(childDir)) {
			if (!/\.tsx?$/.test(name)) continue;
			const lines = readFileSync(join(childDir, name), 'utf8').split(
				'\n'
			).length;
			expect(lines, name).toBeLessThanOrEqual(800);
		}
	});

	it('snaps the public value export name list from the barrel', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const barrelPath = join(dir, '../companionOperationsProgressUi.ts');
		const src = readFileSync(barrelPath, 'utf8');
		const mentioned = PUBLIC_EXPORT_NAMES.filter((name) =>
			new RegExp(`\\b${name}\\b`).test(src)
		);
		expect(mentioned).toEqual([...PUBLIC_EXPORT_NAMES]);
	});
});
