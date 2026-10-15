/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O(Δ) running word/character totals for Ultimate Doc Editor via ProseMirror
 * top-level block deltas. Oracle (full HTML scan) reconciles on heavy path.
 *
 * Invariants:
 * - Fast path measures only top-level blocks touched by ReplaceStep ranges.
 * - Block cache realigns on oracle mismatch (self-healing hard reset).
 * - Complex nodes / non-replace steps defer to oracle recommendation.
 *
 * Related:
 * - `utils/docEditorAnalyticalPipeline.ts`, `utils/htmlWordCount.ts`
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';

import { countWordsFromPlainText } from './htmlWordCount';

export interface DocEditorRunningStats {
	words: number;
	characters: number;
}

interface BlockWeight {
	words: number;
	characters: number;
}

export interface DocEditorIncrementalApplyResult {
	stats: DocEditorRunningStats;
	deltaApplied: boolean;
	recommendOracle: boolean;
}

export interface DocEditorOracleReconcileResult {
	stats: DocEditorRunningStats;
	mismatch: boolean;
}

const COMPLEX_TOP_LEVEL_TYPES = new Set([
	'table',
	'image',
	'horizontalRule',
	'codeBlock',
	'video',
	'iframe',
]);

/** Blocks touched above this hint immediate oracle reconciliation. */
export const INCREMENTAL_ORACLE_HINT_BLOCK_THRESHOLD = 12;

export function measureBlockPlainStats(node: ProseMirrorNode): BlockWeight {
	const text = node.textContent.replace(/\u00a0/g, ' ');
	const normalized = text.replace(/\s+/g, ' ').trim();
	return {
		words: countWordsFromPlainText(normalized),
		characters: normalized.length,
	};
}

export function sumTopLevelBlockStats(
	doc: ProseMirrorNode
): DocEditorRunningStats {
	let words = 0;
	let characters = 0;
	for (let i = 0; i < doc.content.childCount; i += 1) {
		const block = measureBlockPlainStats(doc.content.child(i));
		words += block.words;
		characters += block.characters;
	}
	return { words, characters };
}

function posBeforeTopLevelChild(doc: ProseMirrorNode, index: number): number {
	let pos = 1;
	for (let i = 0; i < index; i += 1) {
		pos += doc.content.child(i).nodeSize;
	}
	return pos;
}

function getTopLevelChildRange(
	doc: ProseMirrorNode,
	index: number
): { from: number; to: number } {
	const from = posBeforeTopLevelChild(doc, index);
	const node = doc.content.child(index);
	return { from, to: from + node.nodeSize };
}

export function collectTopLevelBlockIndicesInRange(
	doc: ProseMirrorNode,
	from: number,
	to: number
): number[] {
	const indices: number[] = [];
	const clampedFrom = Math.max(1, Math.min(from, doc.content.size));
	const clampedTo = Math.max(clampedFrom, Math.min(to, doc.content.size));

	for (let i = 0; i < doc.content.childCount; i += 1) {
		const range = getTopLevelChildRange(doc, i);
		if (range.from < clampedTo && range.to > clampedFrom) {
			indices.push(i);
		}
	}
	return indices;
}

function docHasComplexTopLevelNode(doc: ProseMirrorNode): boolean {
	for (let i = 0; i < doc.content.childCount; i += 1) {
		if (COMPLEX_TOP_LEVEL_TYPES.has(doc.content.child(i).type.name)) {
			return true;
		}
	}
	return false;
}

function collectAffectedIndicesFromTransaction(transaction: Transaction): {
	oldIndices: Set<number>;
	newIndices: Set<number>;
	recommendOracle: boolean;
} {
	const oldIndices = new Set<number>();
	const newIndices = new Set<number>();
	let recommendOracle = false;

	let stepDoc = transaction.before;
	for (const step of transaction.steps) {
		if (!(step instanceof ReplaceStep)) {
			return { oldIndices, newIndices, recommendOracle: true };
		}

		for (const idx of collectTopLevelBlockIndicesInRange(
			stepDoc,
			step.from,
			step.to
		)) {
			oldIndices.add(idx);
		}

		const applied = step.apply(stepDoc);
		if (!applied.doc) {
			return { oldIndices, newIndices, recommendOracle: true };
		}
		stepDoc = applied.doc;

		const insertEnd = step.from + step.slice.size;
		for (const idx of collectTopLevelBlockIndicesInRange(
			stepDoc,
			step.from,
			Math.max(step.from + 1, insertEnd)
		)) {
			newIndices.add(idx);
		}

		if (
			step.from <= 1 &&
			step.to >= transaction.before.content.size - 1 &&
			step.slice.size > 0
		) {
			recommendOracle = true;
		}
	}

	for (const idx of collectTopLevelBlockIndicesInRange(
		transaction.doc,
		1,
		transaction.doc.content.size
	)) {
		if (oldIndices.has(idx) || newIndices.has(idx)) {
			newIndices.add(idx);
		}
	}

	if (
		oldIndices.size + newIndices.size >
		INCREMENTAL_ORACLE_HINT_BLOCK_THRESHOLD
	) {
		recommendOracle = true;
	}

	return { oldIndices, newIndices, recommendOracle };
}

export class DocEditorIncrementalStatsEngine {
	private blockWeights: BlockWeight[] = [];
	private running: DocEditorRunningStats = { words: 0, characters: 0 };

	resetFromDoc(doc: ProseMirrorNode): DocEditorRunningStats {
		this.blockWeights = [];
		for (let i = 0; i < doc.content.childCount; i += 1) {
			this.blockWeights.push(measureBlockPlainStats(doc.content.child(i)));
		}
		this.running = this.sumBlockWeights();
		return { ...this.running };
	}

	resetFromOracle(stats: DocEditorRunningStats): DocEditorRunningStats {
		this.running = { ...stats };
		this.blockWeights = [];
		return { ...this.running };
	}

	getRunningTotals(): DocEditorRunningStats {
		return { ...this.running };
	}

	applyTransaction(transaction: Transaction): DocEditorIncrementalApplyResult {
		if (!transaction.docChanged) {
			return {
				stats: this.getRunningTotals(),
				deltaApplied: false,
				recommendOracle: false,
			};
		}

		const oldDoc = transaction.before;
		const newDoc = transaction.doc;

		if (
			docHasComplexTopLevelNode(oldDoc) ||
			docHasComplexTopLevelNode(newDoc)
		) {
			return {
				stats: this.getRunningTotals(),
				deltaApplied: false,
				recommendOracle: true,
			};
		}

		if (this.blockWeights.length !== oldDoc.content.childCount) {
			const stats = this.resetFromDoc(oldDoc);
			return { stats, deltaApplied: true, recommendOracle: false };
		}

		const { oldIndices, newIndices, recommendOracle } =
			collectAffectedIndicesFromTransaction(transaction);

		if (oldIndices.size === 0 && newIndices.size === 0) {
			return {
				stats: this.getRunningTotals(),
				deltaApplied: false,
				recommendOracle,
			};
		}

		const childCountChanged =
			oldDoc.content.childCount !== newDoc.content.childCount;
		const pivot =
			childCountChanged && (oldIndices.size > 0 || newIndices.size > 0)
				? Math.min(
						oldIndices.size > 0
							? Math.min(...oldIndices)
							: oldDoc.content.childCount,
						newIndices.size > 0
							? Math.min(...newIndices)
							: newDoc.content.childCount
					)
				: null;

		if (childCountChanged && pivot != null) {
			for (let i = pivot; i < this.blockWeights.length; i += 1) {
				const weight = this.blockWeights[i];
				if (!weight) {
					continue;
				}
				this.running.words -= weight.words;
				this.running.characters -= weight.characters;
			}
		} else {
			for (const idx of oldIndices) {
				const weight = this.blockWeights[idx];
				if (!weight) {
					continue;
				}
				this.running.words -= weight.words;
				this.running.characters -= weight.characters;
			}
		}

		const nextWeights: BlockWeight[] = new Array(newDoc.content.childCount);

		for (let i = 0; i < newDoc.content.childCount; i += 1) {
			const mustMeasure =
				(childCountChanged && pivot != null && i >= pivot) ||
				oldIndices.has(i) ||
				newIndices.has(i);

			const weight = mustMeasure
				? measureBlockPlainStats(newDoc.content.child(i))
				: this.blockWeights[i];

			nextWeights[i] = weight;
			if (mustMeasure) {
				this.running.words += weight.words;
				this.running.characters += weight.characters;
			}
		}

		this.blockWeights = nextWeights;

		return {
			stats: { ...this.running },
			deltaApplied: true,
			recommendOracle,
		};
	}

	reconcileWithOracle(
		oracle: DocEditorRunningStats,
		doc: ProseMirrorNode
	): DocEditorOracleReconcileResult {
		const fast = this.getRunningTotals();
		const mismatch =
			fast.words !== oracle.words || fast.characters !== oracle.characters;

		if (!mismatch) {
			return { stats: fast, mismatch: false };
		}

		this.resetFromDoc(doc);
		const aligned = this.getRunningTotals();
		if (
			aligned.words !== oracle.words ||
			aligned.characters !== oracle.characters
		) {
			this.resetFromOracle(oracle);
			return { stats: { ...oracle }, mismatch: true };
		}

		return { stats: aligned, mismatch: true };
	}

	private sumBlockWeights(): DocEditorRunningStats {
		let words = 0;
		let characters = 0;
		for (const block of this.blockWeights) {
			words += block.words;
			characters += block.characters;
		}
		return { words, characters };
	}
}

export function createDocEditorIncrementalStatsEngine(): DocEditorIncrementalStatsEngine {
	return new DocEditorIncrementalStatsEngine();
}

export function statsEqual(
	a: DocEditorRunningStats,
	b: DocEditorRunningStats
): boolean {
	return a.words === b.words && a.characters === b.characters;
}
