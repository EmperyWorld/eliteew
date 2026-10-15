/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Safe TipTap HTML serialization for autosave/collab flush when the editor view
 * may be torn down while React still holds an Editor reference.
 *
 * Invariants:
 * - Returns null when editor is missing, destroyed, or getHTML throws.
 *
 * Related:
 * - hooks/useDocEditorResolveHtmlForSave.ts, hooks/useDocEditorEditorHtmlStoreSync.ts
 */

import type { Editor } from '@tiptap/react';

export function safeEditorGetHtml(
	editor: Editor | null | undefined
): string | null {
	if (!editor || editor.isDestroyed) {
		return null;
	}
	try {
		return editor.getHTML();
	} catch {
		return null;
	}
}
