import { describe, expect, it } from 'vitest';
import {
	curatedLayoutZones,
	DESKTOP_CURATED_WORKSPACE_LAYOUTS,
} from '../desktopCuratedWorkspaceLayoutTemplates';

describe('desktopCuratedWorkspaceLayoutTemplates', () => {
	it('exports three presets with ids and zone counts', () => {
		expect(DESKTOP_CURATED_WORKSPACE_LAYOUTS).toHaveLength(3);
		const ids = DESKTOP_CURATED_WORKSPACE_LAYOUTS.map((x) => x.id);
		expect(ids).toEqual(['halfHorizontal', 'thirdsHorizontal', 'gridQuarters']);
		expect(
			DESKTOP_CURATED_WORKSPACE_LAYOUTS.map((row) => row.zones.length)
		).toEqual([2, 3, 4]);
	});

	it('curatedLayoutZones returns concrete zones per id', () => {
		expect(curatedLayoutZones('halfHorizontal')).toEqual(['left', 'right']);
		expect(curatedLayoutZones('thirdsHorizontal')).toEqual([
			'left-third',
			'center-third',
			'right-third',
		]);
		expect(curatedLayoutZones('gridQuarters')).toEqual([
			'top-left',
			'top-right',
			'bottom-left',
			'bottom-right',
		]);
	});
});
