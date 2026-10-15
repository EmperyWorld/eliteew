/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin presence channel summary helpers.
 *
 * Related:
 * - `pages/Admin/adminUserPresenceSummary.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	multiWebSocketIsNotKeycloakFailure,
	presenceAnomaly,
	ssoBrowserChannelHealthy,
	summarizePresenceChannels,
} from '../adminUserPresenceSummary';

describe('adminUserPresenceSummary', () => {
	it('flags multi web socket as anomaly', () => {
		expect(presenceAnomaly({ presence_sessions_web: 2 })).toBe(true);
		expect(presenceAnomaly({ presence_sessions_web: 1 })).toBe(false);
	});

	it('treats multi web Socket.IO as not a Keycloak failure', () => {
		expect(
			multiWebSocketIsNotKeycloakFailure({ presence_sessions_web: 3 })
		).toBe(true);
		expect(
			multiWebSocketIsNotKeycloakFailure({ presence_sessions_web: 1 })
		).toBe(false);
	});

	it('marks anomalyNotKeycloak when SSO browser is healthy', () => {
		const s = summarizePresenceChannels({
			presence_online: true,
			presence_sessions_web: 3,
			presence_sessions_mobile: 0,
			sso_browser_active: true,
			sso_browser_live: true,
		});
		expect(s.anomaly).toBe(true);
		expect(s.anomalyNotKeycloak).toBe(true);
		expect(
			ssoBrowserChannelHealthy({
				sso_browser_active: true,
			})
		).toBe(true);
		expect(
			summarizePresenceChannels({
				presence_sessions_web: 2,
				sso_browser_active: false,
				sso_browser_live: false,
			}).anomalyNotKeycloak
		).toBe(false);
	});

	it('counts live channels', () => {
		const s = summarizePresenceChannels({
			presence_online: true,
			presence_sessions_web: 1,
			presence_sessions_mobile: 0,
			sso_browser_live: true,
			sso_mobile_live: false,
		});
		expect(s.liveCount).toBe(2);
		expect(s.totalChannels).toBe(5);
		expect(s.anomaly).toBe(false);
		expect(s.anomalyNotKeycloak).toBe(false);
	});
});
