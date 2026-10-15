/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Plain-text diagnostic bundle for support tickets from admin user detail data.
 *
 * Invariants:
 * - Must not include tokens or secrets; only fields already shown in admin UI.
 *
 * Related:
 * - `pages/Admin/AdminUserDetailPanel.tsx`
 */

import type { TFunction } from 'i18next';
import { adminUserRoleLabelI18n } from './adminUserRolesI18n';
import { summarizePresenceChannels } from './adminUserPresenceSummary';
import type { AdminDirectoryUserRow } from './adminDirectoryUserTypes';

type SsoHistoryRow = {
	event_type: string;
	created_at?: string | null;
	client_class?: string | null;
	ip_address?: string | null;
};

function yn(t: TFunction<'desktopUi'>, value: boolean): string {
	return value ? t('adminDiagnosticReport.yes') : t('adminDiagnosticReport.no');
}

export function buildAdminUserDiagnosticReport(
	user: AdminDirectoryUserRow,
	t: TFunction<'desktopUi'>,
	opts?: {
		ssoHistory?: SsoHistoryRow[];
	}
): string {
	const ch = summarizePresenceChannels(user);
	const roleLabel = adminUserRoleLabelI18n(user.role, t);
	const lines = [
		t('adminDiagnosticReport.header'),
		t('adminDiagnosticReport.id', { value: user.id }),
		t('adminDiagnosticReport.email', { value: user.email }),
		t('adminDiagnosticReport.username', { value: user.username }),
		t('adminDiagnosticReport.name', { value: user.full_name ?? '—' }),
		t('adminDiagnosticReport.role', { label: roleLabel, code: user.role }),
		t('adminDiagnosticReport.flags', {
			active: yn(t, Boolean(user.is_active)),
			verified: yn(t, Boolean(user.is_verified)),
			trusted: yn(t, Boolean(user.is_trusted)),
		}),
		t('adminDiagnosticReport.shopGroup', {
			value: user.app_access_group_name ?? '—',
		}),
		t('adminDiagnosticReport.balances', {
			ew: user.ew_balance,
			ugs: user.ugs_credits,
		}),
		t('adminDiagnosticReport.registered', { value: user.created_at }),
		t('adminDiagnosticReport.lastLogin', {
			value: user.last_login_at ?? '—',
		}),
		t('adminDiagnosticReport.channelsHeader'),
		t('adminDiagnosticReport.socketIo', {
			online: yn(t, Boolean(user.presence_online)),
			web: user.presence_sessions_web ?? 0,
			mobile: user.presence_sessions_mobile ?? 0,
		}),
		t('adminDiagnosticReport.ssoBrowser', {
			status: user.sso_browser_active
				? t('adminDiagnosticReport.active')
				: t('adminDiagnosticReport.inactive'),
			live: user.sso_browser_live ? t('adminDiagnosticReport.liveSuffix') : '',
			ip: user.sso_browser_ip
				? t('adminDiagnosticReport.ipSuffix', { ip: user.sso_browser_ip })
				: '',
		}),
		t('adminDiagnosticReport.ssoMobile', {
			status: user.sso_mobile_active
				? t('adminDiagnosticReport.active')
				: t('adminDiagnosticReport.inactive'),
			live: user.sso_mobile_live ? t('adminDiagnosticReport.liveSuffix') : '',
			ip: user.sso_mobile_ip
				? t('adminDiagnosticReport.ipSuffix', { ip: user.sso_mobile_ip })
				: '',
		}),
		t('adminDiagnosticReport.summary', {
			live: ch.liveCount,
			total: ch.totalChannels,
			anomaly: ch.anomaly
				? ch.anomalyNotKeycloak
					? t('adminDiagnosticReport.anomalyNotKeycloak')
					: t('adminDiagnosticReport.anomaly')
				: '',
		}),
	];
	const history = opts?.ssoHistory ?? [];
	if (history.length > 0) {
		lines.push(t('adminDiagnosticReport.ssoHistoryHeader'));
		for (const ev of history.slice(0, 8)) {
			lines.push(
				`${ev.created_at ?? '—'} | ${ev.event_type} | ${ev.client_class ?? '—'} | ${ev.ip_address ?? '—'}`
			);
		}
	}
	lines.push(t('adminDiagnosticReport.footer'));
	return lines.join('\n');
}
