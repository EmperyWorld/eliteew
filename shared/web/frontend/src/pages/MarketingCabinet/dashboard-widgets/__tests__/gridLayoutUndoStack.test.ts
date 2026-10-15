import { describe, expect, it } from 'vitest';
import {
	GRID_UNDO_MAX,
	cloneGridLayout,
	layoutsEqualForUndo,
	popRedoForGridLayout,
	popUndoForGridLayout,
	recordLayoutChangeOnUndoStack,
} from '../gridLayoutUndoStack';
import type { Layout } from 'react-grid-layout';

const L0: Layout = [{ i: 'a', x: 0, y: 0, w: 2, h: 2 }];
const L1: Layout = [{ i: 'a', x: 1, y: 0, w: 2, h: 2 }];

describe('gridLayoutUndoStack', () => {
	it('record skips when prev is empty', () => {
		const r = recordLayoutChangeOnUndoStack([], [], [], L0, GRID_UNDO_MAX);
		expect(r.stacksMutated).toBe(false);
		expect(r.undoStack).toEqual([]);
		expect(r.redoStack).toEqual([]);
	});

	it('record skips when layout unchanged', () => {
		const r = recordLayoutChangeOnUndoStack(
			[],
			[],
			L0,
			cloneGridLayout(L0),
			40
		);
		expect(r.stacksMutated).toBe(false);
	});

	it('record pushes prev and clears redo', () => {
		const r = recordLayoutChangeOnUndoStack(
			[],
			[cloneGridLayout(L0)],
			L0,
			L1,
			GRID_UNDO_MAX
		);
		expect(r.stacksMutated).toBe(true);
		expect(r.undoStack).toHaveLength(1);
		const top = r.undoStack[0];
		expect(top).toBeDefined();
		if (!top) throw new Error('unreachable');
		expect(layoutsEqualForUndo(top, L0)).toBe(true);
		expect(r.redoStack).toEqual([]);
	});

	it('record trims undo to maxDepth', () => {
		let undo: Layout[] = [];
		let redo: Layout[] = [];
		for (let i = 0; i < GRID_UNDO_MAX + 5; i += 1) {
			const prev: Layout = [{ i: 'a', x: i, y: 0, w: 1, h: 1 }];
			const next: Layout = [{ i: 'a', x: i + 1, y: 0, w: 1, h: 1 }];
			const out = recordLayoutChangeOnUndoStack(
				undo,
				redo,
				prev,
				next,
				GRID_UNDO_MAX
			);
			undo = out.undoStack;
			redo = out.redoStack;
		}
		expect(undo).toHaveLength(GRID_UNDO_MAX);
	});

	it('undo / redo round-trip', () => {
		let undo: Layout[] = [];
		let redo: Layout[] = [];
		const a = recordLayoutChangeOnUndoStack(undo, redo, L0, L1, GRID_UNDO_MAX);
		undo = a.undoStack;
		redo = a.redoStack;

		const u = popUndoForGridLayout(undo, redo, L1);
		expect(u).not.toBeNull();
		if (!u) throw new Error('unreachable');
		expect(layoutsEqualForUndo(u.targetLayout, L0)).toBe(true);
		undo = u.undoStack;
		redo = u.redoStack;

		const r2 = popRedoForGridLayout(undo, redo, L0);
		expect(r2).not.toBeNull();
		if (!r2) throw new Error('unreachable');
		expect(layoutsEqualForUndo(r2.targetLayout, L1)).toBe(true);
	});

	it('popUndo returns null when empty', () => {
		expect(popUndoForGridLayout([], [], L0)).toBeNull();
	});

	it('popRedo returns null when empty', () => {
		expect(popRedoForGridLayout([], [], L0)).toBeNull();
	});
});
