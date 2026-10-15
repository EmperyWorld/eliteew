/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Editorial 2×2 SWOT panel for Kursorina report (replaces dense GFM SWOT table).
 *
 * Related:
 * - parseEditorialMatrices.ts
 */

import type { ReactElement } from 'react';
import { cn } from '@/utils/cn';
import type { ParsedSwot, SwotQuadrantKey } from './parseEditorialMatrices';

const QUAD_META: Record<SwotQuadrantKey, { label: string; tone: string }> = {
	strengths: {
		label: 'Сильные стороны',
		tone: 'border-emerald-500/35 bg-emerald-500/8',
	},
	weaknesses: {
		label: 'Слабые стороны',
		tone: 'border-amber-500/35 bg-amber-500/8',
	},
	opportunities: {
		label: 'Возможности',
		tone: 'border-sky-500/35 bg-sky-500/8',
	},
	threats: {
		label: 'Угрозы',
		tone: 'border-rose-500/35 bg-rose-500/8',
	},
};

const ORDER: SwotQuadrantKey[] = [
	'strengths',
	'weaknesses',
	'opportunities',
	'threats',
];

export function SwotMatrix({ data }: { data: ParsedSwot }): ReactElement {
	return (
		<figure
			className="my-5 min-w-0 max-w-full"
			aria-label={data.title}
			data-swot-matrix="1"
		>
			<figcaption className="mb-3 text-sm font-semibold tracking-tight text-(--desktop-text-primary)">
				{data.title}
			</figcaption>
			<div className="grid gap-3 sm:grid-cols-2">
				{ORDER.map((key) => {
					const meta = QUAD_META[key];
					const items = data.quadrants[key];
					return (
						<section
							key={key}
							className={cn(
								'rounded-(--desktop-radius-lg) border p-3.5',
								meta.tone
							)}
						>
							<h4 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
								{meta.label}
							</h4>
							{items.length === 0 ? (
								<p className="m-0 mt-2 text-xs text-(--desktop-text-secondary)">
									—
								</p>
							) : (
								<ul className="m-0 mt-2 list-disc space-y-1.5 pl-4 text-sm leading-snug text-(--desktop-text-primary)">
									{items.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							)}
						</section>
					);
				})}
			</div>
		</figure>
	);
}
