/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks Escape unwind order for Start Menu progressive layers
 * (search → workAdvanced → libraryDiscovery → moreTabs → shortcuts).
 *
 * Related:
 * - ../useStartMenuKeyboard.ts
 */

import { describe, expect, it, vi } from 'vitest';
import { unwindStartMenuEscapeLayer } from '../useStartMenuKeyboard';

function makeActions() {
	return {
		clearSearch: vi.fn(),
		setShowWorkAdvanced: vi.fn(),
		setShowLibraryDiscovery: vi.fn(),
		setShowMoreTabs: vi.fn(),
		setShowShortcuts: vi.fn(),
	};
}

describe('unwindStartMenuEscapeLayer', () => {
	it('clears search before any disclosure layer', () => {
		const actions = makeActions();
		const handled = unwindStartMenuEscapeLayer(
			{
				search: 'query',
				showWorkAdvanced: true,
				showLibraryDiscovery: true,
				showMoreTabs: true,
				showShortcuts: true,
			},
			actions
		);
		expect(handled).toBe(true);
		expect(actions.clearSearch).toHaveBeenCalledOnce();
		expect(actions.setShowWorkAdvanced).not.toHaveBeenCalled();
		expect(actions.setShowLibraryDiscovery).not.toHaveBeenCalled();
		expect(actions.setShowMoreTabs).not.toHaveBeenCalled();
		expect(actions.setShowShortcuts).not.toHaveBeenCalled();
	});

	it('collapses layers in order: work → library → moreTabs → shortcuts', () => {
		const actions = makeActions();
		const base = {
			search: '',
			showWorkAdvanced: true,
			showLibraryDiscovery: true,
			showMoreTabs: true,
			showShortcuts: true,
		};

		expect(unwindStartMenuEscapeLayer(base, actions)).toBe(true);
		expect(actions.setShowWorkAdvanced).toHaveBeenCalledWith(false);
		expect(actions.setShowLibraryDiscovery).not.toHaveBeenCalled();

		actions.setShowWorkAdvanced.mockClear();
		expect(
			unwindStartMenuEscapeLayer({ ...base, showWorkAdvanced: false }, actions)
		).toBe(true);
		expect(actions.setShowLibraryDiscovery).toHaveBeenCalledWith(false);
		expect(actions.setShowMoreTabs).not.toHaveBeenCalled();

		actions.setShowLibraryDiscovery.mockClear();
		expect(
			unwindStartMenuEscapeLayer(
				{ ...base, showWorkAdvanced: false, showLibraryDiscovery: false },
				actions
			)
		).toBe(true);
		expect(actions.setShowMoreTabs).toHaveBeenCalledWith(false);
		expect(actions.setShowShortcuts).not.toHaveBeenCalled();

		actions.setShowMoreTabs.mockClear();
		expect(
			unwindStartMenuEscapeLayer(
				{
					...base,
					showWorkAdvanced: false,
					showLibraryDiscovery: false,
					showMoreTabs: false,
				},
				actions
			)
		).toBe(true);
		expect(actions.setShowShortcuts).toHaveBeenCalledWith(false);
	});

	it('returns false when no layer remains (caller closes menu)', () => {
		const actions = makeActions();
		const handled = unwindStartMenuEscapeLayer(
			{
				search: '   ',
				showWorkAdvanced: false,
				showLibraryDiscovery: false,
				showMoreTabs: false,
				showShortcuts: false,
			},
			actions
		);
		expect(handled).toBe(false);
		expect(actions.clearSearch).not.toHaveBeenCalled();
		expect(actions.setShowWorkAdvanced).not.toHaveBeenCalled();
		expect(actions.setShowLibraryDiscovery).not.toHaveBeenCalled();
		expect(actions.setShowMoreTabs).not.toHaveBeenCalled();
		expect(actions.setShowShortcuts).not.toHaveBeenCalled();
	});
});
