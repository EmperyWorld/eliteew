/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin users hub view: directory list with roles, balances, Socket.IO presence channels, and quick access to user detail panel.
 * State and handlers live in `users/useAdminUsersHubController.ts`.
 *
 * Invariants:
 * - Socket.IO channel counters and SSO channel cards are shown separately and can diverge by design.
 * - Bulk access-group assignment updates only selected users on the current filtered page.
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubController.ts`
 * - `pages/Admin/AdminUserDetailPanel.tsx`
 * - `services/admin/api.ts`
 */

import * as React from 'react';
import { AdminUserDetailPanel } from './AdminUserDetailPanel';
import { shortenAdminUserId } from './adminUserRoles';
import { AdminPresenceSection } from './AdminPresenceSection';
import { AdminUsersActiveFilterChips } from './users/AdminUsersActiveFilterChips';
import { AdminUsersBulkActionsBar } from './users/AdminUsersBulkActionsBar';
import { AdminUsersBulkGroupModal } from './users/AdminUsersBulkGroupModal';
import { AdminUsersCatalogCards } from './users/AdminUsersCatalogCards';
import { AdminUsersCatalogFiltersPanel } from './users/AdminUsersCatalogFiltersPanel';
import { AdminUsersCatalogTable } from './users/AdminUsersCatalogTable';
import { AdminUsersCatalogToolbar } from './users/AdminUsersCatalogToolbar';
import { AdminUsersSummaryBar } from './users/AdminUsersSummaryBar';
import { useAdminUsersHubController } from './users/useAdminUsersHubController';
import { AdminSectionTabs, AdminStatusBanner } from './ui';

export function AdminUsersHubSection(): React.ReactElement {
	const c = useAdminUsersHubController();

	return (
		<div className="px-4 py-6 sm:px-6 lg:px-8 w-full max-w-none">
			<AdminUserDetailPanel
				open={c.panelUser !== null}
				userRow={c.panelUser}
				onClose={c.closeUserPanel}
				onUserUpdated={c.invalidateDirectory}
				initialDetailTab={c.panelDetailTab}
				onDetailTabChange={c.handleDetailTabChange}
			/>

			<AdminUsersBulkGroupModal
				open={c.bulkOpen}
				groups={c.bulkGroups}
				onClose={c.closeBulkModal}
				onApply={(gid) => void c.handleBulkApply(gid)}
				busy={c.bulkBusy}
				progress={c.bulkProgress}
			/>

			<AdminSectionTabs
				className="mb-4"
				tabs={[
					{ id: 'catalog', label: c.t('adminUsersHub.tabs.catalog') },
					{ id: 'online', label: c.t('adminUsersHub.tabs.online') },
				]}
				activeId={c.hubView}
				onChange={(id) =>
					c.setHubViewAndSync(id === 'online' ? 'online' : 'catalog')
				}
			/>

			{c.hubView === 'online' ? (
				<AdminPresenceSection
					embedded
					onOpenInCatalog={c.handleOpenUserFromPresence}
				/>
			) : null}

			{c.hubView === 'catalog' && c.payload ? (
				<AdminUsersSummaryBar
					total={c.payload.total}
					onlineOnPage={c.onlineOnPage}
					mismatchOnPage={c.mismatchOnPage}
					mismatchOnly={c.mismatchOnly}
					selectedCount={c.selectedUserIds.length}
					redisAvailable={c.payload.redis_available}
					summary={c.payload.summary}
					onApplyOnlineFilter={c.applySummaryOnlineFilter}
					onApplyAnomalyFilter={c.applySummaryAnomalyFilter}
					onApplySsoBrowserFilter={c.applySummarySsoBrowserFilter}
					onApplySsoMobileFilter={c.applySummarySsoMobileFilter}
					onApplySsoDesktopFilter={c.applySummarySsoDesktopFilter}
					onApplyMismatchFilter={c.applySummaryMismatchFilter}
				/>
			) : null}

			{c.hubView === 'catalog' && c.panelUser ? (
				<nav
					className="eliteew-admin-users-breadcrumb"
					aria-label={c.t('adminUsersHub.hubActions.userCardNavAria')}
				>
					<button type="button" onClick={c.closeUserPanel}>
						{c.t('adminUsersHub.breadcrumb.catalog')}
					</button>
					<span aria-hidden> / </span>
					<span className="text-slate-200">
						{c.panelUser.username ||
							c.panelUser.email ||
							shortenAdminUserId(c.panelUser.id)}
					</span>
				</nav>
			) : null}

			{c.hubView === 'catalog' ? (
				<div className="eliteew-admin-panel flex flex-col gap-4 eliteew-admin-filter-panel">
					<AdminUsersCatalogToolbar
						namedPresets={c.namedPresets}
						selectedPresetId={c.selectedPresetId}
						onPresetSelect={c.handlePresetSelect}
						onDeletePreset={c.handleDeleteNamedPreset}
						onSavePreset={c.handleSaveNamedPreset}
						onCopyShareLink={c.handleCopyShareLink}
						onRefresh={c.refetchDirectory}
						loading={c.loading}
					/>
					<AdminUsersActiveFilterChips
						chips={c.activeFilterChipDefs}
						onClearChip={c.handleClearFilterChip}
						onClearAll={c.hasActiveFilters ? c.clearFilters : undefined}
					/>
					<AdminUsersCatalogFiltersPanel ctrl={c.filtersCtrl} />
				</div>
			) : null}

			{c.hubView === 'catalog' ? (
				<AdminUsersBulkActionsBar
					selectedCount={c.selectedUserIds.length}
					filterTotal={c.payload?.total ?? null}
					loading={c.loading}
					selectAllBusy={c.selectAllBusy}
					onSelectAllMatching={() => void c.handleSelectAllMatchingFilter()}
					onExportAllMatching={() => void c.handleExportAllMatchingCsv()}
					onBulkGroup={c.openBulkModal}
					onExportSelected={c.handleExportSelectedCsv}
				/>
			) : null}

			{c.hubView === 'catalog' && c.payload && !c.payload.redis_available ? (
				<AdminStatusBanner tone="warning" className="mb-4">
					{c.t('adminUsersHub.redis.banner')}
					{c.redisFilterHintKeys.length > 0 ? (
						<ul className="mt-2 list-disc pl-5">
							{c.redisFilterHintKeys.map((key) => (
								<li key={key}>{c.t(key)}</li>
							))}
						</ul>
					) : (
						<>
							{c.onlineOnly ? c.t('adminUsersHub.redis.fallbackOnline') : null}
							{c.anomalyOnly
								? c.t('adminUsersHub.redis.fallbackAnomaly')
								: null}
							{c.mismatchOnly
								? c.t('adminUsersHub.redis.fallbackMismatch')
								: null}
						</>
					)}
				</AdminStatusBanner>
			) : null}

			{c.hubView === 'catalog' && c.error ? (
				<AdminStatusBanner tone="danger" className="mb-4">
					{c.error}
				</AdminStatusBanner>
			) : null}

			{c.hubView === 'catalog' ? (
				c.mobileCatalog ? (
					<AdminUsersCatalogCards
						loading={c.loading}
						total={c.payload?.total ?? 0}
						tableList={c.tableList}
						selectedUserIds={c.selectedUserIds}
						panelUser={c.panelUser}
						mismatchOnly={c.mismatchOnly}
						anomalyOnly={c.anomalyOnly}
						toggleOne={c.toggleOne}
						onOpenUser={c.openUserPanel}
						page={c.page}
						totalPages={c.totalPages}
						onPageChange={(fn) => c.setPage(fn)}
					/>
				) : (
					<AdminUsersCatalogTable
						loading={c.loading}
						payload={c.payload}
						tableList={c.tableList}
						tableColumns={c.tableColumns}
						channelsCompact={c.channelsCompact}
						tableColSpan={c.tableColSpan}
						selectedUserIds={c.selectedUserIds}
						panelUser={c.panelUser}
						sortBy={c.sort_by}
						sortDir={c.sort_dir}
						onSort={c.toggleColumnSort}
						mismatchOnly={c.mismatchOnly}
						anomalyOnly={c.anomalyOnly}
						toggleAll={c.toggleAll}
						toggleOne={c.toggleOne}
						onOpenUser={c.openUserPanel}
						page={c.page}
						totalPages={c.totalPages}
						onPageChange={(fn) => c.setPage(fn)}
					/>
				)
			) : null}
		</div>
	);
}
