import { describe, expect, it } from 'vitest';
import { resolveDocEditorLeaveGuardDecision } from './docEditorLeaveGuard';

describe('resolveDocEditorLeaveGuardDecision', () => {
	it('blocks leave only for dirty state', () => {
		expect(
			resolveDocEditorLeaveGuardDecision({
				isLoadingDocument: false,
				isSaving: false,
				hasCurrentDocument: true,
				tabCount: 2,
				sessionCount: 1,
				hasAnyDocTabDirty: true,
			})
		).toEqual({ shouldBlock: true, reason: 'dirty' });
	});

	it('does not block while loading or saving', () => {
		expect(
			resolveDocEditorLeaveGuardDecision({
				isLoadingDocument: true,
				isSaving: false,
				hasCurrentDocument: true,
				tabCount: 1,
				sessionCount: 0,
				hasAnyDocTabDirty: true,
			})
		).toEqual({ shouldBlock: false, reason: 'loading' });

		expect(
			resolveDocEditorLeaveGuardDecision({
				isLoadingDocument: false,
				isSaving: true,
				hasCurrentDocument: true,
				tabCount: 1,
				sessionCount: 0,
				hasAnyDocTabDirty: true,
			})
		).toEqual({ shouldBlock: false, reason: 'saving' });
	});

	it('does not block in empty and clean states', () => {
		expect(
			resolveDocEditorLeaveGuardDecision({
				isLoadingDocument: false,
				isSaving: false,
				hasCurrentDocument: false,
				tabCount: 0,
				sessionCount: 0,
				hasAnyDocTabDirty: false,
			})
		).toEqual({ shouldBlock: false, reason: 'empty_state' });

		expect(
			resolveDocEditorLeaveGuardDecision({
				isLoadingDocument: false,
				isSaving: false,
				hasCurrentDocument: true,
				tabCount: 1,
				sessionCount: 0,
				hasAnyDocTabDirty: false,
			})
		).toEqual({ shouldBlock: false, reason: 'clean' });
	});
});
