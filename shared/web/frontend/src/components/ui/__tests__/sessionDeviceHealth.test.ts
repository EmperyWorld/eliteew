/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused contract tests for session/device health classification used by the
 * desktop tray and session panel.
 *
 * Invariants:
 * - Critical auth/server states must outrank warning states.
 * - Healthy state requires a recent successful profile probe.
 *
 * Related:
 * - `components/ui/sessionDeviceHealth.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	SESSION_CHECK_STALE_MS,
	classifySessionDeviceHealth,
	type SessionDeviceHealthSnapshot,
} from '../sessionDeviceHealth';

const NOW = 1_800_000_000_000;

function snapshot(
	patch: Partial<SessionDeviceHealthSnapshot> = {}
): SessionDeviceHealthSnapshot {
	return {
		loading: false,
		isAuthenticated: true,
		hasAccessToken: true,
		profileStatus: 'valid',
		lastCheck: NOW,
		consecutiveFailures: 0,
		tokenSecondsLeft: 3600,
		realtimeConnected: true,
		...patch,
	};
}

describe('classifySessionDeviceHealth', () => {
	it('returns healthy for a fresh valid profile, token, and realtime connection', () => {
		expect(classifySessionDeviceHealth(snapshot(), NOW)).toMatchObject({
			level: 'healthy',
			reason: 'healthy',
			serverReachable: true,
			tokenFresh: true,
			realtimeHealthy: true,
		});
	});

	it('warns when realtime updates are offline but server session is valid', () => {
		expect(
			classifySessionDeviceHealth(snapshot({ realtimeConnected: false }), NOW)
		).toMatchObject({
			level: 'warning',
			reason: 'realtimeOffline',
		});
	});

	it('warns before token expiry while the token is still usable', () => {
		expect(
			classifySessionDeviceHealth(snapshot({ tokenSecondsLeft: 120 }), NOW)
		).toMatchObject({
			level: 'warning',
			reason: 'tokenExpiring',
		});
	});

	it('escalates repeated network failures to critical', () => {
		expect(
			classifySessionDeviceHealth(
				snapshot({
					profileStatus: 'error',
					consecutiveFailures: 2,
					realtimeConnected: false,
				}),
				NOW
			)
		).toMatchObject({
			level: 'critical',
			reason: 'serverOffline',
		});
	});

	it('treats expired auth as critical even when realtime is present', () => {
		expect(
			classifySessionDeviceHealth(
				snapshot({
					profileStatus: 'expired',
					tokenSecondsLeft: -1,
					realtimeConnected: true,
				}),
				NOW
			)
		).toMatchObject({
			level: 'critical',
			reason: 'tokenExpired',
		});
	});

	it('warns when the last successful check is stale', () => {
		expect(
			classifySessionDeviceHealth(
				snapshot({ lastCheck: NOW - SESSION_CHECK_STALE_MS - 1 }),
				NOW
			)
		).toMatchObject({
			level: 'warning',
			reason: 'staleCheck',
		});
	});
});
