/**
 * Split selected plain text into separate visual / structural lines.
 *
 * - If the selection contains line breaks: each non-empty line becomes its own &lt;p&gt;.
 * - Otherwise: each whitespace-separated token becomes its own line inside one &lt;p&gt; (&lt;br&gt;).
 *
 * Inline formatting inside the selection is not preserved (replace with plain text).
 */
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Whether the current selection can be split (non-empty text, splittable). */
export function canSplitSelectionIntoLines(editor: Editor): boolean {
	const { selection, doc } = editor.state;
	if (!(selection instanceof TextSelection) || selection.empty) {
		return false;
	}
	const { from, to } = selection;
	const raw = doc.textBetween(from, to, '\n');
	const trimmed = raw.trim();
	if (!trimmed) {
		return false;
	}
	if (/\r?\n/.test(raw)) {
		return trimmed.length > 0;
	}
	return /\s/.test(trimmed);
}

export function splitSelectionIntoLines(editor: Editor): boolean {
	const { state } = editor;
	const { selection, doc } = state;
	if (!(selection instanceof TextSelection) || selection.empty) {
		return false;
	}
	const { from, to } = selection;
	const raw = doc.textBetween(from, to, '\n');
	const trimmed = raw.trim();
	if (!trimmed) {
		return false;
	}

	let html: string;
	if (/\r?\n/.test(raw)) {
		const lines = raw.split(/\r?\n/).map((l) => l.trimEnd());
		const parts = lines
			.filter((l) => l.length > 0)
			.map((l) => `<p>${escapeHtml(l)}</p>`);
		if (parts.length === 0) {
			return false;
		}
		html = parts.join('');
	} else {
		if (!/\s/.test(trimmed)) {
			return false;
		}
		const words = trimmed.split(/\s+/).filter(Boolean);
		if (words.length <= 1) {
			return false;
		}
		html = `<p>${words.map((w) => escapeHtml(w)).join('<br>')}</p>`;
	}

	editor.chain().focus().deleteRange({ from, to }).insertContent(html).run();
	return true;
}
