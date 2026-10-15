/**
 * Remove empty block-level lines (paragraphs / headings with no visible text) from a TipTap editor.
 */
import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';

function visibleText(node: PMNode): string {
	return node.textContent
		.replace(/\u00a0/g, ' ')
		.replace(/\u200b/g, '')
		.trim();
}

function isEffectivelyEmptyParagraph(node: PMNode): boolean {
	if (node.type.name !== 'paragraph') {
		return false;
	}
	if (visibleText(node).length > 0) {
		return false;
	}
	if (node.childCount === 0) {
		return true;
	}
	for (let i = 0; i < node.childCount; i++) {
		const ch = node.child(i);
		if (ch.type.name === 'hardBreak') {
			continue;
		}
		if (ch.type.name === 'text') {
			if (visibleText(ch).length > 0) {
				return false;
			}
			continue;
		}
		return false;
	}
	return true;
}

function isEffectivelyEmptyHeading(node: PMNode): boolean {
	return node.type.name === 'heading' && visibleText(node).length === 0;
}

/** @returns true if the document was changed */
export function removeEmptyBlockLines(editor: Editor): boolean {
	const { state } = editor;
	const { doc, tr, schema } = state;
	const ranges: { from: number; to: number }[] = [];

	doc.descendants((node, pos) => {
		if (node.type.name === 'doc') {
			return true;
		}
		if (!node.isBlock) {
			return true;
		}
		if (isEffectivelyEmptyParagraph(node) || isEffectivelyEmptyHeading(node)) {
			ranges.push({ from: pos, to: pos + node.nodeSize });
		}
		return true;
	});

	if (ranges.length === 0) {
		return false;
	}

	ranges.sort((a, b) => b.from - a.from);
	const nextTr = tr;
	for (const r of ranges) {
		if (r.from >= nextTr.doc.content.size) {
			continue;
		}
		const node = nextTr.doc.nodeAt(r.from);
		if (!node || r.to !== r.from + node.nodeSize) {
			continue;
		}
		try {
			nextTr.delete(r.from, r.to);
		} catch {
			/* schema may reject some deletes; skip */
		}
	}

	if (nextTr.doc.childCount === 0) {
		const p = schema.nodes.paragraph.create();
		nextTr.insert(1, p);
	}

	editor.view.dispatch(nextTr);
	editor.view.focus();
	return true;
}
