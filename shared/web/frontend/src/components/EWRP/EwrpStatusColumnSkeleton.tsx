/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Placeholder layout for the EWRP status column while the active job status is hydrating.
 *
 * Invariants:
 * - Renders only as a visual/status placeholder; does not fetch API data.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `EwrpHistoryListSkeleton`
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';

export type EwrpStatusColumnSkeletonProps = {
	className?: string;
};

export function EwrpStatusColumnSkeleton({
	className,
}: EwrpStatusColumnSkeletonProps) {
	const { t } = useTranslation('ewrp');

	return (
		<div
			role="status"
			aria-live="polite"
			aria-busy="true"
			className={cn(
				'flex min-h-[280px] animate-pulse flex-col overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-panel)/80 px-4 py-4 ring-1 ring-black/4',
				className
			)}
		>
			<span className="sr-only">{t('skeleton.statusLoading')}</span>
			<div className="mb-4 flex items-center justify-between gap-3 border-b border-(--desktop-border-subtle)/40 pb-4">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<div className="h-8 w-8 shrink-0 rounded-lg bg-(--desktop-surface-accent)" />
					<div className="min-w-0 flex-1 space-y-2">
						<div className="h-2.5 w-24 rounded bg-(--desktop-surface-accent)/80" />
						<div className="h-3.5 max-w-[72%] rounded bg-(--desktop-surface-accent)" />
					</div>
				</div>
				<div className="h-7 w-24 shrink-0 rounded-full bg-(--desktop-surface-accent)/70" />
			</div>
			<div className="mb-4 space-y-2">
				<div className="h-2 w-full rounded-full bg-(--desktop-surface-accent)/55" />
				<div className="flex justify-between gap-2">
					<div className="h-2 w-16 rounded bg-(--desktop-surface-accent)/45" />
					<div className="h-2 w-10 rounded bg-(--desktop-surface-accent)/45" />
				</div>
			</div>
			<div className="mb-4 rounded-xl border border-(--desktop-border-subtle)/45 bg-(--desktop-surface-soft)/35 px-3 py-2.5">
				<div className="h-2.5 w-8 rounded bg-(--desktop-surface-accent)/60" />
				<div className="mt-2 h-3 max-w-[88%] rounded bg-(--desktop-surface-accent)/75" />
			</div>
			<div className="flex flex-wrap gap-2">
				<div className="h-6 w-20 rounded-full bg-(--desktop-surface-accent)/50" />
				<div className="h-6 w-28 rounded-full bg-(--desktop-surface-accent)/45" />
				<div className="h-6 w-24 rounded-full bg-(--desktop-surface-accent)/40" />
			</div>
			<div className="mt-auto space-y-2 pt-6">
				<div className="h-9 w-full rounded-xl bg-(--desktop-surface-accent)/40" />
				<div className="h-9 max-w-[62%] rounded-xl bg-(--desktop-surface-accent)/35" />
			</div>
		</div>
	);
}
