/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';

import {
	autosaveDebounceMsForMode,
	resolveDocEditorCollabSaveMode,
	saveActionTooltipKeyForMode,
	shouldRunAutosaveCanonicalPut,
} from './docEditorCollabSavePolicy';
import {
	DOC_EDITOR_AUTOSAVE_DEBOUNCE_MS,
	DOC_EDITOR_COLLAB_IDLE_CANONICAL_MS,
} from './docEditorPersistTiming';

describe('resolveDocEditorCollabSaveMode', () => {
	it('normal when collab inactive', () => {
		expect(
			resolveDocEditorCollabSaveMode({
				collaborationActive: false,
				isDocumentOwner: true,
				canPersistCanonical: true,
			})
		).toBe('normal');
	});

	it('owner_idle_put for owner in collab', () => {
		expect(
			resolveDocEditorCollabSaveMode({
				collaborationActive: true,
				isDocumentOwner: true,
				canPersistCanonical: true,
			})
		).toBe('owner_idle_put');
	});

	it('manual_only for collaborator with save flag', () => {
		expect(
			resolveDocEditorCollabSaveMode({
				collaborationActive: true,
				isDocumentOwner: false,
				canPersistCanonical: true,
			})
		).toBe('manual_only');
	});

	it('yjs_only for collaborator without save', () => {
		expect(
			resolveDocEditorCollabSaveMode({
				collaborationActive: true,
				isDocumentOwner: false,
				canPersistCanonical: false,
			})
		).toBe('yjs_only');
	});
});

describe('shouldRunAutosaveCanonicalPut', () => {
	it('blocks manual_only and yjs_only', () => {
		expect(shouldRunAutosaveCanonicalPut('manual_only')).toBe(false);
		expect(shouldRunAutosaveCanonicalPut('yjs_only')).toBe(false);
	});

	it('allows owner_idle_put on force flush', () => {
		expect(
			shouldRunAutosaveCanonicalPut('owner_idle_put', {
				forceOwnerFlush: true,
			})
		).toBe(true);
	});
});

describe('autosaveDebounceMsForMode', () => {
	it('uses idle ms for owner in collab', () => {
		expect(autosaveDebounceMsForMode('owner_idle_put')).toBe(
			DOC_EDITOR_COLLAB_IDLE_CANONICAL_MS
		);
		expect(autosaveDebounceMsForMode('normal')).toBe(
			DOC_EDITOR_AUTOSAVE_DEBOUNCE_MS
		);
	});
});

describe('saveActionTooltipKeyForMode', () => {
	it('commit label for manual_only', () => {
		expect(saveActionTooltipKeyForMode('manual_only')).toBe(
			'header.save.tooltipCollabCommit'
		);
	});
});
