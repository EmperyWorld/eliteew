/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin user channel mismatch i18n labels.
 */

import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { adminUserChannelMismatchLabelI18n } from '../adminUserChannelMismatchI18n';

describe('adminUserChannelMismatchLabelI18n', () => {
	const t = ((key: string) =>
		(
			({
				'adminUsersHub.channels.mismatchSsoWithoutSocket':
					'SSO web without Socket.IO',
				'adminUsersHub.channels.mismatchSocketWithoutSso':
					'Socket.IO without SSO web',
			}) as Record<string, string>
		)[key] ?? key) as TFunction;

	it('maps SSO-without-socket kind', () => {
		expect(
			adminUserChannelMismatchLabelI18n('sso_browser_without_socket', t)
		).toBe('SSO web without Socket.IO');
	});

	it('maps socket-without-SSO kind', () => {
		expect(
			adminUserChannelMismatchLabelI18n('socket_without_sso_browser', t)
		).toBe('Socket.IO without SSO web');
	});
});
