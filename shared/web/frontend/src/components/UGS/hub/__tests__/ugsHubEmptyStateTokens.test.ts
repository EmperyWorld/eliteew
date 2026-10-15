import { describe, expect, it } from 'vitest';

import {
	ugsHubEmptyStatePanelClasses,
	ugsHubInlineLoadingPanelClasses,
} from '../ugsHubSharedUi';

describe('ugsHub empty/loading tokens', () => {
	it('empty state panel uses dashed border in light theme', () => {
		const cls = ugsHubEmptyStatePanelClasses('light');
		expect(cls).toContain('border-dashed');
		expect(cls).toContain('desktop-surface');
	});

	it('inline loading panel uses desktop surface tokens', () => {
		const light = ugsHubInlineLoadingPanelClasses('light');
		const dark = ugsHubInlineLoadingPanelClasses('dark');
		expect(light).toContain('desktop-surface-panel');
		expect(dark).toContain('desktop-surface-panel');
		expect(light).toEqual(dark);
	});
});
