/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n helpers for admin user detail side panel (tabs, SSO labels, channel status).
 *
 * Related:
 * - `pages/Admin/AdminUserDetailPanel.tsx`
 * - `pages/Admin/adminUsersDetailTab.ts`
 */

import type { TFunction } from 'i18next';
import type { AdminUserDetailTab } from './adminUsersDetailTab';

const SSO_EVENT_KEYS = new Set([
	'sso_login_seen',
	'sso_session_replaced',
	'sso_session_rejected',
	'mobile_apk_downloaded',
]);

export function adminUserDetailTabLabelI18n(
	tab: AdminUserDetailTab,
	t: TFunction
): string {
	return t(`adminUserDetail.tabs.${tab}`);
}

export function adminUserDetailSsoEventLabelI18n(
	eventType: string,
	t: TFunction
): string {
	if (!SSO_EVENT_KEYS.has(eventType)) return eventType;
	return t(`adminUserDetail.sso.events.${eventType}`);
}

export function adminUserDetailClientClassLabelI18n(
	clientClass: string | null | undefined,
	t: TFunction
): string {
	if (clientClass === 'mobile')
		return t('adminUserDetail.sso.clientClass.mobile');
	if (clientClass === 'browser')
		return t('adminUserDetail.sso.clientClass.browser');
	if (clientClass === 'desktop')
		return t('adminUserDetail.sso.clientClass.desktop');
	return clientClass ?? '—';
}

export function adminUserDetailSsoChannelStatusLabelI18n(
	active: boolean,
	live: boolean | undefined,
	t: TFunction
): string {
	if (live) return t('adminUsersHub.channels.online');
	if (active) return t('adminUsersHub.channels.recent');
	return t('adminUsersHub.channels.none');
}
