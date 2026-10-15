/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders the standalone AMKA projection summary shared by pulse panels and future AMKA shells.
 * It keeps projection display logic inside the AMKA feature boundary.
 *
 * Invariants:
 * - Missing projection data renders nothing for backward-compatible AMKA detail responses.
 * - Stage and status chips use normalized feature helpers, not ad hoc object iteration.
 *
 * Related:
 * - src/features/amka/amkaProjectionModel.ts
 * - shared/api/services/amka_core/projection.py
 */
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import {
	getAmkaProjectionStageCounts,
	getAmkaProjectionStatusCounts,
	getAmkaProjectionTraceCount,
	hasAmkaStandaloneProjection,
} from './amkaProjectionModel';
import type { AmkaStandaloneProjection } from './amkaTypes';

export function AmkaProjectionSummary({
	projection,
	className,
}: {
	projection?: AmkaStandaloneProjection | null;
	className?: string;
}) {
	const { t } = useTranslation('marketing');
	const stageCountEntries = getAmkaProjectionStageCounts(projection);
	const statusCountEntries = getAmkaProjectionStatusCounts(projection);

	if (!hasAmkaStandaloneProjection(projection)) return null;

	return (
		<div className={className}>
			<div className="text-xs font-semibold uppercase tracking-wide text-(--desktop-text-muted)">
				{t('amkaView.projectionTitle')}
			</div>
			<p className="mt-1 text-xs text-(--desktop-text-secondary)">
				{t('amkaView.projectionSummary', {
					driver: projection?.driver_key ?? '—',
					profile: projection?.domain_profile ?? '—',
					traceCount: getAmkaProjectionTraceCount(projection),
				})}
			</p>
			{stageCountEntries.length > 0 ? (
				<div className="mt-1 flex flex-wrap gap-1">
					{stageCountEntries.map(({ stage, count }) => (
						<span
							key={stage}
							className="rounded-md bg-(--desktop-surface-panel) px-1.5 py-0.5 text-[11px] text-(--desktop-text-secondary) ring-1 ring-(--desktop-border-subtle)"
						>
							{stage}: {count}
						</span>
					))}
				</div>
			) : null}
			{statusCountEntries.length > 0 ? (
				<div className="mt-1 flex flex-wrap items-center gap-1">
					<span className="text-[11px] font-medium text-(--desktop-text-muted)">
						{t('amkaView.projectionStatusCountsTitle')}
					</span>
					{statusCountEntries.map(({ status, count }) => (
						<span
							key={status}
							className={cn(
								'rounded-md px-1.5 py-0.5 text-[11px] ring-1 ring-(--desktop-border-subtle)',
								status === 'failed'
									? 'bg-red-500/10 text-red-100'
									: 'bg-(--desktop-surface-panel) text-(--desktop-text-secondary)'
							)}
						>
							{status}: {count}
						</span>
					))}
				</div>
			) : null}
		</div>
	);
}
