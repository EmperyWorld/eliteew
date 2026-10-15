/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sessions tab for admin user detail panel: Socket.IO commands and SSO session/history table.
 *
 * Invariants:
 * - SSO history surfaces security events without exposing tokens.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/adminUserDetail/AdminUserDetailPanel.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import {
	ArrowPathIcon,
	ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import type { UseQueryResult } from '@tanstack/react-query';
import * as React from 'react';
import type { TFunction } from 'i18next';
import { adminApi } from '../../../services/admin/api';
import {
	adminUserDetailClientClassLabelI18n,
	adminUserDetailSsoEventLabelI18n,
} from '../adminUserDetailI18n';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import {
	formatDt,
	primaryName,
	shortenUserAgent,
} from '../users/adminUsersFormatters';
import { AdminButton } from '../ui';
import type { PendingPresence } from './types';

const uiCaption =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';
const uiBody =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg)]';

type SsoOverview = Awaited<ReturnType<typeof adminApi.getUserSsoOverview>>;

type AdminUserDetailSessionsTabProps = {
	userRow: AdminDirectoryUserRow;
	t: TFunction<'desktopUi'>;
	ssoOverview: UseQueryResult<SsoOverview>;
	saving: boolean;
	presenceBusy: boolean;
	setPendingPresence: (value: PendingPresence | null) => void;
};

export function AdminUserDetailSessionsTab({
	userRow,
	t,
	ssoOverview,
	saving,
	presenceBusy,
	setPendingPresence,
}: AdminUserDetailSessionsTabProps): React.ReactElement {
	return (
		<>
			{userRow.presence_online ? (
				<section>
					<h3 className={`${uiCaption} mb-2`}>
						{t('adminUserDetail.sessions.socketCommands')}
					</h3>
					<div className="flex flex-wrap gap-2">
						<AdminButton
							variant="secondary"
							onClick={() =>
								setPendingPresence({
									userId: userRow.id,
									action: 'reload',
									label: primaryName(userRow),
								})
							}
							disabled={saving || presenceBusy}
						>
							<ArrowPathIcon className="h-4 w-4" />
							{t('adminUserDetail.sessions.reloadConnections')}
						</AdminButton>
						<AdminButton
							variant="secondary"
							onClick={() =>
								setPendingPresence({
									userId: userRow.id,
									action: 'logout',
									label: primaryName(userRow),
								})
							}
							disabled={saving || presenceBusy}
							className="border border-amber-500/35 bg-amber-500/15 text-amber-100"
						>
							<ArrowRightStartOnRectangleIcon className="h-4 w-4" />
							{t('adminUserDetail.sessions.logout')}
						</AdminButton>
					</div>
				</section>
			) : (
				<p className={`${uiCaption} text-[var(--admin-ui-fg-dim)] mb-4`}>
					{t('adminUserDetail.sessions.socketOffline')}
				</p>
			)}

			<section>
				<h3 className={`${uiCaption} mb-2`}>
					{t('adminUserDetail.sessions.ssoTitle')}
				</h3>
				{ssoOverview.isLoading ? (
					<p className={`${uiCaption} text-[var(--admin-ui-fg-dim)]`}>
						{t('adminUserDetail.sessions.loading')}
					</p>
				) : ssoOverview.isError ? (
					<p className={`${uiCaption} text-amber-200/90`}>
						{t('adminUserDetail.sessions.ssoLoadError')}
					</p>
				) : (
					<div className="space-y-4">
						{(ssoOverview.data?.sessions?.length ?? 0) > 0 ? (
							<div className="space-y-2">
								{(ssoOverview.data?.sessions ?? []).map((session) => (
									<div
										key={`${session.client_class}-${session.session_id}`}
										className="rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-3"
									>
										<div className="flex flex-wrap items-center gap-2 mb-1">
											<span
												className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] border ${
													session.active
														? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-100'
														: 'border-[var(--admin-ui-border)] text-[var(--admin-ui-fg-muted)]'
												}`}
											>
												<span
													className={`h-1.5 w-1.5 rounded-full ${session.active ? 'bg-emerald-400' : 'bg-slate-500'}`}
													aria-hidden
												/>
												{adminUserDetailClientClassLabelI18n(
													session.client_class,
													t
												)}
											</span>
											<span className="text-[11px] text-[var(--admin-ui-fg-dim)] font-mono">
												{session.client_id}
											</span>
										</div>
										<div className={`${uiBody} space-y-0.5`}>
											<p>
												<span className="text-[var(--admin-ui-fg-muted)]">
													{t('adminUserDetail.sessions.firstLogin')}
												</span>{' '}
												{formatDt(session.first_seen_at)}
											</p>
											<p>
												<span className="text-[var(--admin-ui-fg-muted)]">
													{t('adminUserDetail.sessions.lastActivity')}
												</span>{' '}
												{formatDt(session.last_seen_at)}
											</p>
											<p>
												<span className="text-[var(--admin-ui-fg-muted)]">
													{t('adminUserDetail.sessions.historyIp')}:
												</span>{' '}
												{session.ip_address ?? t('adminCommon.emDash')}
											</p>
											<p
												className="truncate"
												title={session.user_agent ?? undefined}
											>
												<span className="text-[var(--admin-ui-fg-muted)]">
													{t('adminUserDetail.sessions.historyUserAgent')}:
												</span>{' '}
												{shortenUserAgent(session.user_agent)}
											</p>
										</div>
									</div>
								))}
							</div>
						) : (
							<p className={`${uiCaption} text-[var(--admin-ui-fg-dim)]`}>
								{t('adminUserDetail.sessions.noSessions')}
							</p>
						)}

						{(ssoOverview.data?.history?.length ?? 0) > 0 ? (
							<div className="overflow-x-auto rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)]">
								<table className="w-full min-w-xl text-left text-xs">
									<thead>
										<tr className="border-b border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)]">
											<th className="p-2 pl-3 text-[var(--admin-ui-fg-muted)] font-normal">
												{t('adminUserDetail.sessions.historyWhen')}
											</th>
											<th className="p-2 text-[var(--admin-ui-fg-muted)] font-normal">
												{t('adminUserDetail.sessions.historyEvent')}
											</th>
											<th className="p-2 text-[var(--admin-ui-fg-muted)] font-normal">
												{t('adminUserDetail.sessions.historyChannel')}
											</th>
											<th className="p-2 text-[var(--admin-ui-fg-muted)] font-normal">
												{t('adminUserDetail.sessions.historyKcClient')}
											</th>
											<th className="p-2 text-[var(--admin-ui-fg-muted)] font-normal">
												{t('adminUserDetail.sessions.historyIp')}
											</th>
											<th className="p-2 pr-3 text-[var(--admin-ui-fg-muted)] font-normal">
												{t('adminUserDetail.sessions.historyUserAgent')}
											</th>
										</tr>
									</thead>
									<tbody>
										{(ssoOverview.data?.history ?? []).map((event) => (
											<tr
												key={`${event.created_at ?? 'na'}-${event.event_type}-${event.session_id ?? event.ip_address ?? 'row'}`}
												className="border-b border-[var(--admin-ui-border)]/50"
											>
												<td className="p-2 pl-3 text-[var(--admin-ui-fg)] whitespace-nowrap">
													{formatDt(event.created_at)}
												</td>
												<td className="p-2 text-[var(--admin-ui-fg)]">
													{adminUserDetailSsoEventLabelI18n(
														event.event_type,
														t
													)}
												</td>
												<td className="p-2 text-[var(--admin-ui-fg)]">
													{adminUserDetailClientClassLabelI18n(
														event.client_class,
														t
													)}
												</td>
												<td className="p-2 text-[var(--admin-ui-fg-muted)] font-mono text-[10px]">
													{event.client_id ?? '—'}
												</td>
												<td className="p-2 text-[var(--admin-ui-fg-muted)] font-mono">
													{event.ip_address ?? '—'}
												</td>
												<td
													className="p-2 pr-3 text-[var(--admin-ui-fg-dim)] max-w-56 truncate"
													title={event.user_agent ?? undefined}
												>
													{shortenUserAgent(event.user_agent)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : null}
					</div>
				)}
			</section>
		</>
	);
}
