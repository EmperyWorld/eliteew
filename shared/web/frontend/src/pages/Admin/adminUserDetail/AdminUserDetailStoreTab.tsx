/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Store tab for admin user detail panel: access group, EW/UGS balances, web search quota.
 *
 * Invariants:
 * - Save buttons disabled when values match server state or mutation is pending.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/adminUserDetail/AdminUserDetailPanel.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import {
	ArrowPathIcon,
	BanknotesIcon,
	BoltIcon,
	GlobeAltIcon,
	MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import * as React from 'react';
import type { TFunction } from 'i18next';
import type {
	getAccessGroups,
	WebSearchQuotaStatus,
} from '../../Desktop/services/desktopAdminApi';
import { AdminButton, AdminSelect, adminUiFieldClass } from '../ui';

const uiCaption =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';

type AccessGroup = Awaited<ReturnType<typeof getAccessGroups>>[number];

type SaveGroupMut = UseMutationResult<void, Error, void, unknown>;
type SaveEwMut = UseMutationResult<void, Error, void, unknown>;
type SaveStoreUgsMut = UseMutationResult<void, Error, void, unknown>;
type SaveWebSearchQuotaMut = UseMutationResult<
	WebSearchQuotaStatus | null | undefined,
	Error,
	void,
	unknown
>;

type AdminUserDetailStoreTabProps = {
	t: TFunction<'desktopUi'>;
	groups: AccessGroup[];
	groupsQuery: UseQueryResult<AccessGroup[]>;
	groupId: string;
	setGroupId: (value: string) => void;
	groupDirty: boolean;
	saveGroupMut: SaveGroupMut;
	ewVal: number;
	setEwVal: (value: number) => void;
	ewDirty: boolean;
	saveEwMut: SaveEwMut;
	storeUgsVal: number;
	setStoreUgsVal: (value: number) => void;
	storeUgsDirty: boolean;
	saveStoreUgsMut: SaveStoreUgsMut;
	webSearchQuotaQuery: UseQueryResult<WebSearchQuotaStatus>;
	webSearchQuota: WebSearchQuotaStatus | undefined;
	webSearchCoinsVal: number;
	setWebSearchCoinsVal: (value: number) => void;
	webSearchMonthlyLimitVal: string;
	setWebSearchMonthlyLimitVal: (value: string) => void;
	webSearchQuotaDirty: boolean;
	saveWebSearchQuotaMut: SaveWebSearchQuotaMut;
};

export function AdminUserDetailStoreTab({
	t,
	groups,
	groupsQuery,
	groupId,
	setGroupId,
	groupDirty,
	saveGroupMut,
	ewVal,
	setEwVal,
	ewDirty,
	saveEwMut,
	storeUgsVal,
	setStoreUgsVal,
	storeUgsDirty,
	saveStoreUgsMut,
	webSearchQuotaQuery,
	webSearchQuota,
	webSearchCoinsVal,
	setWebSearchCoinsVal,
	webSearchMonthlyLimitVal,
	setWebSearchMonthlyLimitVal,
	webSearchQuotaDirty,
	saveWebSearchQuotaMut,
}: AdminUserDetailStoreTabProps): React.ReactElement {
	return (
		<section>
			<h3 className={`${uiCaption} mb-2`}>
				{t('adminUserDetail.store.title')}
			</h3>
			<div className="space-y-3">
				<div className="block">
					<span className={uiCaption}>
						{t('adminUserDetail.store.accessGroup')}
					</span>
					<div className="mt-1 w-full">
						<AdminSelect
							value={groupId}
							onChange={(e) => setGroupId(e.target.value)}
							disabled={groupsQuery.isLoading || saveGroupMut.isPending}
							className="text-sm"
							aria-label={t('adminUserDetail.store.accessGroupAria')}
						>
							<option value="">
								{t('adminUserDetail.store.defaultGroup')}
							</option>
							{groups.map((g) => (
								<option key={g.id} value={g.id}>
									{g.name}
								</option>
							))}
						</AdminSelect>
					</div>
				</div>
				<AdminButton
					variant="secondary"
					disabled={saveGroupMut.isPending || !groupDirty}
					onClick={() => saveGroupMut.mutate()}
					className="border border-violet-500/40 bg-violet-500/20 text-violet-100"
				>
					{t('adminUserDetail.store.saveGroup')}
				</AdminButton>

				<div className="flex flex-wrap items-end gap-2">
					<label className="flex-1 min-w-24">
						<span className={uiCaption}>{t('adminUserDetail.store.ew')}</span>
						<input
							type="number"
							min={0}
							value={ewVal}
							onChange={(e) => setEwVal(Number(e.target.value) || 0)}
							className={`${adminUiFieldClass} mt-1 tabular-nums`}
						/>
					</label>
					<AdminButton
						variant="secondary"
						onClick={() => saveEwMut.mutate()}
						disabled={saveEwMut.isPending || !ewDirty}
						className="text-amber-200 border border-amber-500/30 bg-amber-500/10"
					>
						<BanknotesIcon className="h-4 w-4" />
						{t('adminUserDetail.store.saveEw')}
					</AdminButton>
				</div>

				<div className="flex flex-wrap items-end gap-2">
					<label className="flex-1 min-w-24">
						<span className={uiCaption}>
							{t('adminUserDetail.store.storeUgs')}
						</span>
						<input
							type="number"
							min={0}
							step="0.01"
							value={storeUgsVal}
							onChange={(e) => setStoreUgsVal(Number(e.target.value) || 0)}
							className={`${adminUiFieldClass} mt-1 tabular-nums`}
						/>
					</label>
					<AdminButton
						variant="secondary"
						onClick={() => saveStoreUgsMut.mutate()}
						disabled={saveStoreUgsMut.isPending || !storeUgsDirty}
						className="text-violet-200 border border-violet-500/30 bg-violet-500/10"
					>
						<BoltIcon className="h-4 w-4" />
						{t('adminUserDetail.store.saveStoreUgs')}
					</AdminButton>
				</div>

				<div className="rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-3 space-y-3">
					<div className="flex items-center gap-2 text-[var(--admin-ui-fg)]">
						<GlobeAltIcon className="h-4 w-4 shrink-0 text-sky-300" />
						<span
							className={`${uiCaption} font-medium text-[var(--admin-ui-fg)]`}
						>
							{t('adminUserDetail.store.webSearchTitle')}
						</span>
					</div>
					{webSearchQuotaQuery.isLoading ? (
						<ArrowPathIcon className="h-5 w-5 animate-spin text-violet-400" />
					) : webSearchQuotaQuery.isError ? (
						<p className="text-red-300 text-sm">
							{webSearchQuotaQuery.error?.message ??
								t('adminUserDetail.store.webSearchLoadError')}
						</p>
					) : webSearchQuota ? (
						<>
							<p className={uiCaption}>
								{t('adminUserDetail.store.webSearchUsage', {
									used: webSearchQuota.monthly_used,
									limit: webSearchQuota.monthly_limit,
									remaining: webSearchQuota.total_remaining,
									coins: webSearchQuota.coins,
								})}
							</p>
							<div className="flex flex-wrap items-end gap-2">
								<label className="flex-1 min-w-24">
									<span className={uiCaption}>
										{t('adminUserDetail.store.webSearchCoins')}
									</span>
									<input
										type="number"
										min={0}
										value={webSearchCoinsVal}
										onChange={(e) =>
											setWebSearchCoinsVal(Number(e.target.value) || 0)
										}
										className={`${adminUiFieldClass} mt-1 tabular-nums`}
									/>
								</label>
								<label className="flex-1 min-w-24">
									<span className={uiCaption}>
										{t('adminUserDetail.store.webSearchMonthlyLimit')}
									</span>
									<input
										type="number"
										min={0}
										value={webSearchMonthlyLimitVal}
										onChange={(e) =>
											setWebSearchMonthlyLimitVal(e.target.value)
										}
										className={`${adminUiFieldClass} mt-1 tabular-nums`}
									/>
								</label>
								<AdminButton
									variant="secondary"
									onClick={() => saveWebSearchQuotaMut.mutate()}
									disabled={
										saveWebSearchQuotaMut.isPending || !webSearchQuotaDirty
									}
									className="text-sky-200 border border-sky-500/30 bg-sky-500/10"
								>
									<MagnifyingGlassIcon className="h-4 w-4" />
									{t('adminUserDetail.store.saveWebSearchQuota')}
								</AdminButton>
							</div>
							<p className={`${uiCaption} text-[var(--admin-ui-fg-dim)]`}>
								{t('adminUserDetail.store.webSearchHint')}
							</p>
						</>
					) : null}
				</div>
			</div>
		</section>
	);
}
