/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Simple Admin New World data table.
 * Invariants: Presentational only; no Old World chrome imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { adminUiTableWrapClass } from '../adminTokens';

export type AdminDataTableColumn<T> = {
	id: string;
	header: ReactNode;
	cell: (row: T) => ReactNode;
	className?: string;
};

export type AdminDataTableProps<T> = {
	columns: AdminDataTableColumn<T>[];
	rows: T[];
	rowKey: (row: T) => string;
	empty?: ReactNode;
	className?: string;
};

export function AdminDataTable<T>({
	columns,
	rows,
	rowKey,
	empty,
	className,
}: AdminDataTableProps<T>) {
	if (rows.length === 0 && empty) {
		return <div className={className}>{empty}</div>;
	}

	return (
		<div className={cn(adminUiTableWrapClass, className)}>
			<table className="w-full border-collapse text-left text-[length:var(--admin-ui-text-sm)]">
				<thead>
					<tr className="border-b border-[var(--admin-ui-border)] text-[var(--admin-ui-fg-muted)]">
						{columns.map((col) => (
							<th
								key={col.id}
								scope="col"
								className={cn('px-3 py-2 font-medium', col.className)}
							>
								{col.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr
							key={rowKey(row)}
							className="border-b border-[var(--admin-ui-border)]/60 last:border-0"
						>
							{columns.map((col) => (
								<td
									key={col.id}
									className={cn(
										'px-3 py-2 text-[var(--admin-ui-fg)]',
										col.className
									)}
								>
									{col.cell(row)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
