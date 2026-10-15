/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presence / SSO channel cells for admin Users directory table (i18n).
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { adminUserChannelMismatchLabelI18n } from '../adminUserChannelMismatchI18n';
import { detectAdminUserChannelMismatch } from '../adminUserChannelMismatch';
import { summarizePresenceChannels } from '../adminUserPresenceSummary';
import {
	channelStatusLabelI18n,
	formatRelativeActivityI18n,
} from './adminUsersFormatI18n';
import { formatDt, shortenUa } from './adminUsersFormatters';
import { useAdminUsersRelativeTimeTick } from './useAdminUsersRelativeTimeTick';

export type AdminUsersChannelRow = {
	presence_online: boolean;
	presence_sessions: number;
	presence_sessions_web?: number;
	presence_sessions_mobile?: number;
	presence_last_seen_at?: string | null;
	sso_browser_active?: boolean;
	sso_mobile_active?: boolean;
	sso_desktop_active?: boolean;
	sso_fofline_active?: boolean;
	sso_browser_live?: boolean;
	sso_mobile_live?: boolean;
	sso_desktop_live?: boolean;
	sso_fofline_live?: boolean;
	sso_browser_client_id?: string | null;
	sso_mobile_client_id?: string | null;
	sso_desktop_client_id?: string | null;
	sso_fofline_client_id?: string | null;
	sso_browser_last_seen_at?: string | null;
	sso_mobile_last_seen_at?: string | null;
	sso_desktop_last_seen_at?: string | null;
	sso_fofline_last_seen_at?: string | null;
	sso_browser_ip?: string | null;
	sso_mobile_ip?: string | null;
	sso_desktop_ip?: string | null;
	sso_fofline_ip?: string | null;
	sso_browser_user_agent?: string | null;
	sso_mobile_user_agent?: string | null;
	sso_desktop_user_agent?: string | null;
	sso_fofline_user_agent?: string | null;
	desktop_license_label?: string | null;
	desktop_peer_slug?: string | null;
	desktop_app_version?: string | null;
	desktop_wg_up?: boolean | null;
};

function formatActivityLine(
	lastSeen: string | null | undefined,
	t: TFunction,
	tick: number
): string | null {
	const rel = formatRelativeActivityI18n(lastSeen, t, tick);
	const value = rel ?? (lastSeen ? formatDt(lastSeen) : null);
	return value ? t('adminUsersHub.channels.activity', { value }) : null;
}

function buildSocketExtra(
	u: AdminUsersChannelRow,
	t: TFunction,
	webSock: number,
	mobSock: number,
	multiWebTab: boolean,
	browserSsoWithoutWebSocket: boolean
): string | undefined {
	if (u.presence_online) {
		if (multiWebTab) {
			return t('adminUsersHub.channels.extraMultiTab', {
				web: webSock,
				mob: mobSock,
			});
		}
		if (webSock || mobSock) {
			if (browserSsoWithoutWebSocket) {
				return t('adminUsersHub.channels.extraSsoNoSocket', {
					web: webSock,
					mob: mobSock,
				});
			}
			return t('adminUsersHub.channels.extraSessions', {
				web: webSock,
				mob: mobSock,
			});
		}
		return t('adminUsersHub.channels.extraConnCount', {
			n: u.presence_sessions,
		});
	}
	if (browserSsoWithoutWebSocket) {
		return t('adminUsersHub.channels.ssoOnlineSocketOffline');
	}
	return undefined;
}

function OnlineChannelCard({
	title,
	active,
	live,
	clientId,
	ip,
	lastSeen,
	userAgent,
	extra,
}: {
	title: string;
	active: boolean;
	live?: boolean;
	clientId?: string | null;
	ip?: string | null;
	lastSeen?: string | null;
	userAgent?: string | null;
	extra?: string | null;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const tick = useAdminUsersRelativeTimeTick();
	const uaShort = shortenUa(userAgent, 56);
	const lines = [
		clientId ? t('adminUsersHub.channels.tooltipKeycloak', { clientId }) : null,
		formatActivityLine(lastSeen, t, tick),
		uaShort
			? t('adminUsersHub.channels.tooltipUserAgent', { text: uaShort })
			: null,
		ip ? t('adminUsersHub.channels.tooltipIp', { ip }) : null,
		extra,
	].filter(Boolean) as string[];

	const isLive = Boolean(live);
	const isStale = Boolean(active) && !isLive;

	return (
		<div
			className={`rounded-md border px-2 py-1.5 text-[10px] leading-snug ${
				isLive
					? 'border-emerald-500/35 bg-emerald-500/8 text-emerald-50'
					: isStale
						? 'border-amber-500/35 bg-amber-500/8 text-amber-50'
						: 'border-white/10 bg-white/3 text-slate-500'
			}`}
			title={lines.join('\n')}
		>
			<div className="flex items-center gap-1.5 font-medium mb-0.5">
				<span
					className={`h-1.5 w-1.5 rounded-full shrink-0 ${
						isLive
							? 'bg-emerald-400'
							: isStale
								? 'bg-amber-400'
								: 'bg-slate-600'
					}`}
					aria-hidden
				/>
				<span>{title}</span>
				<span className="text-[9px] opacity-80">
					{channelStatusLabelI18n(active, live, t)}
				</span>
			</div>
			{lines.length > 0 ? (
				<div className="space-y-0.5 text-[9px] opacity-90 font-mono truncate">
					{lines.slice(0, 4).map((line) => (
						<div key={line} className="truncate">
							{line}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

export function UserOnlineChannels({
	u,
}: {
	u: AdminUsersChannelRow;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const webSock = u.presence_sessions_web ?? 0;
	const mobSock = u.presence_sessions_mobile ?? 0;
	const multiWebTab = webSock > 1;
	const browserSsoWithoutWebSocket =
		Boolean(u.sso_browser_active) && webSock === 0;
	const sockExtra = buildSocketExtra(
		u,
		t,
		webSock,
		mobSock,
		multiWebTab,
		browserSsoWithoutWebSocket
	);

	return (
		<div className="grid gap-1 min-w-52 max-w-[18rem]">
			<OnlineChannelCard
				title={t('adminUsersHub.channels.titleSocket')}
				active={Boolean(u.presence_online)}
				live={Boolean(
					u.presence_online && (webSock > 0 || mobSock > 0) && !multiWebTab
				)}
				extra={sockExtra}
				lastSeen={u.presence_last_seen_at}
			/>
			<OnlineChannelCard
				title={t('adminUsersHub.channels.titleSsoWeb')}
				active={Boolean(u.sso_browser_active)}
				live={Boolean(u.sso_browser_live)}
				clientId={u.sso_browser_client_id}
				ip={u.sso_browser_ip}
				lastSeen={u.sso_browser_last_seen_at}
				userAgent={u.sso_browser_user_agent}
			/>
			<OnlineChannelCard
				title={t('adminUsersHub.channels.titleSsoMobile')}
				active={Boolean(u.sso_mobile_active)}
				live={Boolean(u.sso_mobile_live)}
				clientId={u.sso_mobile_client_id}
				ip={u.sso_mobile_ip}
				lastSeen={u.sso_mobile_last_seen_at}
				userAgent={u.sso_mobile_user_agent}
			/>
			<OnlineChannelCard
				title={t('adminUsersHub.channels.titleSsoDesktop')}
				active={Boolean(u.sso_desktop_active)}
				live={Boolean(u.sso_desktop_live)}
				clientId={u.sso_desktop_client_id}
				ip={u.sso_desktop_ip}
				lastSeen={u.sso_desktop_last_seen_at}
				userAgent={u.sso_desktop_user_agent}
				extra={
					[
						u.desktop_license_label
							? t('adminUsersHub.channels.extraDesktopLicense', {
									label: u.desktop_license_label,
								})
							: null,
						u.desktop_peer_slug
							? t('adminUsersHub.channels.extraDesktopPeer', {
									slug: u.desktop_peer_slug,
								})
							: null,
						u.desktop_app_version
							? t('adminUsersHub.channels.extraDesktopVersion', {
									version: u.desktop_app_version,
								})
							: null,
						u.desktop_wg_up == null
							? null
							: u.desktop_wg_up
								? t('adminUsersHub.channels.extraDesktopWgUp')
								: t('adminUsersHub.channels.extraDesktopWgDown'),
					]
						.filter(Boolean)
						.join(' · ') || undefined
				}
			/>
			<OnlineChannelCard
				title={t('adminUsersHub.channels.titleSsoFofline')}
				active={Boolean(u.sso_fofline_active)}
				live={Boolean(u.sso_fofline_live)}
				clientId={u.sso_fofline_client_id}
				ip={u.sso_fofline_ip}
				lastSeen={u.sso_fofline_last_seen_at}
				userAgent={u.sso_fofline_user_agent}
			/>
		</div>
	);
}

export function UserOnlineChannelsCompact({
	u,
}: {
	u: AdminUsersChannelRow;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const webSock = u.presence_sessions_web ?? 0;
	const mobSock = u.presence_sessions_mobile ?? 0;
	const multiWebTab = webSock > 1;
	const sockLive = Boolean(
		u.presence_online && (webSock > 0 || mobSock > 0) && !multiWebTab
	);
	const { liveCount, totalChannels, anomaly, anomalyNotKeycloak } =
		summarizePresenceChannels(u);
	const channelMismatch = detectAdminUserChannelMismatch(u);
	const sockStatus = channelStatusLabelI18n(
		Boolean(u.presence_online),
		sockLive,
		t
	);
	const channels: Array<{
		key: string;
		live: boolean;
		stale: boolean;
		hint: string;
	}> = [
		{
			key: 'sock',
			live: sockLive,
			stale: Boolean(u.presence_online) && !sockLive,
			hint: t('adminUsersHub.channels.hintSocket', {
				status: sockStatus,
				extra: multiWebTab
					? t('adminUsersHub.channels.webCount', { n: webSock })
					: '',
			}),
		},
		{
			key: 'sso-web',
			live: Boolean(u.sso_browser_live),
			stale: Boolean(u.sso_browser_active) && !u.sso_browser_live,
			hint: t('adminUsersHub.channels.hintSsoWeb', {
				status: channelStatusLabelI18n(
					Boolean(u.sso_browser_active),
					u.sso_browser_live,
					t
				),
			}),
		},
		{
			key: 'sso-mob',
			live: Boolean(u.sso_mobile_live),
			stale: Boolean(u.sso_mobile_active) && !u.sso_mobile_live,
			hint: t('adminUsersHub.channels.hintSsoMobile', {
				status: channelStatusLabelI18n(
					Boolean(u.sso_mobile_active),
					u.sso_mobile_live,
					t
				),
			}),
		},
		{
			key: 'sso-desk',
			live: Boolean(u.sso_desktop_live),
			stale: Boolean(u.sso_desktop_active) && !u.sso_desktop_live,
			hint: t('adminUsersHub.channels.hintSsoDesktop', {
				status: channelStatusLabelI18n(
					Boolean(u.sso_desktop_active),
					u.sso_desktop_live,
					t
				),
			}),
		},
		{
			key: 'sso-fof',
			live: Boolean(u.sso_fofline_live),
			stale: Boolean(u.sso_fofline_active) && !u.sso_fofline_live,
			hint: t('adminUsersHub.channels.hintSsoFofline', {
				status: channelStatusLabelI18n(
					Boolean(u.sso_fofline_active),
					u.sso_fofline_live,
					t
				),
			}),
		},
	];
	const anomalyHint = anomaly
		? anomalyNotKeycloak
			? t('adminUsersHub.channels.anomalyMultiWebNotKeycloak')
			: t('adminUsersHub.channels.anomalyMultiWeb')
		: null;
	const anomalyTitle = anomaly
		? anomalyNotKeycloak
			? t('adminUsersHub.channels.anomalyMultiWebNotKeycloakTitle')
			: t('adminUsersHub.channels.anomalyMultiWebTitle')
		: null;
	const title = [
		...channels.map((c) => c.hint),
		anomalyHint,
		channelMismatch
			? adminUserChannelMismatchLabelI18n(channelMismatch, t)
			: null,
		mobSock > 0
			? t('adminUsersHub.channels.mobSocketCount', { n: mobSock })
			: null,
	]
		.filter(Boolean)
		.join('\n');

	return (
		<div className="inline-flex items-center gap-1.5 min-w-18" title={title}>
			<span className="text-[10px] tabular-nums text-slate-500">
				{liveCount}/{totalChannels}
			</span>
			<div className="flex items-center gap-0.5">
				{channels.map((c) => (
					<span
						key={c.key}
						className={`h-2 w-2 rounded-full ${
							c.live
								? 'bg-emerald-400'
								: c.stale
									? 'bg-amber-400'
									: 'bg-slate-600'
						}`}
						aria-hidden
					/>
				))}
			</div>
			{channelMismatch ? (
				<span
					className="text-[9px] font-medium text-sky-300 max-w-20 truncate"
					title={adminUserChannelMismatchLabelI18n(channelMismatch, t)}
				>
					⇄
				</span>
			) : null}
			{anomaly ? (
				<span
					className="text-[9px] font-medium text-amber-300"
					title={anomalyTitle ?? undefined}
				>
					!
				</span>
			) : null}
		</div>
	);
}
