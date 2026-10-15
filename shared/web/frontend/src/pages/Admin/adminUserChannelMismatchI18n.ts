/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n labels for admin Users channel mismatch kinds.
 */

import type { TFunction } from 'i18next';
import type { AdminUserChannelMismatchKind } from './adminUserChannelMismatch';

export function adminUserChannelMismatchLabelI18n(
	kind: AdminUserChannelMismatchKind,
	t: TFunction
): string {
	return kind === 'sso_browser_without_socket'
		? t('adminUsersHub.channels.mismatchSsoWithoutSocket')
		: t('adminUsersHub.channels.mismatchSocketWithoutSso');
}
