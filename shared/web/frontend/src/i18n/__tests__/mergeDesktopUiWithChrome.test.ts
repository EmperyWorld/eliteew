/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import { mergeDesktopUiWithChrome } from '../mergeDesktopUiWithChrome';

describe('mergeDesktopUiWithChrome', () => {
	it('deep-merges workspace while letting chrome win on leaf collision', () => {
		const merged = mergeDesktopUiWithChrome(
			{
				workspace: { openingDesktop: 'from-ui', loading: 'from-ui-load' },
				settingsPanel: { title: 'Settings' },
			},
			{
				workspace: { openingDesktop: 'from-chrome' },
				taskbar: { startTooltip: 'Start' },
			}
		);
		expect(merged.workspace).toEqual({
			openingDesktop: 'from-chrome',
			loading: 'from-ui-load',
		});
		expect(merged.settingsPanel).toEqual({ title: 'Settings' });
		expect(merged.taskbar).toEqual({ startTooltip: 'Start' });
	});
});
