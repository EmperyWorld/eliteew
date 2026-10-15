/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';

import { resolveDocEditorYjsConnectionStatus } from './docEditorYjsConnectionStatus';

describe('resolveDocEditorYjsConnectionStatus', () => {
	it('returns idle when collaboration disabled', () => {
		expect(
			resolveDocEditorYjsConnectionStatus({
				enabled: false,
				providerStatus: 'connected',
				yjsEditorReady: true,
				hasFatalError: false,
			})
		).toBe('idle');
	});

	it('returns synced when connected and editor ready', () => {
		expect(
			resolveDocEditorYjsConnectionStatus({
				enabled: true,
				providerStatus: 'connected',
				yjsEditorReady: true,
				hasFatalError: false,
			})
		).toBe('synced');
	});

	it('returns connecting while waiting for yjsEditorReady', () => {
		expect(
			resolveDocEditorYjsConnectionStatus({
				enabled: true,
				providerStatus: 'connected',
				yjsEditorReady: false,
				hasFatalError: false,
			})
		).toBe('connecting');
	});

	it('returns reconnecting on disconnected provider', () => {
		expect(
			resolveDocEditorYjsConnectionStatus({
				enabled: true,
				providerStatus: 'disconnected',
				yjsEditorReady: true,
				hasFatalError: false,
			})
		).toBe('reconnecting');
	});

	it('returns offline on fatal error', () => {
		expect(
			resolveDocEditorYjsConnectionStatus({
				enabled: true,
				providerStatus: 'connected',
				yjsEditorReady: false,
				hasFatalError: true,
			})
		).toBe('offline');
	});
});
