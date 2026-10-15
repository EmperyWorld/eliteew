import type { UltimateDocument } from '../types/editor.types';
import { canPersistCanonicalDocument } from '../types/editor.types';

export type DocEditorSaveTarget =
	| { kind: 'canonical_doc'; documentId: string }
	| { kind: 'unified_content_file'; fileId: string }
	| { kind: 'readonly_no_persist' };

export interface ResolveDocEditorSaveTargetInput {
	currentDocument: UltimateDocument | null | undefined;
	documentSource: 'doc_editor' | 'unified_content' | null | undefined;
	payloadWantsUnifiedContent: boolean;
	currentFileId: string | null | undefined;
	canPersistUnifiedContent: boolean;
	collaborationActive: boolean;
}

/**
 * Единая точка: куда писать при «Сохранить» / автосохранении.
 * Не выполняет I/O — только классификация для UI и диспетчеров.
 */
export function resolveDocEditorSaveTarget(
	input: ResolveDocEditorSaveTargetInput
): DocEditorSaveTarget {
	const {
		currentDocument,
		documentSource,
		payloadWantsUnifiedContent,
		currentFileId,
		canPersistUnifiedContent,
		collaborationActive,
	} = input;

	if (payloadWantsUnifiedContent || documentSource === 'unified_content') {
		if (currentFileId && canPersistUnifiedContent) {
			return { kind: 'unified_content_file', fileId: currentFileId };
		}
		return { kind: 'readonly_no_persist' };
	}

	if (!currentDocument?.id || currentDocument.id === 'temp') {
		return { kind: 'readonly_no_persist' };
	}

	if (!canPersistCanonicalDocument(currentDocument)) {
		return { kind: 'readonly_no_persist' };
	}

	if (collaborationActive) {
		// Autosave PUT during collab — см. `docEditorCollabSavePolicy.ts` (owner idle / manual commit).
		return { kind: 'canonical_doc', documentId: currentDocument.id };
	}

	return { kind: 'canonical_doc', documentId: currentDocument.id };
}
