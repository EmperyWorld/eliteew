import { Schema } from '@tiptap/pm/model';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';

import {
	collectTopLevelBlockIndicesInRange,
	createDocEditorIncrementalStatsEngine,
	type DocEditorIncrementalStatsEngine,
	sumTopLevelBlockStats,
} from './docEditorIncrementalStats';
import { countWordsFromHtml } from './htmlWordCount';

const testDocSchema = new Schema({
	nodes: {
		doc: { content: 'block+' },
		paragraph: { group: 'block', content: 'text*' },
		text: { group: 'inline' },
	},
});

function stateFromParagraphs(texts: string[]): EditorState {
	const paragraphs = texts.map((text) => {
		if (!text) {
			return testDocSchema.nodes.paragraph.create();
		}
		return testDocSchema.nodes.paragraph.create({}, testDocSchema.text(text));
	});
	const doc = testDocSchema.nodes.doc.create({}, paragraphs);
	return EditorState.create({ schema: testDocSchema, doc });
}

function applyDocTransaction(
	state: EditorState,
	mutate: (tr: Transaction) => void
): { state: EditorState; transaction: Transaction } {
	const tr = state.tr;
	mutate(tr);
	const next = state.apply(tr);
	return { state: next, transaction: tr };
}

function oracleFromDoc(state: EditorState) {
	const blocks = state.doc.content;
	const html = Array.from({ length: blocks.childCount }, (_, i) => {
		const text = blocks.child(i).textContent;
		return `<p>${text}</p>`;
	}).join('');
	return countWordsFromHtml(html);
}

function expectStatsMatchOracle(
	engine: DocEditorIncrementalStatsEngine,
	state: EditorState
): void {
	const running = engine.getRunningTotals();
	const oracle = oracleFromDoc(state);
	const blockSum = sumTopLevelBlockStats(state.doc);
	expect(running).toEqual(blockSum);
	expect(running.words).toBe(oracle.words);
	expect(running.characters).toBe(oracle.characters);
}

describe('docEditorIncrementalStats', () => {
	it('collectTopLevelBlockIndicesInRange returns overlapping block indices', () => {
		const state = stateFromParagraphs(['alpha', 'beta', 'gamma']);
		const indices = collectTopLevelBlockIndicesInRange(state.doc, 3, 12);
		expect(indices).toEqual([0, 1]);
	});

	it('incremental_stats_integrity: insert → delete → replace matches oracle', () => {
		const engine = createDocEditorIncrementalStatsEngine();
		let state = stateFromParagraphs(['hello world']);
		engine.resetFromDoc(state.doc);
		expectStatsMatchOracle(engine, state);

		const insertStep = applyDocTransaction(state, (tr) => {
			tr.insertText(' brave new', 12);
		});
		engine.applyTransaction(insertStep.transaction);
		state = insertStep.state;
		expectStatsMatchOracle(engine, state);

		const deleteStep = applyDocTransaction(state, (tr) => {
			tr.delete(6, 17);
		});
		engine.applyTransaction(deleteStep.transaction);
		state = deleteStep.state;
		expectStatsMatchOracle(engine, state);

		const replaceStep = applyDocTransaction(state, (tr) => {
			tr.replaceWith(
				1,
				state.doc.content.size - 1,
				testDocSchema.nodes.paragraph.create(
					{},
					testDocSchema.text('replaced document body')
				)
			);
		});
		engine.applyTransaction(replaceStep.transaction);
		state = replaceStep.state;
		expectStatsMatchOracle(engine, state);
	});

	it('reconcileWithOracle hard-resets fast totals on mismatch', () => {
		const engine = createDocEditorIncrementalStatsEngine();
		const state = stateFromParagraphs(['one two three', 'four five']);
		engine.resetFromDoc(state.doc);

		const oracle = { words: 999, characters: 4000 };
		const result = engine.reconcileWithOracle(oracle, state.doc);
		expect(result.mismatch).toBe(true);
		expect(result.stats).toEqual(oracle);
	});

	it('reconcileWithOracle keeps fast totals when aligned with block remeasure', () => {
		const engine = createDocEditorIncrementalStatsEngine();
		const state = stateFromParagraphs(['alpha beta gamma']);
		engine.resetFromDoc(state.doc);
		const aligned = sumTopLevelBlockStats(state.doc);

		const result = engine.reconcileWithOracle(aligned, state.doc);
		expect(result.mismatch).toBe(false);
		expect(result.stats).toEqual(aligned);
	});
});
