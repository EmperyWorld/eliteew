/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared prop and presence-command types for the admin user detail panel atomization.
 *
 * Invariants:
 * - PendingPresence actions are limited to logout and reload socket commands.
 *
 * Related:
 * - `pages/Admin/adminUserDetail/AdminUserDetailPanel.tsx`
 * - `pages/Admin/adminUsersDetailTab.ts`
 */

import type { AdminUserDetailTab } from '../adminUsersDetailTab';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';

export type PendingPresence = {
	userId: string;
	action: 'logout' | 'reload';
	label: string;
};

export type AdminUserDetailPanelProps = {
	open: boolean;
	userRow: AdminDirectoryUserRow | null;
	onClose: () => void;
	onUserUpdated: () => void;
	initialDetailTab?: AdminUserDetailTab;
	onDetailTabChange?: (tab: AdminUserDetailTab) => void;
};
