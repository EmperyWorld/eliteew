/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * History-open toolbar row for the EWRP Generate tab.
 *
 * Invariants:
 * - Props-only presentational — no local store.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { ClockIcon } from '@heroicons/react/24/outline';
import { sw } from '../EwrpGeneratorChunks';

export type EwrpGenerateTabHistoryToolbarProps = {
	secondaryBtnClass: string;
	historyJobsCount: number;
	onOpenHistory: () => void;
};

export function EwrpGenerateTabHistoryToolbar({
	secondaryBtnClass,
	historyJobsCount,
	onOpenHistory,
}: EwrpGenerateTabHistoryToolbarProps) {
	const { t } = useTranslation('ewrp');

	return (
		<div className="flex flex-wrap items-center justify-end gap-2">
			<button
				type="button"
				onClick={onOpenHistory}
				className={cn(secondaryBtnClass, 'gap-2 text-[11px] sm:text-xs')}
				title={t('form.historyOpenModalTitle')}
				data-ewrp-guide="history"
			>
				<ClockIcon
					className="h-3.5 w-3.5 shrink-0"
					strokeWidth={sw}
					aria-hidden
				/>
				{t('form.historyOpenModal')}
				{historyJobsCount > 0 ? (
					<span className="rounded-md bg-(--desktop-surface-soft) px-1.5 py-px text-[10px] font-semibold tabular-nums text-(--desktop-text-dim)">
						{historyJobsCount}
					</span>
				) : null}
			</button>
		</div>
	);
}
