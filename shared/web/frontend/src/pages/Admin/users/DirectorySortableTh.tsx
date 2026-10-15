/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sortable column header for admin Users directory table.
 *
 * Invariants:
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/users/AdminUsersCatalogTable.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type {
	AdminDirectorySortBy,
	AdminDirectorySortDir,
} from '../adminDirectorySort';

export function DirectorySortableTh({
	label,
	sortKey,
	sortBy,
	sortDir,
	onSort,
	className = '',
}: {
	label: string;
	sortKey: AdminDirectorySortBy;
	sortBy: AdminDirectorySortBy;
	sortDir: AdminDirectorySortDir;
	onSort: (key: AdminDirectorySortBy) => void;
	className?: string;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const active = sortBy === sortKey;
	return (
		<th className={`p-3 ${className}`}>
			<button
				type="button"
				onClick={() => onSort(sortKey)}
				className={`inline-flex items-center gap-1 text-[length:var(--admin-ui-text-sm)] ${
					active
						? 'text-[var(--admin-ui-accent)]'
						: 'text-[var(--admin-ui-fg-muted)] hover:text-[var(--admin-ui-fg)]'
				}`}
				aria-label={t('adminUsersHub.sortByColumnAria', { label })}
			>
				{label}
				<span className="text-[10px] tabular-nums opacity-80" aria-hidden>
					{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
				</span>
			</button>
		</th>
	);
}
