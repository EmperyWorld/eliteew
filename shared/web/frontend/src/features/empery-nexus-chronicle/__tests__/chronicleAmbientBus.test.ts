/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mute persistence lock for chronicle ambient bus.
 *
 * Related:
 * - audio/chronicleAmbientBus.ts
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	AMBIENT_MUTE_KEY,
	chronicleAmbientBus,
} from '../audio/chronicleAmbientBus';

describe('chronicleAmbientBus mute', () => {
	afterEach(() => {
		localStorage.removeItem(AMBIENT_MUTE_KEY);
		chronicleAmbientBus.setMuted(false);
		chronicleAmbientBus.setMode('off');
	});

	it('persists mute toggle in localStorage', () => {
		expect(chronicleAmbientBus.isMuted()).toBe(false);
		expect(chronicleAmbientBus.toggleMute()).toBe(true);
		expect(localStorage.getItem(AMBIENT_MUTE_KEY)).toBe('1');
		expect(chronicleAmbientBus.needsGesture()).toBe(false);
		expect(chronicleAmbientBus.toggleMute()).toBe(false);
		expect(localStorage.getItem(AMBIENT_MUTE_KEY)).toBe('0');
		expect(chronicleAmbientBus.needsGesture()).toBe(true);
	});
});
