/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests desktop settings card motion helper.
 */

import { describe, expect, it } from 'vitest';
import { desktopSettingsCardMotionProps } from '../desktopSettingsCardMotion';

describe('desktopSettingsCardMotionProps', () => {
	it('returns static props when reduceMotion', () => {
		const props = desktopSettingsCardMotionProps(0.12, true);
		expect(props.initial).toEqual({ opacity: 1, y: 0 });
		expect(props.transition.duration).toBe(0);
	});

	it('applies delay when motion enabled', () => {
		const props = desktopSettingsCardMotionProps(0.08, false);
		expect(props.initial.y).toBe(10);
		expect(props.transition.delay).toBe(0.08);
	});
});
