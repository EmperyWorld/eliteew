/**
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 */
import { describe, expect, it } from 'vitest';

import {
	desktopDeferredExpansionEqual,
	EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS,
} from '../desktopDeferredExpansionSettings';

describe('desktopDeferredExpansionEqual', () => {
	it('treats identical references as equal', () => {
		expect(
			desktopDeferredExpansionEqual(
				EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS,
				EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS
			)
		).toBe(true);
	});

	it('treats new wrapper with same shell fields as equal', () => {
		const left = EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS;
		const right = {
			...left,
			refresh: async () => {},
		};
		expect(desktopDeferredExpansionEqual(left, right)).toBe(true);
	});

	it('detects workspace profile drift', () => {
		const left = EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS;
		const right = {
			...left,
			workspaceProfiles: [
				{
					id: 'p1',
					name: 'Focus',
					appIds: [],
					folderItemIds: [],
					widgetIds: [],
				},
			],
		};
		expect(desktopDeferredExpansionEqual(left, right)).toBe(false);
	});
});
