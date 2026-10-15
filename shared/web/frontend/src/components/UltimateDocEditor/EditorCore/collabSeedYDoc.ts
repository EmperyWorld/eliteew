/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Seed an empty Y.Doc "default" XmlFragment from HTML before Yjs WebSocket sync.
 * Otherwise TipTap Collaboration shows an empty doc and autosave can wipe server content.
 *
 * Invariants:
 * - Schema must match TiptapEditorInner via createCoreTiptapExtensions (no comment anchors / collab UI).
 *
 * Related:
 * - createCoreTiptapExtensions.ts, TiptapEditorInner.tsx
 */
import { generateJSON, getSchema } from '@tiptap/core';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment } from 'y-prosemirror';

import { log } from '../../../utils/logger';
import { createCoreTiptapExtensions } from './createCoreTiptapExtensions';
import { createOptionalTiptapExtensions } from './createOptionalTiptapExtensions';

const COLLAB_SEED_PLACEHOLDER = '…';

function buildSeedExtensions() {
	return createCoreTiptapExtensions({
		editorPlaceholder: COLLAB_SEED_PLACEHOLDER,
		hasCollab: true,
		optionalExtensions: createOptionalTiptapExtensions(),
		collaborationExtensions: [],
		includeCommentAnchors: false,
	});
}

/**
 * Сервер Yjs может сохранить пустую комнату с одним пустым `<paragraph>` — тогда `fragment.length > 0`,
 * сид из HTML пропускается и редактор показывает пустой документ. Считаем «пустым» фрагмент без текста и без медиа.
 */
function yXmlFragmentIsSemanticallyEmpty(fragment: Y.XmlFragment): boolean {
	if (fragment.length === 0) {
		return true;
	}
	const raw = fragment.toString();
	if (/<img\b/i.test(raw) || /<image\b/i.test(raw)) {
		return false;
	}
	const textOnly = raw
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return textOnly.length === 0;
}

function clearYXmlFragment(fragment: Y.XmlFragment): void {
	while (fragment.length > 0) {
		fragment.delete(0, 1);
	}
}

/**
 * If the default Y.XmlFragment is empty, fill it from HTML so Collaboration matches the open document.
 */
export function seedYDocDefaultFragmentFromHtml(
	ydoc: Y.Doc,
	html: string
): void {
	const trimmed = (html ?? '').trim();
	if (!trimmed) {
		return;
	}
	const fragment = ydoc.getXmlFragment('default');
	if (fragment.length > 0 && !yXmlFragmentIsSemanticallyEmpty(fragment)) {
		return;
	}
	if (fragment.length > 0) {
		clearYXmlFragment(fragment);
	}
	try {
		const extensions = buildSeedExtensions();
		const json = generateJSON(trimmed, extensions);
		const schema = getSchema(extensions);
		prosemirrorJSONToYXmlFragment(schema, json, fragment);
	} catch (e) {
		log.warn(
			'CollabSeedYDoc',
			'Failed to seed Y.Doc from HTML (collaboration may start empty)',
			e instanceof Error ? e : undefined
		);
	}
}
