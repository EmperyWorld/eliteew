import type { Layout } from 'react-grid-layout';

/** Max depth of user layout moves kept for undo (oldest dropped). */
export const GRID_UNDO_MAX = 40;

export function cloneGridLayout(layout: Layout): Layout {
	return layout.map((item) => ({ ...item }));
}

export function layoutsEqualForUndo(a: Layout, b: Layout): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * After a user-driven grid change: push previous layout onto undo, clear redo.
 * No-op if there was no prior layout or layout is unchanged.
 */
export function recordLayoutChangeOnUndoStack(
	undoStack: Layout[],
	redoStack: Layout[],
	prev: Layout,
	next: Layout,
	maxDepth: number
): { undoStack: Layout[]; redoStack: Layout[]; stacksMutated: boolean } {
	if (prev.length === 0 || layoutsEqualForUndo(prev, next)) {
		return { undoStack, redoStack, stacksMutated: false };
	}
	const pushed = [...undoStack, cloneGridLayout(prev)];
	const trimmed =
		pushed.length > maxDepth ? pushed.slice(pushed.length - maxDepth) : pushed;
	return { undoStack: trimmed, redoStack: [], stacksMutated: true };
}

export function popUndoForGridLayout(
	undoStack: Layout[],
	redoStack: Layout[],
	current: Layout
): {
	undoStack: Layout[];
	redoStack: Layout[];
	targetLayout: Layout;
} | null {
	if (undoStack.length === 0) return null;
	const targetLayout = undoStack[undoStack.length - 1];
	if (targetLayout === undefined) return null;
	const nextUndo = undoStack.slice(0, -1);
	const nextRedo = [...redoStack, cloneGridLayout(current)];
	return { undoStack: nextUndo, redoStack: nextRedo, targetLayout };
}

export function popRedoForGridLayout(
	undoStack: Layout[],
	redoStack: Layout[],
	current: Layout
): {
	undoStack: Layout[];
	redoStack: Layout[];
	targetLayout: Layout;
} | null {
	if (redoStack.length === 0) return null;
	const targetLayout = redoStack[redoStack.length - 1];
	if (targetLayout === undefined) return null;
	const nextRedo = redoStack.slice(0, -1);
	const nextUndo = [...undoStack, cloneGridLayout(current)];
	return { undoStack: nextUndo, redoStack: nextRedo, targetLayout };
}
