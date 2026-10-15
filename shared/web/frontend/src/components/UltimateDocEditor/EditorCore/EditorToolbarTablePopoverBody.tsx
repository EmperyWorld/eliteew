/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Table insert popover form body for Ultimate Doc Editor toolbar.
 *
 * Invariants:
 * - Submit delegates to parent handler; does not call editor APIs directly.
 *
 * Related:
 * - EditorToolbar.tsx, EditorToolbarPopoverFrame.tsx
 */
import type * as React from 'react';
import { DesktopAppButton } from '../../../pages/Desktop/components/DesktopAppChrome';
import { InputV2 } from '../../ui/InputV2';

export interface EditorToolbarTablePopoverBodyProps {
	tableRowsInputRef: React.RefObject<HTMLInputElement | null>;
	tableRows: string;
	onTableRowsChange: (value: string) => void;
	tableCols: string;
	onTableColsChange: (value: string) => void;
	tableWithHeader: boolean;
	onTableWithHeaderChange: (checked: boolean) => void;
	tableError: string | null;
	onSubmit: (event?: React.FormEvent) => void;
	onClose: () => void;
	rowsLabel: string;
	colsLabel: string;
	headerRowLabel: string;
	cancelLabel: string;
	insertLabel: string;
}

export function EditorToolbarTablePopoverBody({
	tableRowsInputRef,
	tableRows,
	onTableRowsChange,
	tableCols,
	onTableColsChange,
	tableWithHeader,
	onTableWithHeaderChange,
	tableError,
	onSubmit,
	onClose,
	rowsLabel,
	colsLabel,
	headerRowLabel,
	cancelLabel,
	insertLabel,
}: EditorToolbarTablePopoverBodyProps) {
	return (
		<form className="space-y-3" onSubmit={onSubmit}>
			<div className="grid grid-cols-2 gap-3">
				<InputV2
					ref={tableRowsInputRef}
					label={rowsLabel}
					type="number"
					min={1}
					max={12}
					value={tableRows}
					onChange={(event) => onTableRowsChange(event.target.value)}
				/>
				<InputV2
					label={colsLabel}
					type="number"
					min={1}
					max={12}
					value={tableCols}
					onChange={(event) => onTableColsChange(event.target.value)}
				/>
			</div>
			<label className="flex items-center gap-3 rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-3 text-sm text-(--desktop-text-secondary) transition hover:border-[rgb(var(--desktop-accent-rgb))]/45 hover:bg-(--desktop-surface-accent) hover:text-white">
				<input
					type="checkbox"
					className="h-4 w-4 rounded-sm border-(--desktop-border-subtle) bg-(--desktop-surface-soft) accent-[rgb(var(--desktop-accent-rgb))]"
					checked={tableWithHeader}
					onChange={(event) => onTableWithHeaderChange(event.target.checked)}
				/>
				<span>{headerRowLabel}</span>
			</label>
			{tableError && <p className="text-sm text-rose-300">{tableError}</p>}
			<div className="flex items-center justify-end gap-2 pt-1">
				<DesktopAppButton
					type="button"
					size="sm"
					onClick={onClose}
					variant="ghost"
				>
					{cancelLabel}
				</DesktopAppButton>
				<DesktopAppButton
					type="submit"
					variant="accent"
					size="sm"
					className="px-5"
				>
					{insertLabel}
				</DesktopAppButton>
			</div>
		</form>
	);
}
