/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Active-job status banner on the EWRP Generate tab (completed / failed / in-progress).
 *
 * Invariants:
 * - Props-only presentational — no local store.
 * - Renders null when jobId or status is missing.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`, `EwrpExpandableClampedText.tsx`
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { EwrpStatusResponse } from '@/services/ewrpApi';
import { EwrpExpandableClampedText } from '../EwrpExpandableClampedText';
import { ewrpClampedTextNeedsExpand } from '../ewrpExpandableClampedText';

export type EwrpGenerateTabActiveJobBannerProps = {
	jobId: string | null;
	status: EwrpStatusResponse | null;
	activeJobBannerHeadline: string;
	secondaryBtnClass: string;
	onOpenPresentationsStatus: () => void;
};

export function EwrpGenerateTabActiveJobBanner({
	jobId,
	status,
	activeJobBannerHeadline,
	secondaryBtnClass,
	onOpenPresentationsStatus,
}: EwrpGenerateTabActiveJobBannerProps) {
	const { t } = useTranslation('ewrp');

	if (!jobId || !status) return null;

	return (
		<div
			className={cn(
				'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 sm:px-4',
				status.status === 'completed'
					? 'border-emerald-500/35 bg-emerald-500/8'
					: status.status === 'failed'
						? 'border-red-500/35 bg-red-950/20'
						: 'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.06)]'
			)}
			role="status"
		>
			<div className="min-w-0 flex-1">
				{ewrpClampedTextNeedsExpand(activeJobBannerHeadline) ? (
					<EwrpExpandableClampedText
						text={activeJobBannerHeadline}
						tone="secondary"
						className="mb-1.5"
						textClassName="text-xs font-semibold text-(--desktop-text-primary)"
						expandLabelKey="form.statusTopicExpand"
						collapseLabelKey="form.statusTopicCollapse"
						maxLines={1}
					/>
				) : (
					<p className="mb-1.5 truncate text-xs font-semibold text-(--desktop-text-primary)">
						{activeJobBannerHeadline}
					</p>
				)}
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'text-(--desktop-text-secondary)'
					)}
				>
					{status.status === 'completed'
						? t('tabs.resultReadyHint')
						: status.status === 'failed'
							? t('tabs.resultFailedHint')
							: t('tabs.progressHint')}
				</p>
			</div>
			<button
				type="button"
				onClick={onOpenPresentationsStatus}
				className={cn(secondaryBtnClass, 'shrink-0 text-[11px]')}
			>
				{t('tabs.openStatus')}
			</button>
		</div>
	);
}
