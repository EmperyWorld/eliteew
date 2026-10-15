/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin user channel mismatch heuristics.
 */

import { describe, expect, it } from 'vitest';
import {
	adminUserChannelMismatchLabel,
	detectAdminUserChannelMismatch,
} from '../adminUserChannelMismatch';

describe('adminUserChannelMismatch', () => {
	it('detects SSO browser without socket', () => {
		expect(
			detectAdminUserChannelMismatch({
				sso_browser_active: true,
				presence_online: false,
				presence_sessions_web: 0,
			})
		).toBe('sso_browser_without_socket');
	});

	it('detects socket without SSO browser', () => {
		expect(
			detectAdminUserChannelMismatch({
				presence_online: true,
				presence_sessions_web: 1,
				sso_browser_active: false,
			})
		).toBe('socket_without_sso_browser');
	});

	it('returns null when aligned', () => {
		expect(
			detectAdminUserChannelMismatch({
				presence_online: true,
				presence_sessions_web: 1,
				sso_browser_active: true,
			})
		).toBeNull();
	});

	it('labels mismatch kinds', () => {
		expect(
			adminUserChannelMismatchLabel('sso_browser_without_socket')
		).toContain('SSO');
	});
});
