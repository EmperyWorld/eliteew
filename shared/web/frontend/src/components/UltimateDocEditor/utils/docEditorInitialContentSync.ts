/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard TipTap `setContent` from stale `editorInitialContent` while the user is typing.
 *
 * Invariants:
 * - Same document + focused editor + HTML mismatch → treat props/store as stale (skip sync).
 * - Document key change always allows sync (tab switch / load).
 *
 * Related:
 * - `hooks/useDocEditorTipTapContentSync.ts`, `EditorCore/TiptapEditor.tsx`
 */

import type { MutableRefObject } from 'react';

import { editorHtmlContentEquivalent } from './htmlComparableText';

export function resolveDocEditorDocumentSyncKey(
	documentId: string | null | undefined,
	currentDocumentId: string | null | undefined,
	currentFileId: string | null | undefined
): string {
	return [documentId ?? '', currentDocumentId ?? '', currentFileId ?? ''].join(
		':'
	);
}

export function shouldSuppressStaleEditorInitialContentSync(options: {
	isEditorFocused: boolean;
	incomingHtml: string;
	currentHtml: string;
	documentSyncKey: string;
	lastSyncedDocumentKeyRef: MutableRefObject<string | null>;
	suppressOnce?: boolean;
}): boolean {
	const {
		isEditorFocused,
		incomingHtml,
		currentHtml,
		documentSyncKey,
		lastSyncedDocumentKeyRef,
		suppressOnce = false,
	} = options;

	if (suppressOnce) {
		return true;
	}

	const documentChanged = lastSyncedDocumentKeyRef.current !== documentSyncKey;

	if (documentChanged) {
		return false;
	}

	if (!isEditorFocused) {
		return false;
	}

	if (editorHtmlContentEquivalent(incomingHtml, currentHtml)) {
		return false;
	}

	return true;
}

export function markDocEditorInitialContentSynced(
	lastSyncedDocumentKeyRef: MutableRefObject<string | null>,
	documentSyncKey: string
): void {
	lastSyncedDocumentKeyRef.current = documentSyncKey;
}

export function markDocEditorInitialContentSyncedIfEquivalent(options: {
	incomingHtml: string;
	currentHtml: string;
	documentSyncKey: string;
	lastSyncedDocumentKeyRef: MutableRefObject<string | null>;
}): boolean {
	const {
		incomingHtml,
		currentHtml,
		documentSyncKey,
		lastSyncedDocumentKeyRef,
	} = options;

	if (!editorHtmlContentEquivalent(incomingHtml, currentHtml)) {
		return false;
	}

	markDocEditorInitialContentSynced(lastSyncedDocumentKeyRef, documentSyncKey);
	return true;
}
