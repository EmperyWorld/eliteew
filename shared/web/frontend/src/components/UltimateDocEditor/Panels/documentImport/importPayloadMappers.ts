/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure mappers for DocumentImportPanel upload payload and File System Access entries.
 *
 * Invariants:
 * - importPayloadToUltimateDocument preserves mime_type inside metadata when present.
 *
 * Related:
 * - documentImportTypes.ts, useDocumentImportBatch.ts
 */

import type { UltimateDocument } from '@/components/UltimateDocEditor/types/editor.types';
import type { ImportDocumentApiPayload } from '@/components/UltimateDocEditor/Panels/documentImport/documentImportTypes';

export function importPayloadToUltimateDocument(
	payload: ImportDocumentApiPayload
): UltimateDocument {
	const emptyTs = '';
	return {
		id: payload.id,
		user_id: '',
		title: payload.title,
		content: payload.content,
		content_type: 'html',
		metadata: {
			...(payload.metadata ?? {}),
			...(payload.mime_type ? { mime_type: payload.mime_type } : {}),
		},
		tags: [],
		is_public: false,
		access_level: 'private',
		word_count: payload.word_count,
		character_count: payload.character_count,
		version_number: 1,
		created_at: emptyTs,
		updated_at: emptyTs,
		last_accessed_at: emptyTs,
	};
}

export function isFileSystemDirectoryEntry(
	entry: FileSystemEntry | null | undefined
): entry is FileSystemDirectoryEntry {
	return entry != null && entry.isDirectory === true;
}
