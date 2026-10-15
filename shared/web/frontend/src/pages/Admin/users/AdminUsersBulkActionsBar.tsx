/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bulk selection actions for admin Users catalog (select all, CSV, group assign).
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
	ArrowDownTrayIcon,
	ArrowPathIcon,
	KeyIcon,
} from '@heroicons/react/24/outline';
import { AdminButton } from '../ui';

export type AdminUsersBulkActionsBarProps = {
	selectedCount: number;
	filterTotal: number | null;
	loading: boolean;
	selectAllBusy: boolean;
	onSelectAllMatching: () => void;
	onExportAllMatching: () => void;
	onBulkGroup: () => void;
	onExportSelected: () => void;
};

export function AdminUsersBulkActionsBar(
	props: AdminUsersBulkActionsBarProps
): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const {
		selectedCount,
		filterTotal,
		loading,
		selectAllBusy,
		onSelectAllMatching,
		onExportAllMatching,
		onBulkGroup,
		onExportSelected,
	} = props;

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
					{selectedCount > 0 ? (
						<>
							{t('adminUsersHub.bulk.selected')}{' '}
							<span className="text-[var(--admin-ui-fg)]">{selectedCount}</span>
						</>
					) : (
						t('adminUsersHub.bulk.hintSelect')
					)}
				</span>
				{filterTotal != null && filterTotal > 0 ? (
					<>
						<AdminButton
							variant="secondary"
							disabled={selectAllBusy || loading}
							onClick={onSelectAllMatching}
							className="py-1.5"
						>
							{selectAllBusy ? (
								<ArrowPathIcon
									className="h-3.5 w-3.5 animate-spin"
									aria-hidden
								/>
							) : null}
							{t('adminUsersHub.bulk.selectAll')}
							{filterTotal <= 200 ? (
								<span className="text-[var(--admin-ui-fg-muted)]">
									({filterTotal})
								</span>
							) : (
								<span className="text-amber-400/90">
									{t('adminUsersHub.bulk.max200')}
								</span>
							)}
						</AdminButton>
						<AdminButton
							variant="secondary"
							disabled={selectAllBusy || loading || filterTotal > 200}
							onClick={onExportAllMatching}
							className="py-1.5"
							title={
								filterTotal > 200
									? t('adminUsersHub.bulk.csvByFilterTitle')
									: undefined
							}
						>
							<ArrowDownTrayIcon className="h-3.5 w-3.5" aria-hidden />
							{t('adminUsersHub.bulk.csvByFilter')}
						</AdminButton>
					</>
				) : null}
				{selectedCount > 0 ? (
					<>
						<AdminButton
							variant="primary"
							onClick={onBulkGroup}
							className="py-1.5"
						>
							<KeyIcon className="h-3.5 w-3.5" />
							{t('adminUsersHub.bulk.assignGroup')}
						</AdminButton>
						<AdminButton
							variant="secondary"
							onClick={onExportSelected}
							className="py-1.5"
						>
							<ArrowDownTrayIcon className="h-3.5 w-3.5" aria-hidden />
							{t('adminUsersHub.bulk.csvSelected')}
						</AdminButton>
					</>
				) : null}
			</div>
		</div>
	);
}
