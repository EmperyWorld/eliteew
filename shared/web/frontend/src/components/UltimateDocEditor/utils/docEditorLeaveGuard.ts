export type DocEditorLeaveGuardReason =
	| 'dirty'
	| 'loading'
	| 'saving'
	| 'empty_state'
	| 'clean';

export type DocEditorLeaveGuardChannel =
	| 'beforeunload'
	| 'window_close'
	| 'direct_close';

export interface DocEditorLeaveGuardSnapshot {
	isLoadingDocument: boolean;
	isSaving: boolean;
	hasCurrentDocument: boolean;
	tabCount: number;
	sessionCount: number;
	hasAnyDocTabDirty: boolean;
}

export interface DocEditorLeaveGuardDecision {
	shouldBlock: boolean;
	reason: DocEditorLeaveGuardReason;
}

/**
 * Centralized decision matrix for close/leave guards.
 * Keeps `beforeunload` and desktop window close confirmation consistent.
 */
export function resolveDocEditorLeaveGuardDecision(
	snapshot: DocEditorLeaveGuardSnapshot
): DocEditorLeaveGuardDecision {
	if (snapshot.isLoadingDocument) {
		return { shouldBlock: false, reason: 'loading' };
	}
	if (snapshot.isSaving) {
		return { shouldBlock: false, reason: 'saving' };
	}
	if (
		!snapshot.hasCurrentDocument &&
		snapshot.tabCount === 0 &&
		snapshot.sessionCount === 0
	) {
		return { shouldBlock: false, reason: 'empty_state' };
	}
	if (snapshot.hasAnyDocTabDirty) {
		return { shouldBlock: true, reason: 'dirty' };
	}
	return { shouldBlock: false, reason: 'clean' };
}
