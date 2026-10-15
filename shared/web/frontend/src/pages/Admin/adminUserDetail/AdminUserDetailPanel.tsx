/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin user detail side panel shell: presence modal, tab chrome, and tab content routing.
 *
 * Invariants:
 * - Presence section reflects Socket.IO realtime channels; SSO section reflects Keycloak registry independently.
 * - SSO history must surface security-significant events without exposing tokens.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 * - `pages/Admin/adminUserDetail/useAdminUserDetailPanel.ts`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useEmbeddedPortaledModalZIndex } from '../../Desktop/context/DesktopWindowPortalStackContext';
import { ADMIN_USER_DETAIL_TABS } from '../adminUsersDetailTab';
import { PresenceCommandModal } from '../AdminPresenceSection';
import { adminUserDetailTabLabelI18n } from '../adminUserDetailI18n';
import { AdminUserDetailEbrowserTab } from './AdminUserDetailEbrowserTab';
import { AdminUserDetailOverviewTab } from './AdminUserDetailOverviewTab';
import { AdminUserDetailPanelHeader } from './AdminUserDetailPanelHeader';
import { AdminUserDetailSessionsTab } from './AdminUserDetailSessionsTab';
import { AdminUserDetailStoreTab } from './AdminUserDetailStoreTab';
import { AdminUserDetailUgsTab } from './AdminUserDetailUgsTab';
import type { AdminUserDetailPanelProps } from './types';
import { useAdminUserDetailPanel } from './useAdminUserDetailPanel';

const uiSmall =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';

export type { AdminUserDetailPanelProps } from './types';

export function AdminUserDetailPanel(
	props: AdminUserDetailPanelProps
): React.ReactElement | null {
	const vm = useAdminUserDetailPanel(props);
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	if (!props.open || !vm.userRow) return null;

	const userRow = vm.userRow;

	return (
		<>
			<PresenceCommandModal
				open={vm.pendingPresence !== null}
				pending={vm.pendingPresence}
				onCancel={() => {
					if (!vm.presenceBusy) vm.setPendingPresence(null);
				}}
				onConfirm={() => void vm.runPresence()}
				confirmBusy={vm.presenceBusy}
			/>
			<div
				className="fixed inset-0 flex justify-end"
				style={{ zIndex: embeddedModalZ.backdrop }}
				role="presentation"
			>
				<button
					type="button"
					className="absolute inset-0 bg-[var(--admin-ui-backdrop)] transition-opacity duration-200"
					onClick={vm.onClose}
					aria-label={vm.t('adminUserDetail.closePanel')}
				/>
				<div
					ref={vm.panelRef}
					role="dialog"
					aria-modal="true"
					aria-labelledby="admin-user-panel-title"
					className="relative flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-slate-950 shadow-2xl"
					style={{ zIndex: embeddedModalZ.content }}
				>
					<AdminUserDetailPanelHeader
						userRow={userRow}
						t={vm.t}
						onClose={vm.onClose}
						ssoHistory={vm.ssoOverview.data?.history}
					/>

					{!vm.ugsOk ? (
						<div
							className={`shrink-0 border-b border-amber-500/25 bg-amber-500/10 px-4 py-3 ${uiSmall} text-amber-100/95`}
							role="status"
						>
							{vm.t('adminUserDetail.ugsAccessBanner')}
						</div>
					) : null}

					<div
						className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2"
						role="tablist"
						aria-label={vm.t('adminUserDetail.tabsAria')}
					>
						{ADMIN_USER_DETAIL_TABS.map((tab) => (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={vm.detailTab === tab.id}
								onClick={() => vm.selectDetailTab(tab.id)}
								className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
									vm.detailTab === tab.id
										? 'bg-violet-500/25 text-violet-100 border border-violet-500/35'
										: 'text-slate-400 border border-transparent hover:bg-white/5'
								}`}
							>
								{adminUserDetailTabLabelI18n(tab.id, vm.t)}
							</button>
						))}
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-6">
						{vm.detailTab === 'overview' ? (
							<AdminUserDetailOverviewTab
								userRow={userRow}
								t={vm.t}
								trustedDevicesQuery={vm.trustedDevicesQuery}
								trustedDeviceAuditQuery={vm.trustedDeviceAuditQuery}
								trustedDeviceTransfersQuery={vm.trustedDeviceTransfersQuery}
								approveDeviceTransferMut={vm.approveDeviceTransferMut}
								rejectDeviceTransferMut={vm.rejectDeviceTransferMut}
							/>
						) : null}

						{vm.detailTab === 'store' ? (
							<AdminUserDetailStoreTab
								t={vm.t}
								groups={vm.groups}
								groupsQuery={vm.groupsQuery}
								groupId={vm.groupId}
								setGroupId={vm.setGroupId}
								groupDirty={vm.groupDirty}
								saveGroupMut={vm.saveGroupMut}
								ewVal={vm.ewVal}
								setEwVal={vm.setEwVal}
								ewDirty={vm.ewDirty}
								saveEwMut={vm.saveEwMut}
								storeUgsVal={vm.storeUgsVal}
								setStoreUgsVal={vm.setStoreUgsVal}
								storeUgsDirty={vm.storeUgsDirty}
								saveStoreUgsMut={vm.saveStoreUgsMut}
								webSearchQuotaQuery={vm.webSearchQuotaQuery}
								webSearchQuota={vm.webSearchQuota}
								webSearchCoinsVal={vm.webSearchCoinsVal}
								setWebSearchCoinsVal={vm.setWebSearchCoinsVal}
								webSearchMonthlyLimitVal={vm.webSearchMonthlyLimitVal}
								setWebSearchMonthlyLimitVal={vm.setWebSearchMonthlyLimitVal}
								webSearchQuotaDirty={vm.webSearchQuotaDirty}
								saveWebSearchQuotaMut={vm.saveWebSearchQuotaMut}
							/>
						) : null}

						{vm.detailTab === 'ugs' ? (
							<AdminUserDetailUgsTab
								userRow={userRow}
								t={vm.t}
								ugsOk={vm.ugsOk}
								ugsUser={vm.ugsUser}
								patchTrusted={vm.patchTrusted}
								topUpAmount={vm.topUpAmount}
								setTopUpAmount={vm.setTopUpAmount}
								topUpReason={vm.topUpReason}
								setTopUpReason={vm.setTopUpReason}
								topUpMut={vm.topUpMut}
								onUserUpdated={vm.onUserUpdated}
								limDaily={vm.limDaily}
								setLimDaily={vm.setLimDaily}
								limMonthly={vm.limMonthly}
								setLimMonthly={vm.setLimMonthly}
								limConcurrent={vm.limConcurrent}
								setLimConcurrent={vm.setLimConcurrent}
								limitsMut={vm.limitsMut}
								badgeLabel={vm.badgeLabel}
								setBadgeLabel={vm.setBadgeLabel}
								badgeHint={vm.badgeHint}
								setBadgeHint={vm.setBadgeHint}
								badgeMut={vm.badgeMut}
							/>
						) : null}

						{vm.detailTab === 'sessions' ? (
							<AdminUserDetailSessionsTab
								userRow={userRow}
								t={vm.t}
								ssoOverview={vm.ssoOverview}
								saving={vm.saving}
								presenceBusy={vm.presenceBusy}
								setPendingPresence={vm.setPendingPresence}
							/>
						) : null}

						{vm.detailTab === 'ebrowser' ? (
							<AdminUserDetailEbrowserTab userId={userRow.id} t={vm.t} />
						) : null}
					</div>
				</div>
			</div>
		</>
	);
}
