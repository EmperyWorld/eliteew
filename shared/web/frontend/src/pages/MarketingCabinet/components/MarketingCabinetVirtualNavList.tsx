/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Windowed list for marketing-cabinet company/project nav rows (DesktopAppListRow).
 *
 * Invariants:
 * - Below MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD renders a plain stack (no virtualizer).
 *
 * Related:
 * - sections/CompaniesSection.tsx, sections/ProjectsSection.tsx
 */
import type { ReactNode } from 'react';

import { VirtualVariableList } from '@/components/shared/VirtualList';

import { MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD } from '../constants';

export function MarketingCabinetVirtualNavList<T>({
	items,
	estimateSize,
	getItemKey,
	renderItem,
	listClassName = 'space-y-2',
	height = 420,
}: {
	items: T[];
	estimateSize: (index: number) => number;
	getItemKey: (index: number) => string | number;
	renderItem: (item: T, index: number) => ReactNode;
	listClassName?: string;
	height?: number;
}) {
	if (items.length > MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD) {
		return (
			<VirtualVariableList
				items={items}
				estimateSize={estimateSize}
				getItemKey={getItemKey}
				height={height}
				overscanCount={6}
				className="rounded-(--desktop-radius)"
				renderItem={(item, index) => (
					<div className="pb-2">{renderItem(item, index)}</div>
				)}
			/>
		);
	}
	return (
		<div className={listClassName}>
			{items.map((item, index) => renderItem(item, index))}
		</div>
	);
}
