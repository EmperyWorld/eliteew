import { describe, expect, it } from 'vitest';
import { isDocEditorOpenTargetApplied } from './docEditorOpenTarget';

describe('isDocEditorOpenTargetApplied', () => {
	it('returns false while stale payload state is still active', () => {
		expect(
			isDocEditorOpenTargetApplied({
				openTarget: { targetType: 'unifiedContent', id: 'uc-new' },
				currentFileId: 'uc-old',
				currentDocumentId: 'uc-old',
				documentSource: 'unified_content',
			})
		).toBe(false);
	});

	it('returns true when unified target is loaded', () => {
		expect(
			isDocEditorOpenTargetApplied({
				openTarget: { targetType: 'unifiedContent', id: 'uc-7' },
				currentFileId: 'uc-7',
				currentDocumentId: 'uc-7',
				documentSource: 'unified_content',
			})
		).toBe(true);
	});

	it('returns true only for doc target loaded from doc_editor source', () => {
		expect(
			isDocEditorOpenTargetApplied({
				openTarget: { targetType: 'docEditor', id: 'doc-3' },
				currentFileId: null,
				currentDocumentId: 'doc-3',
				documentSource: 'doc_editor',
			})
		).toBe(true);
		expect(
			isDocEditorOpenTargetApplied({
				openTarget: { targetType: 'docEditor', id: 'doc-3' },
				currentFileId: null,
				currentDocumentId: 'doc-3',
				documentSource: 'unified_content',
			})
		).toBe(false);
	});
});
