/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for EWRP mini status bar editor action gates.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `ewrpMiniStatusEditorActions.ts`
 */

import { describe, expect, it } from 'vitest';
import { ewrpMiniStatusEditorActionsEnabled } from './ewrpMiniStatusEditorActions';

describe('ewrpMiniStatusEditorActionsEnabled', () => {
	it('enables save only when draft is dirty and not busy', () => {
		expect(
			ewrpMiniStatusEditorActionsEnabled({
				draftIsDirty: true,
				saving: false,
				slideRebuildInProgress: false,
			})
		).toEqual({ save: true, cancel: true });
	});

	it('disables save when draft is clean', () => {
		expect(
			ewrpMiniStatusEditorActionsEnabled({
				draftIsDirty: false,
				saving: false,
				slideRebuildInProgress: false,
			})
		).toEqual({ save: false, cancel: true });
	});

	it('blocks both actions during save or rebuild', () => {
		expect(
			ewrpMiniStatusEditorActionsEnabled({
				draftIsDirty: true,
				saving: true,
				slideRebuildInProgress: false,
			})
		).toEqual({ save: false, cancel: false });
		expect(
			ewrpMiniStatusEditorActionsEnabled({
				draftIsDirty: true,
				saving: false,
				slideRebuildInProgress: true,
			})
		).toEqual({ save: false, cancel: false });
	});
});
