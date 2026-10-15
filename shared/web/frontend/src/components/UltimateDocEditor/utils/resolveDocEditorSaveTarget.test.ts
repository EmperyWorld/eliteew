import { describe, expect, it } from 'vitest';
import { resolveDocEditorSaveTarget } from './resolveDocEditorSaveTarget';
import type { UltimateDocument } from '../types/editor.types';

const baseDoc = (over: Partial<UltimateDocument> = {}): UltimateDocument => ({
	id: 'doc-1',
	user_id: 'u1',
	title: 'T',
	content: '<p>x</p>',
	content_type: 'html',
	metadata: {},
	tags: [],
	is_public: false,
	access_level: 'private',
	word_count: 1,
	character_count: 1,
	version_number: 1,
	created_at: '',
	updated_at: '',
	last_accessed_at: '',
	...over,
});

describe('resolveDocEditorSaveTarget', () => {
	it('unified content file when payload wants UC and file id present', () => {
		const t = resolveDocEditorSaveTarget({
			currentDocument: baseDoc(),
			documentSource: 'doc_editor',
			payloadWantsUnifiedContent: true,
			currentFileId: 'file-9',
			canPersistUnifiedContent: true,
			collaborationActive: false,
		});
		expect(t).toEqual({ kind: 'unified_content_file', fileId: 'file-9' });
	});

	it('readonly when collaborator without save flag', () => {
		const t = resolveDocEditorSaveTarget({
			currentDocument: baseDoc({
				document_access_role: 'collaborator',
				collaboration_can_save: false,
			}),
			documentSource: 'doc_editor',
			payloadWantsUnifiedContent: false,
			currentFileId: null,
			canPersistUnifiedContent: true,
			collaborationActive: false,
		});
		expect(t.kind).toBe('readonly_no_persist');
	});

	it('canonical when owner doc', () => {
		const t = resolveDocEditorSaveTarget({
			currentDocument: baseDoc(),
			documentSource: 'doc_editor',
			payloadWantsUnifiedContent: false,
			currentFileId: null,
			canPersistUnifiedContent: true,
			collaborationActive: true,
		});
		expect(t).toEqual({ kind: 'canonical_doc', documentId: 'doc-1' });
	});
});
