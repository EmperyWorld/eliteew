/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Plan / fact / percent metric row for POEMMA finance and goal surfaces.
 *
 * Invariants:
 * - Column labels «План», «Факт», «%» are fixed Russian copy for Vitest contracts.
 * - Missing values render «—» without fabricating numbers.
 *
 * Related:
 * - src/features/poemma/finance/PoemmaFinancePage.tsx
 * - src/features/poemma/ui/poemmaUiClasses.ts
 */

import { cn } from '@/utils/cn';
import {
	POEMMA_EYEBROW_LABEL_CLASS,
	POEMMA_METRIC_CELL_CLASS,
	POEMMA_METRIC_VALUE_CLASS,
} from './poemmaUiClasses';

export type PoemmaProfitPlanFactRowProps = {
	planValue: string;
	factValue: string;
	percentValue: string;
	className?: string;
};

function PoemmaProfitPlanFactCell({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className={POEMMA_METRIC_CELL_CLASS}>
			<span className={POEMMA_EYEBROW_LABEL_CLASS}>{label}</span>
			<p className={POEMMA_METRIC_VALUE_CLASS}>{value}</p>
		</div>
	);
}

export function PoemmaProfitPlanFactRow({
	planValue,
	factValue,
	percentValue,
	className,
}: PoemmaProfitPlanFactRowProps) {
	return (
		<div className={cn('grid gap-3 sm:grid-cols-3 sm:gap-4', className)}>
			<PoemmaProfitPlanFactCell label="План" value={planValue} />
			<PoemmaProfitPlanFactCell label="Факт" value={factValue} />
			<PoemmaProfitPlanFactCell label="%" value={percentValue} />
		</div>
	);
}
