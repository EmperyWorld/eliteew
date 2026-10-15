/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for companion reactive chrome intensity and palette amplification.
 */

import { describe, expect, it } from 'vitest';

import {
	applyCompanionWorkIntensityToPalette,
	buildCompanionPresencePalette,
} from '@/features/ewa/companionPresence/companionMoodPalette';
import {
	computeCompanionWorkIntensity,
	isCompanionPresenceAtRest,
	isCompanionWorkChromeActive,
} from '@/features/ewa/companionPresence/companionReactiveChrome';
import { isEwaCompanionReactiveChromeEnabled } from '@/features/ewa/ewaCompanionReactiveChromeFeature';

describe('computeCompanionWorkIntensity', () => {
	it('returns zero when idle', () => {
		expect(
			computeCompanionWorkIntensity({
				pending: false,
				streamPhase: 'idle',
				activeOperationCount: 0,
			})
		).toBe(0);
	});

	it('ramps up for streaming and active operations', () => {
		const streaming = computeCompanionWorkIntensity({
			pending: true,
			streamPhase: 'streaming',
			activeOperationCount: 0,
		});
		const withOps = computeCompanionWorkIntensity({
			pending: false,
			streamPhase: 'idle',
			activeOperationCount: 2,
		});
		expect(streaming).toBeGreaterThan(0.5);
		expect(withOps).toBeGreaterThan(0.5);
		expect(isCompanionWorkChromeActive(withOps)).toBe(true);
	});
});

describe('isCompanionPresenceAtRest', () => {
	it('is true when foreground and no chat/ops work', () => {
		expect(
			isCompanionPresenceAtRest({
				isDesktopWindowActive: true,
				pending: false,
				streamPhase: 'idle',
				workChromeActive: false,
			})
		).toBe(true);
	});

	it('is false while streaming or backgrounded', () => {
		expect(
			isCompanionPresenceAtRest({
				isDesktopWindowActive: true,
				pending: true,
				streamPhase: 'streaming',
				workChromeActive: true,
			})
		).toBe(false);
		expect(
			isCompanionPresenceAtRest({
				isDesktopWindowActive: false,
				pending: false,
				streamPhase: 'idle',
				workChromeActive: false,
			})
		).toBe(false);
	});
});

describe('applyCompanionWorkIntensityToPalette', () => {
	it('boosts aura saturation when work intensity is high', () => {
		const base = buildCompanionPresencePalette('tala', {
			valence: 0.2,
			energy: 0.6,
			tension: 0.1,
		});
		const heated = applyCompanionWorkIntensityToPalette(base, 0.8);
		expect(heated['--companion-work-intensity']).toBe('0.8');
		expect(heated['--companion-aura']).not.toBe(base['--companion-aura']);
		expect(heated['--companion-glow']).not.toBe(base['--companion-glow']);
	});

	it('keeps palette unchanged at zero intensity', () => {
		const base = buildCompanionPresencePalette('arlika', null);
		expect(applyCompanionWorkIntensityToPalette(base, 0)).toEqual({
			...base,
			'--companion-work-intensity': '0',
		});
	});
});

describe('isEwaCompanionReactiveChromeEnabled', () => {
	it('defaults to enabled when field omitted', () => {
		expect(isEwaCompanionReactiveChromeEnabled({})).toBe(true);
		expect(isEwaCompanionReactiveChromeEnabled(null)).toBe(true);
	});

	it('respects explicit false from profile', () => {
		expect(
			isEwaCompanionReactiveChromeEnabled({ reactive_chrome_enabled: false })
		).toBe(false);
	});
});
