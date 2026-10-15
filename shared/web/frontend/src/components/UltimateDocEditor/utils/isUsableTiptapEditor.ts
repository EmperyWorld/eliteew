/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard TipTap editor instances before chain/can/state access in toolbar and menus.
 *
 * Invariants:
 * - Destroyed editors (stale parent ref after useEditor teardown) are treated as unusable.
 *
 * Related:
 * - EditorCore/EditorToolbar.tsx, components/EditorContextMenu.tsx
 */

import type { Editor } from '@tiptap/core';

export function isUsableTiptapEditor(
	editor: Editor | null | undefined
): editor is Editor {
	if (!editor) {
		return false;
	}
	if ((editor as { isDestroyed?: boolean }).isDestroyed) {
		return false;
	}
	return true;
}

export function safeEditorCanUndo(editor: Editor | null | undefined): boolean {
	if (!isUsableTiptapEditor(editor)) {
		return false;
	}
	try {
		return editor.can().undo();
	} catch {
		return false;
	}
}

export function safeEditorCanRedo(editor: Editor | null | undefined): boolean {
	if (!isUsableTiptapEditor(editor)) {
		return false;
	}
	try {
		return editor.can().redo();
	} catch {
		return false;
	}
}

export function safeEditorCan(
	editor: Editor | null | undefined,
	check: (canChain: ReturnType<Editor['can']>) => boolean
): boolean {
	if (!isUsableTiptapEditor(editor)) {
		return false;
	}
	try {
		return check(editor.can());
	} catch {
		return false;
	}
}
