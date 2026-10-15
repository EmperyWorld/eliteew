/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests Visual Studio preset meta formatter.
 */

import { describe, expect, it } from 'vitest';
import { createDesktopUiTFunction } from '../../__fixtures__/desktopTestHelpers';
import {
	buildVisualStudioPresetMetaLine,
	hasVisualStudioPresetMeta,
} from '../desktopVisualStudioMeta';

describe('desktopVisualStudioMeta', () => {
	const t = createDesktopUiTFunction();

	it('hasVisualStudioPresetMeta detects studio fields', () => {
		expect(hasVisualStudioPresetMeta({})).toBe(false);
		expect(
			hasVisualStudioPresetMeta({ fontDisplay: 'system', sceneDepth: 'soft' })
		).toBe(true);
		expect(hasVisualStudioPresetMeta({ fontDisplay: 'system' })).toBe(false);
	});

	it('buildVisualStudioPresetMetaLine joins labels', () => {
		const line = buildVisualStudioPresetMetaLine(
			{
				fontBody: 'manrope',
				fontDisplay: 'cinzel',
				sceneDepth: 'immersive',
			},
			t
		);
		expect(line).toContain('settingsPanel.visualStudio.fontBodyManrope');
		expect(line).toContain('settingsPanel.visualStudio.fontDisplayCinzel');
		expect(line).toContain('settingsPanel.visualStudio.sceneDepthImmersive');
	});
});
