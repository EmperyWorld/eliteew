/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile card list for admin Users catalog (viewport &lt; 768px).
 *
 * Invariants:
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { SecureAvatar } from '../../../components/profile/SecureAvatar';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import { adminUserRoleLabelI18n } from '../adminUserRolesI18n';
import { AdminButton } from '../ui';
import { UserOnlineChannelsCompact } from './AdminUsersChannelCells';
import { copyTextToClipboard, primaryName } from './adminUsersFormatters';

const uiCaption =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';
const uiBody =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg)]';

export type AdminUsersCatalogCardsProps = {
	loading: boolean;
	total: number;
	tableList: AdminDirectoryUserRow[];
	selectedUserIds: string[];
	panelUser: AdminDirectoryUserRow | null;
	mismatchOnly: boolean;
	anomalyOnly: boolean;
	toggleOne: (id: string) => void;
	onOpenUser: (u: AdminDirectoryUserRow) => void;
	page: number;
	totalPages: number;
	onPageChange: (fn: (p: number) => number) => void;
};

export function AdminUsersCatalogCards(
	props: AdminUsersCatalogCardsProps
): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const {
		loading,
		total,
		tableList,
		selectedUserIds,
		panelUser,
		mismatchOnly,
		anomalyOnly,
		toggleOne,
		onOpenUser,
		page,
		totalPages,
		onPageChange,
	} = props;

	const emptyMessage = loading
		? t('adminUsersHub.cards.loading')
		: mismatchOnly
			? t('adminUsersHub.cards.emptyMismatch')
			: anomalyOnly
				? t('adminUsersHub.cards.emptyAnomaly')
				: t('adminUsersHub.cards.empty');

	return (
		<div className="eliteew-admin-users-cards flex flex-col gap-3">
			{tableList.length === 0 ? (
				<p className={`${uiCaption} py-8 text-center`}>{emptyMessage}</p>
			) : (
				tableList.map((u) => (
					<article
						key={u.id}
						className={`eliteew-admin-users-card rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-3 ${
							panelUser?.id === u.id
								? 'border-[var(--admin-ui-accent)]/35 bg-[var(--admin-ui-accent-soft)]'
								: ''
						}`}
					>
						<div className="flex items-start gap-3">
							<input
								type="checkbox"
								className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]"
								checked={selectedUserIds.includes(u.id)}
								onChange={() => toggleOne(u.id)}
								aria-label={t('adminUsersHub.cards.selectUser', {
									name: u.username,
								})}
							/>
							<SecureAvatar
								avatarUrl={u.avatar_url?.trim() || null}
								alt={t('adminUsersHub.cards.avatarAlt', {
									name: primaryName(u),
								})}
								className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-[var(--admin-ui-border)]"
							/>
							<div className="min-w-0 flex-1">
								<button
									type="button"
									className={`${uiBody} font-medium text-left truncate block w-full`}
									onClick={() => onOpenUser(u)}
								>
									{primaryName(u)}
								</button>
								{u.email ? (
									<p className={`${uiCaption} truncate`}>{u.email}</p>
								) : null}
								<div className="mt-1 flex flex-wrap items-center gap-2">
									<span
										className={`inline-flex rounded-md border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] px-2 py-0.5 ${uiCaption}`}
									>
										{adminUserRoleLabelI18n(u.role, t)}
									</span>
									{u.presence_online ? (
										<span className="text-xs text-emerald-300/90">
											{t('adminUsersHub.cards.onlineBadge')}
										</span>
									) : null}
								</div>
							</div>
						</div>
						<div className="mt-3 border-t border-[var(--admin-ui-border)] pt-3">
							<UserOnlineChannelsCompact u={u} />
						</div>
						<div className="mt-3 flex gap-2">
							<AdminButton
								variant="primary"
								className="flex-1"
								onClick={() => onOpenUser(u)}
							>
								{t('adminUsersHub.cards.openCard')}
							</AdminButton>
							<AdminButton
								variant="secondary"
								className="text-xs"
								onClick={() => void copyTextToClipboard(u.id)}
							>
								{t('adminUsersHub.cards.copyId')}
							</AdminButton>
						</div>
					</article>
				))
			)}
			{total > 0 ? (
				<nav
					className="flex items-center justify-between gap-2 pt-2"
					aria-label={t('adminUsersHub.cards.paginationAria')}
				>
					<AdminButton
						variant="secondary"
						disabled={page <= 1}
						onClick={() => onPageChange((p) => Math.max(1, p - 1))}
						className="py-1.5"
					>
						<ChevronLeftIcon className="h-4 w-4" aria-hidden />
						{t('adminUsersHub.cards.prev')}
					</AdminButton>
					<span className={`${uiCaption} tabular-nums`}>
						{page} / {totalPages}
					</span>
					<AdminButton
						variant="secondary"
						disabled={page >= totalPages}
						onClick={() => onPageChange((p) => p + 1)}
						className="py-1.5"
					>
						{t('adminUsersHub.cards.next')}
						<ChevronRightIcon className="h-4 w-4" aria-hidden />
					</AdminButton>
				</nav>
			) : null}
		</div>
	);
}
