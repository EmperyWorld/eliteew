/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock launcher Step FSM — retail sealed never routes to Channel/License editors.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEBUG_OPS_KEY } from './retailSealed';
import {
	isStepReachable,
	launcherStepsForUi,
	nextStepAfterSeatImport,
	STEP_META,
} from './stepGates';

const store = new Map<string, string>();

beforeEach(() => {
	store.clear();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => {
			store.set(k, String(v));
		},
		removeItem: (k: string) => {
			store.delete(k);
		},
		clear: () => {
			store.clear();
		},
		key: () => null,
		length: 0,
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	store.clear();
});

describe('retail sealed step gates', () => {
	it('rail is home + shell only', () => {
		expect([...launcherStepsForUi()]).toEqual(['home', 'shell']);
	});

	it('blocks tunnel/license reachability', () => {
		expect(isStepReachable('shell', 'tunnel')).toBe(false);
		expect(isStepReachable('shell', 'license')).toBe(false);
		expect(isStepReachable('shell', 'home')).toBe(true);
	});

	it('failed redeem stays on home (not license editor)', () => {
		expect(
			nextStepAfterSeatImport({
				mode: 'cloud',
				entitlementOk: false,
				hasWgConf: true,
				redeemSucceeded: false,
				redeemAttempted: true,
			})
		).toBe('home');
	});

	it('missing conf stays on home (not tunnel editor)', () => {
		expect(
			nextStepAfterSeatImport({
				mode: 'both',
				entitlementOk: false,
				hasWgConf: false,
				redeemSucceeded: false,
				redeemAttempted: false,
			})
		).toBe('home');
	});

	it('success goes to shell', () => {
		expect(
			nextStepAfterSeatImport({
				mode: 'offline',
				entitlementOk: true,
				hasWgConf: false,
				redeemSucceeded: false,
				redeemAttempted: false,
			})
		).toBe('shell');
	});
});

describe('ops debug restores legacy rail', () => {
	it('allows tunnel when debug.ops=1', () => {
		localStorage.setItem(DEBUG_OPS_KEY, '1');
		expect(isStepReachable('license', 'tunnel')).toBe(true);
		expect(
			nextStepAfterSeatImport({
				mode: 'cloud',
				entitlementOk: false,
				hasWgConf: true,
				redeemSucceeded: false,
				redeemAttempted: true,
			})
		).toBe('license');
		expect(STEP_META.shell.index).toBe(3);
	});
});
