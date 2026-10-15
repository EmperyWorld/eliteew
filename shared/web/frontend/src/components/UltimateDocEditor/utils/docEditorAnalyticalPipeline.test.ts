import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDocEditorAnalyticalPipeline } from './docEditorAnalyticalPipeline';
import { createDocEditorGenerationController } from './docEditorEditGeneration';
import {
	createDocEditorIncrementalStatsEngine,
	sumTopLevelBlockStats,
} from './docEditorIncrementalStats';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';

describe('docEditorAnalyticalPipeline', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('discards stale heavy job when generation advances before idle runs', () => {
		const generation = createDocEditorGenerationController();
		const commits: string[] = [];
		const staleGenerations: number[] = [];

		const pipeline = createDocEditorAnalyticalPipeline({
			generation,
			debounceMs: 10,
			onCommit: (commit) => {
				commits.push(commit.html);
			},
			onStaleJobDiscarded: (jobGeneration) => {
				staleGenerations.push(jobGeneration);
			},
		});

		const editor = {
			getHTML: vi
				.fn()
				.mockReturnValueOnce('<p>stale burst</p>')
				.mockReturnValue('<p>should not commit</p>'),
			isDestroyed: false,
		};

		generation.bump();
		pipeline.scheduleFromEditor(editor);
		vi.advanceTimersByTime(10);

		generation.bump();
		vi.runAllTimers();

		expect(commits).toEqual([]);
		expect(staleGenerations).toContain(1);
		expect(editor.getHTML).not.toHaveBeenCalled();
	});

	it('burst stress: clearAll after scheduled getHTML must not restore first transaction html', () => {
		const generation = createDocEditorGenerationController();
		let storeHtml = '<p>initial</p>';

		const pipeline = createDocEditorAnalyticalPipeline({
			generation,
			debounceMs: 5,
			onCommit: (commit) => {
				storeHtml = commit.html;
			},
		});

		const editor = {
			getHTML: vi.fn(() => storeHtml),
			isDestroyed: false,
		};

		for (let i = 0; i < 50; i += 1) {
			generation.bump();
			storeHtml = `<p>transaction-${i}</p>`;
			pipeline.scheduleFromEditor(editor);
		}

		vi.advanceTimersByTime(5);

		generation.bump();
		storeHtml = '<p></p>';
		pipeline.scheduleFromEditor(editor);

		vi.runAllTimers();

		expect(storeHtml).toBe('<p></p>');
		expect(storeHtml).not.toContain('transaction-0');
	});

	it('flushSync commits latest generation synchronously', () => {
		const generation = createDocEditorGenerationController();
		let committedHtml = '';

		const pipeline = createDocEditorAnalyticalPipeline({
			generation,
			onCommit: (commit) => {
				committedHtml = commit.html;
			},
		});

		generation.bump();
		const editor = {
			getHTML: () => '<p>flush boundary</p>',
			isDestroyed: false,
		};

		const result = pipeline.flushSyncFromEditor(editor);
		expect(result?.html).toBe('<p>flush boundary</p>');
		expect(committedHtml).toBe('<p>flush boundary</p>');
	});

	it('coalesces rapid schedules to a single commit for one generation burst end', () => {
		const generation = createDocEditorGenerationController();
		const commits: string[] = [];

		const pipeline = createDocEditorAnalyticalPipeline({
			generation,
			debounceMs: 20,
			onCommit: (commit) => {
				commits.push(commit.html);
			},
		});

		const editor = {
			getHTML: () => '<p>final coalesced</p>',
			isDestroyed: false,
		};

		generation.bump();
		for (let i = 0; i < 50; i += 1) {
			pipeline.scheduleFromEditor(editor);
		}

		vi.advanceTimersByTime(20);
		vi.runAllTimers();

		expect(commits).toEqual(['<p>final coalesced</p>']);
	});

	it('reconciliation resets fast stats when oracle disagrees with running totals', () => {
		const generation = createDocEditorGenerationController();
		const incremental = createDocEditorIncrementalStatsEngine();
		const schema = new Schema({
			nodes: {
				doc: { content: 'block+' },
				paragraph: { group: 'block', content: 'text*' },
				text: { group: 'inline' },
			},
		});
		const doc = schema.nodes.doc.create(
			{},
			schema.nodes.paragraph.create({}, schema.text('hello world'))
		);
		const pmState = EditorState.create({ schema, doc });
		incremental.resetFromDoc(pmState.doc);

		let committedStats = { words: 0, characters: 0 };
		const pipeline = createDocEditorAnalyticalPipeline({
			generation,
			debounceMs: 5,
			getFastStats: () => incremental.getRunningTotals(),
			reconcileOracle: ({ oracle, editor }) => {
				const liveDoc = editor.getDoc?.();
				if (!liveDoc) {
					return oracle;
				}
				return incremental.reconcileWithOracle(oracle, liveDoc).stats;
			},
			onCommit: (commit) => {
				committedStats = commit.stats;
				expect(commit.reconciliation?.mismatch).toBe(false);
			},
		});

		generation.bump();
		const editor = {
			getHTML: () => '<p>hello world</p>',
			isDestroyed: false,
			getDoc: () => pmState.doc,
		};

		pipeline.scheduleFromEditor(editor);
		vi.advanceTimersByTime(5);
		vi.runAllTimers();

		expect(committedStats.words).toBe(2);
		expect(committedStats.characters).toBe(11);
		expect(incremental.getRunningTotals()).toEqual(committedStats);
	});

	it('burst typing keeps main-thread work O(Δ): zero getHTML during 100-transaction burst', () => {
		const generation = createDocEditorGenerationController();
		const incremental = createDocEditorIncrementalStatsEngine();
		const schema = new Schema({
			nodes: {
				doc: { content: 'block+' },
				paragraph: { group: 'block', content: 'text*' },
				text: { group: 'inline' },
			},
		});

		let pmState = EditorState.create({
			schema,
			doc: schema.nodes.doc.create(
				{},
				schema.nodes.paragraph.create({}, schema.text('seed'))
			),
		});
		incremental.resetFromDoc(pmState.doc);

		const getHTML = vi.fn(() => {
			const html = `<p>${pmState.doc.textContent}</p>`;
			return html;
		});

		const pipeline = createDocEditorAnalyticalPipeline({
			generation,
			debounceMs: 50,
			getFastStats: () => incremental.getRunningTotals(),
			onCommit: () => {},
		});

		const editor = {
			getHTML,
			isDestroyed: false,
			getDoc: () => pmState.doc,
		};

		let syncDeltaOps = 0;
		for (let i = 0; i < 100; i += 1) {
			generation.bump();
			const tr = pmState.tr.insertText('x', pmState.doc.content.size - 1);
			const next = pmState.apply(tr);
			const delta = incremental.applyTransaction(tr);
			if (delta.deltaApplied) {
				syncDeltaOps += 1;
			}
			pmState = next;
			pipeline.scheduleFromEditor(editor);
		}

		expect(getHTML).toHaveBeenCalledTimes(0);
		expect(syncDeltaOps).toBe(100);
		expect(incremental.getRunningTotals()).toEqual(
			sumTopLevelBlockStats(pmState.doc)
		);

		vi.advanceTimersByTime(50);
		vi.runAllTimers();
		expect(getHTML).toHaveBeenCalledTimes(1);
	});
});
