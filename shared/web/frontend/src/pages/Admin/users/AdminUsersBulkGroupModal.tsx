/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal for bulk access-group assignment in admin Users catalog (New World atoms).
 *
 * Invariants:
 * - Presentational; parent owns apply API and busy/progress.
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { AccessGroupResponse } from '../../Desktop/services/desktopAdminApi';
import { AdminButton, AdminModal, AdminSelect } from '../ui';

export function AdminUsersBulkGroupModal({
	open,
	groups,
	onClose,
	onApply,
	busy,
	progress,
}: {
	open: boolean;
	groups: AccessGroupResponse[];
	onClose: () => void;
	onApply: (groupId: string | null) => void;
	busy: boolean;
	progress?: { done: number; total: number } | null;
}): React.ReactElement | null {
	const { t } = useTranslation('desktopUi');
	const [val, setVal] = React.useState<string>('');

	React.useEffect(() => {
		if (open) setVal('');
	}, [open]);

	return (
		<AdminModal
			open={open}
			title={t('adminUsersBulk.title')}
			onClose={onClose}
			footer={
				<>
					<AdminButton variant="ghost" disabled={busy} onClick={onClose}>
						{t('adminUsersBulk.cancel')}
					</AdminButton>
					<AdminButton
						variant="primary"
						disabled={busy}
						onClick={() => onApply(val || null)}
					>
						{busy ? '…' : t('adminUsersBulk.apply')}
					</AdminButton>
				</>
			}
		>
			{progress && progress.total > 0 ? (
				<p className="mb-3 text-sm text-[var(--admin-ui-fg-muted)]">
					{t('adminUsersBulk.progress', {
						done: progress.done,
						total: progress.total,
					})}
				</p>
			) : null}
			<AdminSelect
				aria-label={t('adminUsersBulk.accessGroupAria')}
				title={t('adminUsersBulk.accessGroupAria')}
				value={val}
				onChange={(e) => setVal(e.target.value)}
			>
				<option value="">{t('adminUsersBulk.defaultGroup')}</option>
				{groups.map((g) => (
					<option key={g.id} value={g.id}>
						{g.name}
					</option>
				))}
			</AdminSelect>
		</AdminModal>
	);
}
