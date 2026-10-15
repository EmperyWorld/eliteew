/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dual-stream analytical pipeline: Stream A (sync fast stats) + Stream B
 * (async getHTML oracle with generation gate and reconciliation).
 *
 * Invariants:
 * - generation_id stale abort before/after getHTML unchanged.
 * - Oracle reconciles fast running totals; mismatch triggers hard reset via callback.
 *
 * Related:
 * - `utils/docEditorEditGeneration.ts`, `utils/docEditorIncrementalStats.ts`
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

import type {
	DocEditorEditGeneration,
	DocEditorGenerationController,
} from './docEditorEditGeneration';
import type { DocEditorRunningStats } from './docEditorIncrementalStats';
import { countWordsFromHtml } from './htmlWordCount';

export interface DocEditorEditorHtmlSource {
	getHTML(): string;
	isDestroyed?: boolean;
	getDoc?: () => ProseMirrorNode | null;
}

export interface DocEditorAnalyticalReconciliation {
	mismatch: boolean;
	fastStats: DocEditorRunningStats;
	oracleStats: DocEditorRunningStats;
}

export interface DocEditorAnalyticalCommit {
	html: string;
	generation: DocEditorEditGeneration;
	stats: DocEditorRunningStats;
	reconciliation?: DocEditorAnalyticalReconciliation;
}

export interface DocEditorAnalyticalPipelineOptions {
	generation: DocEditorGenerationController;
	debounceMs?: number;
	idleTimeoutMs?: number;
	getFastStats?: () => DocEditorRunningStats;
	onCommit: (commit: DocEditorAnalyticalCommit) => void;
	onStaleJobDiscarded?: (
		jobGeneration: DocEditorEditGeneration,
		currentGeneration: DocEditorEditGeneration
	) => void;
	reconcileOracle?: (input: {
		oracle: DocEditorRunningStats;
		editor: DocEditorEditorHtmlSource;
	}) => DocEditorRunningStats;
}

export interface DocEditorAnalyticalPipeline {
	scheduleFromEditor(editor: DocEditorEditorHtmlSource): void;
	flushSyncFromEditor(
		editor: DocEditorEditorHtmlSource
	): DocEditorAnalyticalCommit | null;
	cancelPending(): void;
}

const DEFAULT_DEBOUNCE_MS = 240;
const DEFAULT_IDLE_TIMEOUT_MS = 2000;

type IdleRequestCallback = (deadline: { didTimeout: boolean }) => void;

function scheduleIdleWork(
	callback: IdleRequestCallback,
	timeoutMs: number
): () => void {
	if (
		typeof globalThis.window !== 'undefined' &&
		'requestIdleCallback' in globalThis.window
	) {
		const handle = globalThis.window.requestIdleCallback(callback, {
			timeout: timeoutMs,
		});
		return () => globalThis.window.cancelIdleCallback(handle);
	}
	const handle = globalThis.setTimeout(() => callback({ didTimeout: true }), 0);
	return () => globalThis.clearTimeout(handle);
}

function buildOracleStats(html: string): DocEditorRunningStats {
	return countWordsFromHtml(html);
}

export function createDocEditorAnalyticalPipeline(
	options: DocEditorAnalyticalPipelineOptions
): DocEditorAnalyticalPipeline {
	const {
		generation,
		debounceMs = DEFAULT_DEBOUNCE_MS,
		idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
		getFastStats,
		onCommit,
		onStaleJobDiscarded,
		reconcileOracle,
	} = options;

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let cancelIdle: (() => void) | null = null;
	let pendingEditor: DocEditorEditorHtmlSource | null = null;
	let scheduledGeneration: DocEditorEditGeneration = generation.current;

	const readFastStats = (): DocEditorRunningStats =>
		getFastStats?.() ?? { words: 0, characters: 0 };

	const cancelPending = (): void => {
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		if (cancelIdle !== null) {
			cancelIdle();
			cancelIdle = null;
		}
		pendingEditor = null;
	};

	const discardIfStale = (jobGeneration: DocEditorEditGeneration): boolean => {
		if (!generation.isStale(jobGeneration)) {
			return false;
		}
		onStaleJobDiscarded?.(jobGeneration, generation.current);
		return true;
	};

	const finalizeCommit = (
		editor: DocEditorEditorHtmlSource,
		html: string,
		jobGeneration: DocEditorEditGeneration
	): DocEditorAnalyticalCommit => {
		const oracleStats = buildOracleStats(html);
		let stats = oracleStats;
		let reconciliation: DocEditorAnalyticalReconciliation | undefined;

		if (reconcileOracle) {
			const fastStats = readFastStats();
			const reconciled = reconcileOracle({ oracle: oracleStats, editor });
			const mismatch =
				reconciled.words !== fastStats.words ||
				reconciled.characters !== fastStats.characters;
			stats = reconciled;
			reconciliation = {
				mismatch,
				fastStats,
				oracleStats,
			};
		}

		return { html, generation: jobGeneration, stats, reconciliation };
	};

	const runHeavyJob = (
		editor: DocEditorEditorHtmlSource,
		jobGeneration: DocEditorEditGeneration
	): void => {
		if (editor.isDestroyed) {
			return;
		}
		if (discardIfStale(jobGeneration)) {
			return;
		}

		const html = editor.getHTML();

		if (editor.isDestroyed || discardIfStale(jobGeneration)) {
			return;
		}
		if (html === '' && editor.getDoc?.() == null) {
			return;
		}

		onCommit(finalizeCommit(editor, html, jobGeneration));
	};

	const scheduleHeavyJob = (
		editor: DocEditorEditorHtmlSource,
		jobGeneration: DocEditorEditGeneration
	): void => {
		cancelIdle?.();
		cancelIdle = scheduleIdleWork(() => {
			cancelIdle = null;
			runHeavyJob(editor, jobGeneration);
		}, idleTimeoutMs);
	};

	const flushDebounce = (): void => {
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		const editor = pendingEditor;
		const jobGeneration = scheduledGeneration;
		pendingEditor = null;
		if (!editor) {
			return;
		}
		scheduleHeavyJob(editor, jobGeneration);
	};

	return {
		scheduleFromEditor(editor) {
			if (editor.isDestroyed) {
				return;
			}
			pendingEditor = editor;
			scheduledGeneration = generation.current;
			if (debounceTimer !== null) {
				clearTimeout(debounceTimer);
			}
			debounceTimer = setTimeout(flushDebounce, debounceMs);
		},

		flushSyncFromEditor(editor) {
			if (editor.isDestroyed) {
				return null;
			}
			cancelPending();
			const jobGeneration = generation.current;
			if (discardIfStale(jobGeneration)) {
				return null;
			}
			const html = editor.getHTML();
			if (editor.isDestroyed || discardIfStale(jobGeneration)) {
				return null;
			}
			if (html === '' && editor.getDoc?.() == null) {
				return null;
			}
			const commit = finalizeCommit(editor, html, jobGeneration);
			onCommit(commit);
			return commit;
		},

		cancelPending,
	};
}

export function createPipelineFastStatsBinding(): {
	setFastStats: (stats: DocEditorRunningStats) => void;
	getFastStats: () => DocEditorRunningStats;
} {
	let fastStats: DocEditorRunningStats = { words: 0, characters: 0 };
	return {
		setFastStats(stats) {
			fastStats = { ...stats };
		},
		getFastStats() {
			return { ...fastStats };
		},
	};
}
