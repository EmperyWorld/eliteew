/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overview tab for admin user detail panel: profile fields, SSO channel summary, trusted devices.
 *
 * Invariants:
 * - Socket presence and SSO registry channels are shown independently.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/adminUserDetail/AdminUserDetailPanel.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import * as React from 'react';
import type { TFunction } from 'i18next';
import { adminUserDetailSsoChannelStatusLabelI18n } from '../adminUserDetailI18n';
import { adminUserRoleLabelI18n } from '../adminUserRolesI18n';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import { formatDt, shortenUserAgent } from '../users/adminUsersFormatters';
import { AdminButton } from '../ui';

const uiCaption =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';
const uiBody =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg)]';

type TrustedDevicesQuery = UseQueryResult<
	Awaited<
		ReturnType<
			typeof import('../../../services/mobileAppApi').fetchAdminMobileTrustedDevices
		>
	>
>;

type TrustedDeviceAuditQuery = UseQueryResult<
	Awaited<
		ReturnType<
			typeof import('../../../services/mobileAppApi').fetchAdminMobileTrustedDeviceAudit
		>
	>
>;

type TrustedDeviceTransfersQuery = UseQueryResult<
	Awaited<
		ReturnType<
			typeof import('../../../services/mobileAppApi').fetchAdminMobileDeviceTransfers
		>
	>
>;

type AdminUserDetailOverviewTabProps = {
	userRow: AdminDirectoryUserRow;
	t: TFunction<'desktopUi'>;
	trustedDevicesQuery: TrustedDevicesQuery;
	trustedDeviceAuditQuery: TrustedDeviceAuditQuery;
	trustedDeviceTransfersQuery: TrustedDeviceTransfersQuery;
	approveDeviceTransferMut: UseMutationResult<
		Awaited<
			ReturnType<
				typeof import('../../../services/mobileAppApi').approveAdminMobileDeviceTransfer
			>
		>,
		Error,
		string
	>;
	rejectDeviceTransferMut: UseMutationResult<
		Awaited<
			ReturnType<
				typeof import('../../../services/mobileAppApi').rejectAdminMobileDeviceTransfer
			>
		>,
		Error,
		string
	>;
};

export function AdminUserDetailOverviewTab({
	userRow,
	t,
	trustedDevicesQuery,
	trustedDeviceAuditQuery,
	trustedDeviceTransfersQuery,
	approveDeviceTransferMut,
	rejectDeviceTransferMut,
}: AdminUserDetailOverviewTabProps): React.ReactElement {
	return (
		<section>
			<h3 className={`${uiCaption} mb-2`}>
				{t('adminUserDetail.overview.title')}
			</h3>
			<div className={`${uiBody} space-y-1`}>
				<p>
					<span className="text-[var(--admin-ui-fg-muted)]">
						{t('adminUserDetail.overview.id')}
					</span>{' '}
					<span className="font-mono text-xs">{userRow.id}</span>
				</p>
				<p>
					<span className="text-[var(--admin-ui-fg-muted)]">
						{t('adminUserDetail.overview.role')}
					</span>{' '}
					{adminUserRoleLabelI18n(userRow.role, t)}
					<span className="text-[var(--admin-ui-fg-dim)] font-mono text-[10px] ml-1">
						({userRow.role})
					</span>
				</p>
				<p>
					<span className="text-[var(--admin-ui-fg-muted)]">
						{t('adminUserDetail.overview.registered')}
					</span>{' '}
					{formatDt(userRow.created_at)}
				</p>
				<p>
					<span className="text-[var(--admin-ui-fg-muted)]">
						{t('adminUserDetail.overview.lastLogin')}
					</span>{' '}
					{formatDt(userRow.last_login_at)}
				</p>
				<p>
					<span className="text-[var(--admin-ui-fg-muted)]">
						{t('adminUserDetail.overview.socketOnline')}
					</span>{' '}
					{userRow.presence_online
						? userRow.presence_sessions_web != null ||
							userRow.presence_sessions_mobile != null
							? t('adminUserDetail.overview.socketYesWithCounts', {
									web: userRow.presence_sessions_web ?? 0,
									mob: userRow.presence_sessions_mobile ?? 0,
								})
							: t('adminUserDetail.overview.socketYesSessions', {
									count: userRow.presence_sessions,
								})
						: t('adminUsersHub.channels.none')}
				</p>
				{userRow.sso_browser_active &&
				(userRow.presence_sessions_web ?? 0) === 0 ? (
					<p className="pl-3 text-[var(--admin-ui-fg-muted)]">
						{t('adminUserDetail.overview.ssoWebHint')}
					</p>
				) : null}
				{(userRow.presence_sessions_web ?? 0) > 1 &&
				(userRow.sso_browser_active || userRow.sso_browser_live) ? (
					<p className="pl-3 text-amber-200/80">
						{t('adminUserDetail.overview.multiWebSocketNotKeycloakHint')}
					</p>
				) : null}
				<p>
					<span className="text-[var(--admin-ui-fg-muted)]">
						{t('adminUserDetail.overview.ssoWeb')}
					</span>{' '}
					{adminUserDetailSsoChannelStatusLabelI18n(
						Boolean(userRow.sso_browser_active),
						userRow.sso_browser_live,
						t
					)}
					{userRow.sso_browser_active || userRow.sso_browser_live
						? ` · ${userRow.sso_browser_client_id ?? 'empery-web'}`
						: userRow.sso_browser_last_seen_at
							? ` ${t('adminUserDetail.overview.wasAt', {
									at: formatDt(userRow.sso_browser_last_seen_at),
								})}`
							: ''}
				</p>
				{userRow.sso_browser_ip || userRow.sso_browser_user_agent ? (
					<p className="pl-3 text-[var(--admin-ui-fg-muted)]">
						{userRow.sso_browser_ip ? `IP ${userRow.sso_browser_ip}` : null}
						{userRow.sso_browser_ip && userRow.sso_browser_user_agent
							? ' · '
							: null}
						{shortenUserAgent(userRow.sso_browser_user_agent)}
					</p>
				) : null}
				<p>
					<span className="text-[var(--admin-ui-fg-muted)]">
						{t('adminUserDetail.overview.ssoMobile')}
					</span>{' '}
					{adminUserDetailSsoChannelStatusLabelI18n(
						Boolean(userRow.sso_mobile_active),
						userRow.sso_mobile_live,
						t
					)}
					{userRow.sso_mobile_active || userRow.sso_mobile_live
						? ` · ${userRow.sso_mobile_client_id ?? 'empery-mobile'}`
						: userRow.sso_mobile_last_seen_at
							? ` ${t('adminUserDetail.overview.wasAtFem', {
									at: formatDt(userRow.sso_mobile_last_seen_at),
								})}`
							: ''}
				</p>
				{userRow.sso_mobile_ip || userRow.sso_mobile_user_agent ? (
					<p className="pl-3 text-[var(--admin-ui-fg-muted)]">
						{userRow.sso_mobile_ip ? `IP ${userRow.sso_mobile_ip}` : null}
						{userRow.sso_mobile_ip && userRow.sso_mobile_user_agent
							? ' · '
							: null}
						{shortenUserAgent(userRow.sso_mobile_user_agent)}
					</p>
				) : null}
				<div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
								Trusted mobile devices
							</p>
							<p className="mt-1 text-xs text-slate-400">
								Registry for VPN device trust and future GAF E2EE.
							</p>
						</div>
						<span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">
							{trustedDevicesQuery.data?.items.length ?? 0} devices
						</span>
					</div>
					<div className="mt-3 space-y-2">
						{trustedDevicesQuery.isLoading ? (
							<p className="text-xs text-slate-500">Loading devices…</p>
						) : trustedDevicesQuery.isError ? (
							<p className="text-xs text-rose-300">
								Trusted-device registry is unavailable.
							</p>
						) : (trustedDevicesQuery.data?.items.length ?? 0) > 0 ? (
							trustedDevicesQuery.data?.items.map((device) => (
								<div
									key={device.id}
									className="rounded-lg border border-white/10 bg-black/15 p-2"
								>
									<p className="text-xs font-medium text-slate-200">
										{device.device_label} · {device.status}
									</p>
									<p className="mt-0.5 text-[11px] text-slate-500">
										WG {device.wg_assigned_ip ?? '—'} · GAF{' '}
										{device.gaf_public_key_fingerprint ? 'ready' : 'not ready'}{' '}
										· {formatDt(device.approved_at)}
									</p>
								</div>
							))
						) : (
							<p className="text-xs text-slate-500">
								No trusted mobile devices.
							</p>
						)}
					</div>
					<div className="mt-3 border-t border-white/10 pt-3">
						<div className="flex items-center justify-between gap-3">
							<p className="text-xs font-medium text-slate-300">
								Trusted-device transfer queue
							</p>
							<span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-100">
								{trustedDeviceTransfersQuery.data?.items.length ?? 0} transfers
							</span>
						</div>
						{trustedDeviceTransfersQuery.isLoading ? (
							<p className="mt-1 text-xs text-slate-500">Loading transfers…</p>
						) : trustedDeviceTransfersQuery.isError ? (
							<p className="mt-1 text-xs text-rose-300">
								Transfer queue is unavailable.
							</p>
						) : (trustedDeviceTransfersQuery.data?.items.length ?? 0) > 0 ? (
							<div className="mt-2 space-y-2">
								{trustedDeviceTransfersQuery.data?.items
									.slice(0, 5)
									.map((transfer) => (
										<div
											key={transfer.id}
											className="rounded-lg border border-white/10 bg-black/15 p-2"
										>
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<p className="truncate text-xs font-medium text-slate-200">
														{transfer.status} ·{' '}
														{transfer.transfer_public_key_algorithm}
													</p>
													<p className="mt-0.5 text-[11px] text-slate-500">
														Old {transfer.old_device_id ?? '—'} → new{' '}
														{transfer.new_device_id ?? '—'}
													</p>
													<p className="mt-0.5 text-[11px] text-slate-500">
														Expires {formatDt(transfer.expires_at)}
													</p>
												</div>
												{transfer.status === 'pending_admin' ? (
													<div className="flex shrink-0 gap-1">
														<AdminButton
															variant="secondary"
															className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100 hover:bg-emerald-500/15"
															disabled={
																approveDeviceTransferMut.isPending ||
																rejectDeviceTransferMut.isPending
															}
															onClick={() =>
																approveDeviceTransferMut.mutate(transfer.id)
															}
														>
															Approve
														</AdminButton>
														<AdminButton
															variant="secondary"
															className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-500/15"
															disabled={
																approveDeviceTransferMut.isPending ||
																rejectDeviceTransferMut.isPending
															}
															onClick={() =>
																rejectDeviceTransferMut.mutate(transfer.id)
															}
														>
															Reject
														</AdminButton>
													</div>
												) : null}
											</div>
										</div>
									))}
							</div>
						) : (
							<p className="mt-1 text-xs text-slate-500">
								No transfer requests.
							</p>
						)}
					</div>
					<div className="mt-3 border-t border-white/10 pt-3">
						<p className="text-xs font-medium text-slate-300">
							Latest trusted-device audit
						</p>
						{trustedDeviceAuditQuery.isLoading ? (
							<p className="mt-1 text-xs text-slate-500">Loading audit…</p>
						) : trustedDeviceAuditQuery.isError ? (
							<p className="mt-1 text-xs text-rose-300">
								Audit is unavailable.
							</p>
						) : (trustedDeviceAuditQuery.data?.items.length ?? 0) > 0 ? (
							<ul className="mt-2 space-y-1">
								{trustedDeviceAuditQuery.data?.items
									.slice(0, 5)
									.map((event) => (
										<li
											key={event.id}
											className="flex items-center justify-between gap-2 text-[11px]"
										>
											<span className="text-slate-300">
												{event.event_type} · {event.result}
											</span>
											<span className="shrink-0 text-slate-500">
												{formatDt(event.created_at)}
											</span>
										</li>
									))}
							</ul>
						) : (
							<p className="mt-1 text-xs text-slate-500">No audit events.</p>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
