/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin user detail i18n helpers.
 */

import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
	adminUserDetailSsoEventLabelI18n,
	adminUserDetailTabLabelI18n,
} from '../adminUserDetailI18n';

const t = ((key: string) =>
	(
		({
			'adminUserDetail.tabs.overview': 'Обзор',
			'adminUserDetail.tabs.sessions': 'Сессии',
			'adminUserDetail.sso.events.sso_login_seen': 'Вход (новая сессия)',
		}) as Record<string, string>
	)[key] ?? key) as TFunction;

describe('adminUserDetailI18n', () => {
	it('resolves tab labels', () => {
		expect(adminUserDetailTabLabelI18n('overview', t)).toBe('Обзор');
		expect(adminUserDetailTabLabelI18n('sessions', t)).toBe('Сессии');
	});

	it('resolves known SSO event labels', () => {
		expect(adminUserDetailSsoEventLabelI18n('sso_login_seen', t)).toBe(
			'Вход (новая сессия)'
		);
	});

	it('falls back to raw event type for unknown events', () => {
		expect(adminUserDetailSsoEventLabelI18n('custom_event', t)).toBe(
			'custom_event'
		);
	});
});
