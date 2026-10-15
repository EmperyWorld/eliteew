/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS tab for admin user detail panel: credits, trusted flag, top-up, limits, admin badge.
 *
 * Invariants:
 * - System accounts cannot be marked trusted or receive top-ups.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/adminUserDetail/AdminUserDetailPanel.tsx`
 * - `hooks/api/useUgsAdmin.ts`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import {
	AdjustmentsHorizontalIcon,
	ArrowPathIcon,
	CheckBadgeIcon,
	CreditCardIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import type { UseMutationResult } from '@tanstack/react-query';
import * as React from 'react';
import type { TFunction } from 'i18next';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import { AdminButton, adminUiFieldClass } from '../ui';
import type { AdminUserDetailPanelViewModel } from './useAdminUserDetailPanel';

const uiCaption =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';

type AdminUserDetailUgsTabProps = {
	userRow: AdminDirectoryUserRow;
	t: TFunction<'desktopUi'>;
	ugsOk: boolean;
	ugsUser: AdminUserDetailPanelViewModel['ugsUser'];
	patchTrusted: UseMutationResult<
		unknown,
		Error,
		{ userId: string; isTrusted: boolean },
		unknown
	>;
	topUpAmount: string;
	setTopUpAmount: (value: string) => void;
	topUpReason: string;
	setTopUpReason: (value: string) => void;
	topUpMut: AdminUserDetailPanelViewModel['topUpMut'];
	onUserUpdated: () => void;
	limDaily: string;
	setLimDaily: (value: string) => void;
	limMonthly: string;
	setLimMonthly: (value: string) => void;
	limConcurrent: string;
	setLimConcurrent: (value: string) => void;
	limitsMut: AdminUserDetailPanelViewModel['limitsMut'];
	badgeLabel: string;
	setBadgeLabel: (value: string) => void;
	badgeHint: string;
	setBadgeHint: (value: string) => void;
	badgeMut: AdminUserDetailPanelViewModel['badgeMut'];
};

export function AdminUserDetailUgsTab({
	userRow,
	t,
	ugsOk,
	ugsUser,
	patchTrusted,
	topUpAmount,
	setTopUpAmount,
	topUpReason,
	setTopUpReason,
	topUpMut,
	onUserUpdated,
	limDaily,
	setLimDaily,
	limMonthly,
	setLimMonthly,
	limConcurrent,
	setLimConcurrent,
	limitsMut,
	badgeLabel,
	setBadgeLabel,
	badgeHint,
	setBadgeHint,
	badgeMut,
}: AdminUserDetailUgsTabProps): React.ReactElement {
	if (!ugsOk) {
		return (
			<p className={`${uiCaption} text-[var(--admin-ui-fg-dim)]`}>
				{t('adminUserDetail.ugs.noAccess')}
			</p>
		);
	}

	return (
		<section>
			<h3 className={`${uiCaption} mb-2`}>{t('adminUserDetail.ugs.title')}</h3>
			{ugsUser.isLoading ? (
				<ArrowPathIcon className="h-6 w-6 animate-spin text-violet-400" />
			) : ugsUser.isError ? (
				<p className="text-red-300 text-sm">
					{ugsUser.error?.message ?? t('adminUserDetail.ugs.loadError')}
				</p>
			) : ugsUser.data ? (
				<div className="space-y-4">
					<div className="flex flex-wrap items-center gap-2">
						<span className={uiCaption}>
							{t('adminUserDetail.ugs.balance', {
								value: Number(ugsUser.data.credits ?? 0).toFixed(2),
							})}
						</span>
						<AdminButton
							variant="secondary"
							disabled={
								Boolean(ugsUser.data.is_system_account) ||
								patchTrusted.isPending
							}
							onClick={() =>
								patchTrusted.mutate({
									userId: userRow.id,
									isTrusted: !ugsUser.data?.is_trusted,
								})
							}
							className="rounded-lg px-2 py-1 text-xs"
						>
							<CheckBadgeIcon className="h-3.5 w-3.5" />
							{t('adminUserDetail.ugs.trusted', {
								value: ugsUser.data.is_trusted
									? t('adminUserDetail.ugs.trustedYes')
									: t('adminUserDetail.ugs.trustedNo'),
							})}
						</AdminButton>
					</div>

					<div className="rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] p-3 space-y-2">
						<p className={uiCaption}>{t('adminUserDetail.ugs.topUpTitle')}</p>
						<input
							type="number"
							min={1}
							placeholder={t('adminUserDetail.ugs.topUpAmount')}
							value={topUpAmount}
							onChange={(e) => setTopUpAmount(e.target.value)}
							className={adminUiFieldClass}
						/>
						<input
							type="text"
							placeholder={t('adminUserDetail.ugs.topUpReason')}
							value={topUpReason}
							onChange={(e) => setTopUpReason(e.target.value)}
							className={adminUiFieldClass}
						/>
						<AdminButton
							variant="secondary"
							disabled={
								topUpMut.isPending ||
								!topUpAmount.trim() ||
								Boolean(ugsUser.data.is_system_account)
							}
							onClick={() => {
								const n = Number(topUpAmount);
								if (!Number.isFinite(n) || n <= 0) return;
								topUpMut.mutate(
									{
										userId: userRow.id,
										amount: Math.floor(n),
										reason: topUpReason.trim() || undefined,
									},
									{
										onSuccess: () => {
											setTopUpAmount('');
											setTopUpReason('');
											void ugsUser.refetch();
											onUserUpdated();
										},
									}
								);
							}}
						>
							<CreditCardIcon className="h-4 w-4" />
							{t('adminUserDetail.ugs.topUpSubmit')}
						</AdminButton>
					</div>

					<div className="rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] p-3 space-y-2">
						<p className={uiCaption}>{t('adminUserDetail.ugs.limitsTitle')}</p>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
							<input
								type="number"
								value={limDaily}
								onChange={(e) => setLimDaily(e.target.value)}
								className={adminUiFieldClass}
								placeholder={t('adminUserDetail.ugs.limitDaily')}
							/>
							<input
								type="number"
								value={limMonthly}
								onChange={(e) => setLimMonthly(e.target.value)}
								className={adminUiFieldClass}
								placeholder={t('adminUserDetail.ugs.limitMonthly')}
							/>
							<input
								type="number"
								value={limConcurrent}
								onChange={(e) => setLimConcurrent(e.target.value)}
								className={adminUiFieldClass}
								placeholder={t('adminUserDetail.ugs.limitConcurrent')}
							/>
						</div>
						<AdminButton
							variant="secondary"
							disabled={limitsMut.isPending}
							onClick={() => {
								limitsMut.mutate(
									{
										userId: userRow.id,
										payload: {
											daily_credit_limit: Number(limDaily) || 0,
											monthly_credit_limit: Number(limMonthly) || 0,
											concurrent_requests_limit: Number(limConcurrent) || 0,
										},
									},
									{
										onSuccess: () => void ugsUser.refetch(),
									}
								);
							}}
						>
							<AdjustmentsHorizontalIcon className="h-4 w-4" />
							{t('adminUserDetail.ugs.saveLimits')}
						</AdminButton>
					</div>

					{!ugsUser.data.is_system_account ? (
						<div className="rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] p-3 space-y-2">
							<p className={uiCaption}>{t('adminUserDetail.ugs.badgeTitle')}</p>
							<input
								type="text"
								value={badgeLabel}
								onChange={(e) => setBadgeLabel(e.target.value)}
								placeholder={t('adminUserDetail.ugs.badgeLabel')}
								className={adminUiFieldClass}
							/>
							<input
								type="text"
								value={badgeHint}
								onChange={(e) => setBadgeHint(e.target.value)}
								placeholder={t('adminUserDetail.ugs.badgeHint')}
								className={adminUiFieldClass}
							/>
							<AdminButton
								variant="secondary"
								disabled={badgeMut.isPending}
								onClick={() =>
									badgeMut.mutate(
										{
											userId: userRow.id,
											label: badgeLabel.trim() || null,
											hint: badgeHint.trim() || null,
										},
										{ onSuccess: () => void ugsUser.refetch() }
									)
								}
							>
								<SparklesIcon className="h-4 w-4" />
								{t('adminUserDetail.ugs.saveBadge')}
							</AdminButton>
						</div>
					) : null}
				</div>
			) : null}
		</section>
	);
}
