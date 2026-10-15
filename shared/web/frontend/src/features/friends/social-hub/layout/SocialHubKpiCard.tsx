/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Interactive KPI tile for Social Hub home section.
 *
 * Invariants:
 * - Button semantics; value is tabular-nums for stable layout.
 *
 * Related:
 * - sections/SocialHubHomeSection.tsx
 * - socialHubLayoutTokens.ts
 */

import type { ComponentType, SVGProps } from 'react';

import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import {
	shKpiCardClass,
	SH_KPI_LABEL_CLASS,
	SH_KPI_VALUE_CLASS,
	SH_KPI_VALUE_EMPHASIS_CLASS,
} from './socialHubLayoutTokens';

export function SocialHubKpiCard({
	label,
	value,
	icon: Icon,
	emphasize = false,
	shellPanel,
	onClick,
}: {
	label: string;
	value: number;
	icon: ComponentType<SVGProps<SVGSVGElement>>;
	emphasize?: boolean;
	shellPanel: string;
	onClick: () => void;
}): JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			className={shKpiCardClass(emphasize, shellPanel)}
		>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-[radial-gradient(circle_at_top,rgba(var(--desktop-accent-rgb),0.16),transparent_72%)] opacity-0 motion-safe:transition-opacity group-hover:opacity-100 motion-reduce:opacity-0"
			/>
			{emphasize ? (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-[rgb(var(--desktop-accent-rgb))]/55"
				/>
			) : null}
			<div className={SH_KPI_LABEL_CLASS}>
				<Icon
					className={cn(
						DESKTOP_LUCIDE.sm,
						emphasize && 'text-(--desktop-accent)'
					)}
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				<span className="truncate">{label}</span>
			</div>
			<div
				className={cn(
					SH_KPI_VALUE_CLASS,
					emphasize && SH_KPI_VALUE_EMPHASIS_CLASS
				)}
			>
				{value}
			</div>
		</button>
	);
}
