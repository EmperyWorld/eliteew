/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsible filters panel for admin Users catalog (presets live in toolbar).
 *
 * Invariants:
 * - Catalog search input always has `id` + `name` (browser autofill / a11y scanners).
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { ADMIN_DIRECTORY_ROLE_FILTER_VALUES } from '../adminUserRoles';
import { adminUserRoleLabelI18n } from '../adminUserRolesI18n';
import {
	ADMIN_DIRECTORY_SORT_I18N,
	ADMIN_DIRECTORY_SORT_OPTIONS,
} from '../adminDirectorySort';
import {
	ADMIN_USERS_TOGGLEABLE_COLUMN_IDS,
	COMPACT_ADMIN_USERS_TABLE_COLUMNS,
	DEFAULT_ADMIN_USERS_TABLE_COLUMNS,
	tableColumnsEqual,
	toggleAdminUsersTableColumn,
} from '../adminUsersTableColumns';
import { AdminButton, AdminSelect, adminUiFieldClass } from '../ui';
import type { AdminUsersCatalogFiltersController } from './adminUsersCatalogFiltersTypes';

const uiCaption =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';

export type AdminUsersCatalogFiltersPanelProps = {
	ctrl: AdminUsersCatalogFiltersController;
};

export function AdminUsersCatalogFiltersPanel({
	ctrl: c,
}: AdminUsersCatalogFiltersPanelProps): React.ReactElement {
	const filterFieldId = React.useId().replace(/:/g, '');
	const {
		search,
		setSearch,
		searchInputRef,
		roleFilter,
		setRoleFilter,
		groupFilter,
		setGroupFilter,
		activeFilter,
		setActiveFilter,
		trustedFilter,
		setTrustedFilter,
		verifiedFilter,
		setVerifiedFilter,
		onlineOnly,
		setOnlineOnly,
		anomalyOnly,
		setAnomalyOnly,
		ssoBrowserOnly,
		setSsoBrowserOnly,
		ssoMobileOnly,
		setSsoMobileOnly,
		mismatchOnly,
		setMismatchOnly,
		sortValue,
		setSortValue,
		channelsCompact,
		setChannelsCompact,
		tableColumns,
		setTableColumns,
		autoRefresh,
		setAutoRefresh,
		groups,
		groupsLoading,
		hasActiveFilters,
		clearFilters,
		setPage,
		filtersExpanded,
		onFiltersExpandedChange,
	} = c;
	const { t } = useTranslation('desktopUi');
	return (
		<details
			open={filtersExpanded}
			onToggle={(e) => {
				const open = (e.target as HTMLDetailsElement).open;
				onFiltersExpandedChange(open);
			}}
		>
			<summary className={`${uiCaption} text-[var(--admin-ui-fg)] mb-2`}>
				{t('adminUsersHub.filters.title')}
				{hasActiveFilters ? (
					<span className="ml-2 text-[var(--admin-ui-accent)]">
						{t('adminUsersHub.filters.activeBadge')}
					</span>
				) : null}
			</summary>

			<div className="flex flex-wrap gap-2 mb-3">
				<button
					type="button"
					onClick={() => {
						setOnlineOnly(true);
						setActiveFilter('all');
						setTrustedFilter('all');
					}}
					className={`rounded-full border px-3 py-1 text-xs ${
						onlineOnly
							? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
							: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg)] hover:bg-[var(--admin-ui-accent-soft)]'
					}`}
				>
					{t('adminUsersHub.filters.presetOnlineNow')}
				</button>
				<button
					type="button"
					onClick={() => {
						setActiveFilter('no');
						setOnlineOnly(false);
					}}
					className={`rounded-full border px-3 py-1 text-xs ${
						activeFilter === 'no' && !onlineOnly
							? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
							: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg)] hover:bg-[var(--admin-ui-accent-soft)]'
					}`}
				>
					{t('adminUsersHub.filters.presetInactive')}
				</button>
				<button
					type="button"
					onClick={() => {
						setGroupFilter('__none__');
						setOnlineOnly(false);
						setAnomalyOnly(false);
					}}
					className={`rounded-full border px-3 py-1 text-xs ${
						groupFilter === '__none__' && !anomalyOnly
							? 'border-[var(--admin-ui-accent)]/40 bg-[var(--admin-ui-accent-soft)] text-[var(--admin-ui-fg)]'
							: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg)] hover:bg-[var(--admin-ui-accent-soft)]'
					}`}
				>
					{t('adminUsersHub.filters.presetNoGroup')}
				</button>
				<button
					type="button"
					onClick={() => {
						setTrustedFilter('yes');
						setVerifiedFilter('all');
						setAnomalyOnly(false);
					}}
					className={`rounded-full border px-3 py-1 text-xs ${
						trustedFilter === 'yes' && !anomalyOnly
							? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
							: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg)] hover:bg-[var(--admin-ui-accent-soft)]'
					}`}
				>
					{t('adminUsersHub.filters.presetTrusted')}
				</button>
				<button
					type="button"
					onClick={() => {
						setAnomalyOnly(true);
						setOnlineOnly(false);
					}}
					className={`rounded-full border px-3 py-1 text-xs ${
						anomalyOnly
							? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
							: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg)] hover:bg-[var(--admin-ui-accent-soft)]'
					}`}
					title={t('adminUsersHub.filters.presetAnomalyTitle')}
				>
					{t('adminUsersHub.filters.presetAnomaly')}
				</button>
				<button
					type="button"
					onClick={() => {
						setSsoBrowserOnly(true);
						setSsoMobileOnly(false);
						setOnlineOnly(false);
						setAnomalyOnly(false);
					}}
					className={`rounded-full border px-3 py-1 text-xs ${
						ssoBrowserOnly && !ssoMobileOnly
							? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
							: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg)] hover:bg-[var(--admin-ui-accent-soft)]'
					}`}
				>
					{t('adminUsersHub.filters.presetSsoBrowser')}
				</button>
				<button
					type="button"
					onClick={() => {
						setSsoMobileOnly(true);
						setSsoBrowserOnly(false);
						setOnlineOnly(false);
						setAnomalyOnly(false);
					}}
					className={`rounded-full border px-3 py-1 text-xs ${
						ssoMobileOnly && !ssoBrowserOnly
							? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
							: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg)] hover:bg-[var(--admin-ui-accent-soft)]'
					}`}
				>
					{t('adminUsersHub.filters.presetSsoMobile')}
				</button>
				<button
					type="button"
					onClick={() => {
						setMismatchOnly((prev) => {
							const next = !prev;
							if (next) {
								setOnlineOnly(false);
								setAnomalyOnly(false);
							}
							return next;
						});
						setPage(1);
					}}
					className={`rounded-full border px-3 py-1 text-xs ${
						mismatchOnly
							? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
							: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg)] hover:bg-[var(--admin-ui-accent-soft)]'
					}`}
					title={t('adminUsersHub.filters.presetMismatchTitle')}
				>
					{t('adminUsersHub.filters.presetMismatch')}
				</button>
				{hasActiveFilters ? (
					<AdminButton
						variant="ghost"
						onClick={clearFilters}
						className="rounded-full px-3 py-1 text-xs"
					>
						<XMarkIcon className="h-3.5 w-3.5" aria-hidden />
						{t('adminUsersHub.filters.clearAll')}
					</AdminButton>
				) : null}
			</div>

			<div className="flex flex-wrap gap-3 mb-4 items-end">
				<label
					htmlFor={`${filterFieldId}-search`}
					className="flex flex-col gap-1 min-w-48 flex-1"
				>
					<span className={uiCaption}>{t('adminUsersHub.filters.search')}</span>
					<input
						id={`${filterFieldId}-search`}
						name="admin-users-catalog-search"
						ref={searchInputRef}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t('adminUsersHub.filters.searchPlaceholder')}
						className={adminUiFieldClass}
						aria-keyshortcuts="/"
						autoComplete="off"
					/>
				</label>
				<label
					htmlFor={`${filterFieldId}-role`}
					className="flex min-w-44 w-44 flex-col gap-1"
				>
					<span className={uiCaption}>{t('adminUsersHub.filters.role')}</span>
					<AdminSelect
						id={`${filterFieldId}-role`}
						value={roleFilter}
						onChange={(e) => setRoleFilter(e.target.value)}
					>
						<option value="">{t('adminUsersHub.filters.roleAll')}</option>
						{ADMIN_DIRECTORY_ROLE_FILTER_VALUES.map((r) => (
							<option key={r} value={r}>
								{adminUserRoleLabelI18n(r, t)}
							</option>
						))}
					</AdminSelect>
				</label>
				<label
					htmlFor={`${filterFieldId}-group`}
					className="flex min-w-48 flex-col gap-1"
				>
					<span className={uiCaption}>{t('adminUsersHub.filters.group')}</span>
					<AdminSelect
						id={`${filterFieldId}-group`}
						value={groupFilter}
						onChange={(e) => setGroupFilter(e.target.value)}
						disabled={groupsLoading}
					>
						<option value="">{t('adminUsersHub.filters.groupAll')}</option>
						<option value="__none__">
							{t('adminUsersHub.filters.groupNone')}
						</option>
						{(groups ?? []).map((g) => (
							<option key={g.id} value={g.id}>
								{g.name}
							</option>
						))}
					</AdminSelect>
				</label>
				<label
					htmlFor={`${filterFieldId}-active`}
					className="flex w-36 flex-col gap-1"
				>
					<span className={uiCaption}>{t('adminUsersHub.filters.active')}</span>
					<AdminSelect
						id={`${filterFieldId}-active`}
						value={activeFilter}
						onChange={(e) =>
							setActiveFilter(e.target.value as 'all' | 'yes' | 'no')
						}
					>
						<option value="all">{t('adminUsersHub.filters.triAll')}</option>
						<option value="yes">{t('adminUsersHub.filters.triYes')}</option>
						<option value="no">{t('adminUsersHub.filters.triNo')}</option>
					</AdminSelect>
				</label>
				<label
					htmlFor={`${filterFieldId}-trusted`}
					className="flex w-36 flex-col gap-1"
				>
					<span className={uiCaption}>
						{t('adminUsersHub.filters.trusted')}
					</span>
					<AdminSelect
						id={`${filterFieldId}-trusted`}
						value={trustedFilter}
						onChange={(e) =>
							setTrustedFilter(e.target.value as 'all' | 'yes' | 'no')
						}
					>
						<option value="all">{t('adminUsersHub.filters.triAll')}</option>
						<option value="yes">{t('adminUsersHub.filters.triYes')}</option>
						<option value="no">{t('adminUsersHub.filters.triNo')}</option>
					</AdminSelect>
				</label>
				<label
					htmlFor={`${filterFieldId}-verified`}
					className="flex w-36 flex-col gap-1"
				>
					<span className={uiCaption}>
						{t('adminUsersHub.filters.verified')}
					</span>
					<AdminSelect
						id={`${filterFieldId}-verified`}
						value={verifiedFilter}
						onChange={(e) =>
							setVerifiedFilter(e.target.value as 'all' | 'yes' | 'no')
						}
					>
						<option value="all">{t('adminUsersHub.filters.triAll')}</option>
						<option value="yes">{t('adminUsersHub.filters.triYes')}</option>
						<option value="no">{t('adminUsersHub.filters.triNo')}</option>
					</AdminSelect>
				</label>
				<label
					htmlFor={`${filterFieldId}-sort`}
					className="flex min-w-52 flex-col gap-1"
				>
					<span className={uiCaption}>{t('adminUsersHub.filters.sort')}</span>
					<AdminSelect
						id={`${filterFieldId}-sort`}
						value={sortValue}
						onChange={(e) => setSortValue(e.target.value)}
					>
						{ADMIN_DIRECTORY_SORT_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>
								{t(ADMIN_DIRECTORY_SORT_I18N[o.value] ?? o.value)}
							</option>
						))}
					</AdminSelect>
				</label>
				<label
					htmlFor={`${filterFieldId}-online`}
					className="flex w-48 flex-col gap-1"
				>
					<span className={uiCaption}>{t('adminUsersHub.filters.online')}</span>
					<AdminSelect
						id={`${filterFieldId}-online`}
						value={onlineOnly ? 'yes' : 'no'}
						onChange={(e) => setOnlineOnly(e.target.value === 'yes')}
					>
						<option value="no">{t('adminUsersHub.filters.onlineAll')}</option>
						<option value="yes">{t('adminUsersHub.filters.onlineOnly')}</option>
					</AdminSelect>
				</label>
				<label
					htmlFor={`${filterFieldId}-mismatch`}
					className="flex w-52 flex-col gap-1"
				>
					<span className={uiCaption}>
						{t('adminUsersHub.filters.mismatch')}
					</span>
					<AdminSelect
						id={`${filterFieldId}-mismatch`}
						value={mismatchOnly ? 'yes' : 'no'}
						onChange={(e) => {
							const on = e.target.value === 'yes';
							setMismatchOnly(on);
							if (on) {
								setOnlineOnly(false);
								setAnomalyOnly(false);
							}
							setPage(1);
						}}
					>
						<option value="no">{t('adminUsersHub.filters.triAll')}</option>
						<option value="yes">
							{t('adminUsersHub.filters.mismatchOnly')}
						</option>
					</AdminSelect>
				</label>
				<label className="flex items-center gap-2 mb-0.5 cursor-pointer select-none">
					<input
						type="checkbox"
						className="h-4 w-4 rounded border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]"
						checked={channelsCompact}
						onChange={(e) => setChannelsCompact(e.target.checked)}
					/>
					<span className={`${uiCaption} inline-flex items-center gap-1`}>
						<Squares2X2Icon className="h-3.5 w-3.5" aria-hidden />
						{t('adminUsersHub.filters.channelsCompact')}
					</span>
				</label>
				<div className="flex flex-wrap items-center gap-1 mb-0.5">
					<span className={uiCaption}>
						{t('adminUsersHub.filters.tablePreset')}
					</span>
					<button
						type="button"
						onClick={() =>
							setTableColumns({ ...COMPACT_ADMIN_USERS_TABLE_COLUMNS })
						}
						className={`rounded-full border px-2.5 py-0.5 text-xs ${
							tableColumnsEqual(tableColumns, COMPACT_ADMIN_USERS_TABLE_COLUMNS)
								? 'border-[var(--admin-ui-accent)]/40 bg-[var(--admin-ui-accent-soft)] text-[var(--admin-ui-fg)]'
								: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg-muted)] hover:bg-[var(--admin-ui-accent-soft)]'
						}`}
					>
						{t('adminUsersHub.filters.tableCompact')}
					</button>
					<button
						type="button"
						onClick={() =>
							setTableColumns({ ...DEFAULT_ADMIN_USERS_TABLE_COLUMNS })
						}
						className={`rounded-full border px-2.5 py-0.5 text-xs ${
							tableColumnsEqual(tableColumns, DEFAULT_ADMIN_USERS_TABLE_COLUMNS)
								? 'border-[var(--admin-ui-accent)]/40 bg-[var(--admin-ui-accent-soft)] text-[var(--admin-ui-fg)]'
								: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg-muted)] hover:bg-[var(--admin-ui-accent-soft)]'
						}`}
					>
						{t('adminUsersHub.filters.tableFull')}
					</button>
					<details className="relative inline-block">
						<summary className="cursor-pointer list-none rounded-full border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] px-2.5 py-0.5 text-xs text-[var(--admin-ui-fg-muted)] hover:bg-[var(--admin-ui-accent-soft)] [&::-webkit-details-marker]:hidden">
							{t('adminUsersHub.filters.columns')}
						</summary>
						<div className="absolute right-0 z-20 mt-1 min-w-48 rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-2 shadow-xl text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
							{ADMIN_USERS_TOGGLEABLE_COLUMN_IDS.map((colId) => (
								<label
									key={colId}
									className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-[var(--admin-ui-accent-soft)]"
								>
									<input
										type="checkbox"
										className="h-3.5 w-3.5 rounded border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]"
										checked={tableColumns[colId]}
										onChange={() =>
											setTableColumns(
												toggleAdminUsersTableColumn(tableColumns, colId)
											)
										}
									/>
									{t(`adminUsersHub.columns.${colId}`)}
								</label>
							))}
						</div>
					</details>
				</div>
				<label className="flex items-center gap-2 mb-0.5 cursor-pointer select-none">
					<input
						type="checkbox"
						className="h-4 w-4 rounded border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]"
						checked={autoRefresh}
						onChange={(e) => setAutoRefresh(e.target.checked)}
					/>
					<span className={uiCaption}>
						{t('adminUsersHub.filters.autoRefresh')}
					</span>
				</label>
			</div>
		</details>
	);
}
