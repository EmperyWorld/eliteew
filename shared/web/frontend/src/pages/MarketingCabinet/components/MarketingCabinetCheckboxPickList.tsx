/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Virtualized checkbox picker for marketing-cabinet forms (JTBD / segments in compact fieldsets).
 *
 * Invariants:
 * - Uses MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD; below threshold renders a simple stack.
 *
 * Related:
 * - views/SegmentsView.tsx, views/CampaignsView.tsx
 */
import { VirtualVariableList } from '@/components/shared/VirtualList';

import {
	MARKETING_FORM_CHECKBOX_PICK_ROW_ESTIMATE_PX,
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
} from '../constants';

export function MarketingCabinetCheckboxPickList<T extends { id: string }>({
	items,
	getLabel,
	selectedIds,
	onToggle,
	checkboxClassName,
	listHeight = 192,
	estimateRowPx = MARKETING_FORM_CHECKBOX_PICK_ROW_ESTIMATE_PX,
	labelClassName = 'flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-sm text-(--desktop-text-secondary) transition-colors hover:bg-(--desktop-surface-soft) sm:py-1.5',
}: {
	items: T[];
	getLabel: (item: T) => string;
	selectedIds: Set<string>;
	onToggle: (id: string, checked: boolean) => void;
	checkboxClassName: string;
	listHeight?: number;
	estimateRowPx?: number;
	labelClassName?: string;
}) {
	const renderPickRow = (item: T) => (
		<label className={labelClassName}>
			<input
				type="checkbox"
				className={checkboxClassName}
				checked={selectedIds.has(item.id)}
				onChange={(event) => onToggle(item.id, event.target.checked)}
			/>
			<span className="min-w-0 flex-1 wrap-break-word leading-snug">
				{getLabel(item)}
			</span>
		</label>
	);

	if (items.length > MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD) {
		return (
			<VirtualVariableList
				items={items}
				estimateSize={() => estimateRowPx}
				getItemKey={(index) => items[index]?.id ?? `pick-${index}`}
				height={listHeight}
				overscanCount={6}
				className="rounded-(--desktop-radius)"
				renderItem={(item) => <div className="pb-1">{renderPickRow(item)}</div>}
			/>
		);
	}

	return (
		<div className="grid gap-1 sm:gap-2">
			{items.map((item) => (
				<div key={item.id}>{renderPickRow(item)}</div>
			))}
		</div>
	);
}
