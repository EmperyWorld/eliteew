/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Virtual list row for EWRP document picker modal.
 *
 * Related:
 * - `useEwrpGeneratorDocPicker.ts`, `EwrpGeneratorModals.tsx`
 */

import { CheckIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { EwrpExpandableClampedText } from '../EwrpExpandableClampedText';
import {
	contentTypeBadgeShort,
	formatEwrpDocPickerDate,
	sw,
	type ContentItem,
} from '../EwrpGeneratorChunks';

export type EwrpDocPickerVirtualRowProps = {
	item: ContentItem;
	selected: boolean;
	onPick: (item: ContentItem) => void;
};

export function EwrpDocPickerVirtualRow({
	item,
	selected,
	onPick,
}: EwrpDocPickerVirtualRowProps) {
	return (
		<div className="border-b border-(--desktop-border-subtle) last:border-b-0">
			<button
				type="button"
				onClick={() => onPick(item)}
				aria-current={selected ? 'true' : undefined}
				className={cn(
					'flex min-h-14 w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-(--desktop-surface-soft-hover)',
					selected &&
						'bg-[rgb(var(--desktop-accent-rgb)/0.07)] ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.22)]'
				)}
			>
				<div className="flex min-w-0 flex-1 items-start gap-2">
					<span
						className="mt-0.5 inline-flex h-6 min-w-7 shrink-0 items-center justify-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-accent) px-0.5 text-[10px] font-semibold tabular-nums text-(--desktop-text-secondary)"
						title={item.content_type}
					>
						{contentTypeBadgeShort(item.content_type)}
					</span>
					<EwrpExpandableClampedText
						embedded
						tone="secondary"
						text={item.name}
						textClassName="text-sm text-(--desktop-text-primary)"
						expandLabelKey="form.docPickerFileNameExpand"
						collapseLabelKey="form.docPickerFileNameCollapse"
						stopTogglePropagation
						maxLines={1}
						className="min-w-0 flex-1"
					/>
				</div>
				<div className="mt-0.5 flex shrink-0 items-center gap-2">
					{selected ? (
						<CheckIcon
							className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
							strokeWidth={sw}
							aria-hidden
						/>
					) : null}
					<span className="text-[11px] text-(--desktop-text-dim)">
						{formatEwrpDocPickerDate(item.created_at)}
					</span>
				</div>
			</button>
		</div>
	);
}
