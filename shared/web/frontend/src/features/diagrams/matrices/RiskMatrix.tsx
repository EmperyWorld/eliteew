/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Editorial ranked risk cards for Kursorina report (replaces emoji pipe table).
 *
 * Related:
 * - parseEditorialMatrices.ts
 */

import type { ReactElement } from 'react';
import { cn } from '@/utils/cn';
import type { ParsedRiskMatrix, ParsedRiskRow } from './parseEditorialMatrices';

const LEVEL_LABEL: Record<ParsedRiskRow['level'], string> = {
	critical: 'Критический',
	high: 'Высокий',
	medium: 'Средний',
	low: 'Низкий',
	unknown: 'Уровень',
};

const LEVEL_TONE: Record<ParsedRiskRow['level'], string> = {
	critical: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
	high: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
	medium: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
	low: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
	unknown:
		'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-dim)',
};

export function RiskMatrix({ data }: { data: ParsedRiskMatrix }): ReactElement {
	return (
		<figure
			className="my-5 min-w-0 max-w-full"
			aria-label={data.title}
			data-risk-matrix="1"
		>
			<figcaption className="mb-3 text-sm font-semibold tracking-tight text-(--desktop-text-primary)">
				{data.title}
			</figcaption>
			<ol className="m-0 flex list-none flex-col gap-2.5 p-0">
				{data.rows.map((row) => (
					<li
						key={`${row.category}:${row.name}:${row.score}`}
						className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) p-3.5"
					>
						<div className="flex flex-wrap items-center gap-2">
							<span
								className={cn(
									'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
									LEVEL_TONE[row.level]
								)}
							>
								{LEVEL_LABEL[row.level]}
							</span>
							<span className="text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-dim)">
								{row.category}
							</span>
							<span className="ml-auto text-xs tabular-nums text-(--desktop-text-secondary)">
								P×I {row.score}
								<span className="opacity-60">
									{' '}
									({row.probability}×{row.impact})
								</span>
							</span>
						</div>
						<p className="m-0 mt-2 text-sm font-medium leading-snug text-(--desktop-text-primary)">
							{row.name}
						</p>
						{row.mitigation ? (
							<p className="m-0 mt-1.5 text-xs leading-snug text-(--desktop-text-secondary)">
								<span className="font-medium text-(--desktop-text-dim)">
									Митигация:{' '}
								</span>
								{row.mitigation}
							</p>
						) : null}
					</li>
				))}
			</ol>
		</figure>
	);
}
