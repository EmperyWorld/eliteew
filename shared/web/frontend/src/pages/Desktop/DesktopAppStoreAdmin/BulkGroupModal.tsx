/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bulk assign access group modal for App Store catalog (New World AdminModal).
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 *
 * Related:
 * - `pages/Desktop/DesktopAppStoreAdminPage.tsx` (public barrel)
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useId, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminButton, AdminModal, AdminSelect } from '@/pages/Admin/ui';
import type { AccessGroupResponse } from '../services/desktopAdminApi';

export function BulkGroupModal({
	groups,
	onClose,
	onApply,
}: {
	groups: AccessGroupResponse[];
	onClose: () => void;
	onApply: (groupId: string | null) => Promise<void>;
}): ReactElement {
	const { t } = useTranslation('appStore');
	const [selectedGroup, setSelectedGroup] = useState<string | 'none'>('none');
	const bulkGroupSelectId = `${useId()}-bulk-group`;

	return (
		<AdminModal
			open
			title={t('admin.bulkGroup.title')}
			onClose={onClose}
			footer={
				<>
					<AdminButton variant="ghost" onClick={onClose}>
						{t('admin.common.cancel')}
					</AdminButton>
					<AdminButton
						variant="primary"
						onClick={() =>
							void onApply(selectedGroup === 'none' ? null : selectedGroup)
						}
					>
						{t('admin.bulkGroup.apply')}
					</AdminButton>
				</>
			}
		>
			<p className="mb-4 text-sm text-[var(--admin-ui-fg-muted)]">
				{t('admin.bulkGroup.body')}
			</p>
			<div className="mb-1 text-xs text-[var(--admin-ui-fg-muted)]">
				<label htmlFor={bulkGroupSelectId}>
					{t('admin.bulkGroup.singleGroup')}
				</label>
			</div>
			<AdminSelect
				id={bulkGroupSelectId}
				value={selectedGroup}
				onChange={(e) => setSelectedGroup(e.target.value as string | 'none')}
			>
				<option value="none">{t('admin.bulkGroup.noRestriction')}</option>
				{groups.map((g) => (
					<option key={g.id} value={g.id}>
						{g.name}
					</option>
				))}
			</AdminSelect>
		</AdminModal>
	);
}
