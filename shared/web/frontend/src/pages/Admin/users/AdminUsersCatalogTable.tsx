/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Users directory table and pagination for admin Users hub.
 *
 * Invariants:
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ClipboardDocumentIcon,
	FunnelIcon,
	ArrowPathIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { SecureAvatar } from '../../../components/profile/SecureAvatar';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import type {
	AdminDirectorySortBy,
	AdminDirectorySortDir,
} from '../adminDirectorySort';
import { shortenAdminUserId } from '../adminUserRoles';
import { adminUserRoleLabelI18n } from '../adminUserRolesI18n';
import type { AdminUsersTableColumns } from '../adminUsersTableColumns';
import { AdminButton, adminUiTableWrapClass } from '../ui';
import { DirectorySortableTh } from './DirectorySortableTh';
import {
	UserOnlineChannels,
	UserOnlineChannelsCompact,
} from './AdminUsersChannelCells';
import {
	copyTextToClipboard,
	formatDt,
	primaryName,
} from './adminUsersFormatters';

const uiCaption =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';
const uiBody =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg)]';

export type AdminUsersCatalogTableProps = {
	loading: boolean;
	payload: { total: number; page: number } | null;
	tableList: AdminDirectoryUserRow[];
	tableColumns: AdminUsersTableColumns;
	channelsCompact: boolean;
	tableColSpan: number;
	selectedUserIds: string[];
	panelUser: AdminDirectoryUserRow | null;
	sortBy: AdminDirectorySortBy;
	sortDir: AdminDirectorySortDir;
	onSort: (key: AdminDirectorySortBy) => void;
	mismatchOnly: boolean;
	anomalyOnly: boolean;
	toggleAll: () => void;
	toggleOne: (id: string) => void;
	onOpenUser: (u: AdminDirectoryUserRow) => void;
	page: number;
	totalPages: number;
	onPageChange: (fn: (p: number) => number) => void;
};

export function AdminUsersCatalogTable(
	props: AdminUsersCatalogTableProps
): React.ReactElement {
	const {
		loading,
		payload,
		tableList,
		tableColumns,
		channelsCompact,
		tableColSpan,
		selectedUserIds,
		panelUser,
		sortBy,
		sortDir,
		onSort,
		mismatchOnly,
		anomalyOnly,
		toggleAll,
		toggleOne,
		onOpenUser,
		page,
		totalPages,
		onPageChange,
	} = props;
	const { t } = useTranslation('desktopUi');
	const emptyMessage = loading
		? t('adminUsersHub.table.loading')
		: mismatchOnly
			? t('adminUsersHub.table.emptyMismatch')
			: anomalyOnly
				? t('adminUsersHub.table.emptyAnomaly')
				: t('adminUsersHub.table.empty');
	return (
		<>
			<div className={`${adminUiTableWrapClass} overflow-hidden`}>
				{loading && !payload ? (
					<div className={`p-12 flex justify-center ${uiCaption}`}>
						<ArrowPathIcon className="w-8 h-8 animate-spin text-violet-400" />
					</div>
				) : (
					<div className="eliteew-admin-users-table-wrap overflow-x-auto">
						<table
							className={`eliteew-admin-users-table w-full text-left text-sm ${channelsCompact ? 'min-w-[72rem]' : 'min-w-[84rem]'}`}
						>
							<thead>
								<tr className="border-b border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)]">
									<th className="p-3 pl-4 w-10">
										<input
											type="checkbox"
											className="h-4 w-4 rounded border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]"
											aria-label={t('adminUsersHub.table.selectAll')}
											checked={
												tableList.length > 0 &&
												selectedUserIds.length === tableList.length
											}
											onChange={toggleAll}
										/>
									</th>
									<DirectorySortableTh
										label={t('adminUsersHub.table.user')}
										sortKey="username"
										sortBy={sortBy}
										sortDir={sortDir}
										onSort={onSort}
									/>
									{tableColumns.email ? (
										<DirectorySortableTh
											label={t('adminUsersHub.columns.email')}
											sortKey="email"
											sortBy={sortBy}
											sortDir={sortDir}
											onSort={onSort}
										/>
									) : null}
									<th className={`p-3 ${uiCaption}`}>
										{t('adminUsersHub.table.role')}
									</th>
									{tableColumns.created_at ? (
										<DirectorySortableTh
											label={t('adminUsersHub.table.createdAt')}
											sortKey="created_at"
											sortBy={sortBy}
											sortDir={sortDir}
											onSort={onSort}
											className="whitespace-nowrap"
										/>
									) : null}
									{tableColumns.last_login_at ? (
										<DirectorySortableTh
											label={t('adminUsersHub.table.lastLoginAt')}
											sortKey="last_login_at"
											sortBy={sortBy}
											sortDir={sortDir}
											onSort={onSort}
											className="whitespace-nowrap"
										/>
									) : null}
									<th
										className={`p-3 ${uiCaption}`}
										title={t('adminUsersHub.table.channelsTitle')}
									>
										<span className="inline-flex items-center gap-1">
											<FunnelIcon
												className="h-3.5 w-3.5 opacity-60"
												aria-hidden
											/>
											{t('adminUsersHub.table.channels')}
										</span>
									</th>
									{tableColumns.socket_activity ? (
										<th className={`p-3 ${uiCaption} whitespace-nowrap`}>
											{t('adminUsersHub.columns.socket_activity')}
										</th>
									) : null}
									{tableColumns.shop_group ? (
										<th className={`p-3 ${uiCaption}`}>
											{t('adminUsersHub.columns.shop_group')}
										</th>
									) : null}
									<DirectorySortableTh
										label={t('adminUsersHub.table.ewUgs')}
										sortKey="ew_balance"
										sortBy={sortBy}
										sortDir={sortDir}
										onSort={onSort}
									/>
									{tableColumns.flags ? (
										<th className={`p-3 pr-4 ${uiCaption}`}>
											{t('adminUsersHub.columns.flags')}
										</th>
									) : null}
								</tr>
							</thead>
							<tbody>
								{tableList.length === 0 ? (
									<tr>
										<td
											colSpan={tableColSpan}
											className={`p-8 text-center ${uiCaption}`}
										>
											{emptyMessage}
										</td>
									</tr>
								) : (
									tableList.map((u) => (
										<tr
											key={u.id}
											className={`cursor-pointer border-b border-[var(--admin-ui-border)] hover:bg-[var(--admin-ui-accent-soft)] ${
												panelUser?.id === u.id
													? 'bg-[var(--admin-ui-accent-soft)]'
													: ''
											}`}
											onClick={() => onOpenUser(u as AdminDirectoryUserRow)}
										>
											<td
												className="p-3 pl-4 align-middle"
												onClick={(e) => e.stopPropagation()}
												onKeyDown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.stopPropagation();
													}
												}}
											>
												<input
													type="checkbox"
													className="h-4 w-4 rounded border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]"
													checked={selectedUserIds.includes(u.id)}
													onChange={() => toggleOne(u.id)}
													aria-label={t('adminUsersHub.table.selectUser', {
														name: u.username,
													})}
												/>
											</td>
											<td className="p-3 align-middle">
												<div className="flex items-center gap-3 min-w-0 max-w-[18rem]">
													<SecureAvatar
														avatarUrl={u.avatar_url?.trim() || null}
														alt={t('adminUsersHub.table.avatarAlt', {
															name: primaryName(u),
														})}
														className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--admin-ui-border)]"
													/>
													<div className="min-w-0">
														<div
															className={`${uiBody} font-medium truncate`}
															title={primaryName(u)}
														>
															{primaryName(u)}
														</div>
														{!tableColumns.email && u.email ? (
															<div
																className={`${uiCaption} truncate`}
																title={u.email}
															>
																{u.email}
															</div>
														) : null}
														<div className="flex items-center gap-1 min-w-0">
															<span
																className={`${uiCaption} truncate font-mono`}
																title={u.id}
															>
																{shortenAdminUserId(u.id)}
															</span>
															<button
																type="button"
																className="shrink-0 rounded p-0.5 text-[var(--admin-ui-fg-muted)] hover:bg-[var(--admin-ui-accent-soft)] hover:text-[var(--admin-ui-fg)]"
																aria-label={t('adminUsersHub.table.copyId')}
																title={t('adminUsersHub.table.copyId')}
																onClick={(e) => {
																	e.stopPropagation();
																	void copyTextToClipboard(u.id);
																}}
															>
																<ClipboardDocumentIcon
																	className="h-3.5 w-3.5"
																	aria-hidden
																/>
															</button>
														</div>
													</div>
												</div>
											</td>
											{tableColumns.email ? (
												<td
													className={`p-3 ${uiCaption} text-[var(--admin-ui-fg)] align-middle max-w-44`}
												>
													<span className="truncate block" title={u.email}>
														{u.email}
													</span>
												</td>
											) : null}
											<td className="p-3 align-middle">
												<span
													className={`inline-flex w-fit rounded-md border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] px-2 py-0.5 ${uiCaption}`}
												>
													{adminUserRoleLabelI18n(u.role, t)}
												</span>
											</td>
											{tableColumns.created_at ? (
												<td
													className={`p-3 ${uiCaption} align-middle whitespace-nowrap`}
												>
													{formatDt(u.created_at)}
												</td>
											) : null}
											{tableColumns.last_login_at ? (
												<td
													className={`p-3 ${uiCaption} align-middle whitespace-nowrap`}
												>
													{formatDt(u.last_login_at)}
												</td>
											) : null}
											<td className="p-3 align-middle">
												{channelsCompact ? (
													<UserOnlineChannelsCompact u={u} />
												) : (
													<UserOnlineChannels u={u} />
												)}
											</td>
											{tableColumns.socket_activity ? (
												<td
													className={`p-3 ${uiCaption} align-middle whitespace-nowrap`}
												>
													{formatDt(u.presence_last_seen_at)}
												</td>
											) : null}
											{tableColumns.shop_group ? (
												<td
													className={`p-3 ${uiCaption} text-[var(--admin-ui-fg)] align-middle max-w-40`}
												>
													<span
														className="truncate block"
														title={u.app_access_group_name ?? ''}
													>
														{u.app_access_group_name ?? '—'}
													</span>
												</td>
											) : null}
											<td
												className={`p-3 ${uiCaption} text-[var(--admin-ui-fg)] tabular-nums align-middle whitespace-nowrap`}
											>
												{u.ew_balance} EW / {Number(u.ugs_credits).toFixed(0)}{' '}
												UGS
											</td>
											{tableColumns.flags ? (
												<td className="p-3 pr-4 align-middle">
													<div className="flex flex-wrap gap-1 justify-end">
														{u.is_trusted ? (
															<span className="rounded px-1.5 py-0.5 text-[10px] border border-sky-500/30 bg-sky-500/15 text-sky-200">
																{t('adminUsersHub.table.flagTrusted')}
															</span>
														) : null}
														{!u.is_active ? (
															<span className="rounded px-1.5 py-0.5 text-[10px] border border-amber-500/30 text-amber-200">
																{t('adminUsersHub.table.flagInactive')}
															</span>
														) : null}
														{u.is_verified ? (
															<span className="rounded px-1.5 py-0.5 text-[10px] border border-[var(--admin-ui-border)] text-[var(--admin-ui-fg-muted)]">
																{t('adminUsersHub.table.flagVerified')}
															</span>
														) : null}
													</div>
												</td>
											) : null}
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{payload ? (
				<div
					className={`mt-4 flex flex-wrap items-center justify-between gap-3 ${uiCaption}`}
				>
					<span>
						{t('adminUsersHub.table.total', {
							total: payload.total,
							page: payload.page,
							pages: totalPages,
						})}
					</span>
					<div className="flex items-center gap-2">
						<AdminButton
							variant="secondary"
							onClick={() => onPageChange((p) => Math.max(1, p - 1))}
							disabled={page <= 1 || loading}
							className="px-2 py-1"
						>
							<ChevronLeftIcon className="w-4 h-4" />
							{t('adminUsersHub.table.prev')}
						</AdminButton>
						<AdminButton
							variant="secondary"
							onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
							disabled={page >= totalPages || loading}
							className="px-2 py-1"
						>
							{t('adminUsersHub.table.next')}
							<ChevronRightIcon className="w-4 h-4" />
						</AdminButton>
					</div>
				</div>
			) : null}
		</>
	);
}
