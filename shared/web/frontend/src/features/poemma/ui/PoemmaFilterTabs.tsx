/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Segmented filter tabs for POEMMA list views (ideas as buttons, team tasks as tabs).
 *
 * Invariants:
 * - Active tab uses accent variant; inactive uses neutral — matches DesktopAppButton contract.
 * - Ideas use default `roleMode="button"`; team uses `roleMode="tab"` for a11y tests.
 *
 * Related:
 * - src/features/poemma/ideas/PoemmaIdeasPage.tsx
 * - src/features/poemma/team/PoemmaTeamPage.tsx
 */

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type PoemmaFilterTab<T extends string> = {
	key: T;
	label: string;
};

export type PoemmaFilterTabsProps<T extends string> = {
	tabs: PoemmaFilterTab<T>[];
	activeKey: T;
	onChange: (key: T) => void;
	className?: string;
	/** Use `tab` for screens tested with getByRole('tab', …) — e.g. team tasks. */
	roleMode?: 'button' | 'tab';
	tabListAriaLabel?: string;
};

export function PoemmaFilterTabs<T extends string>({
	tabs,
	activeKey,
	onChange,
	className,
	roleMode = 'button',
	tabListAriaLabel,
}: PoemmaFilterTabsProps<T>) {
	return (
		<div
			className={cn('flex flex-wrap gap-2', className)}
			{...(roleMode === 'tab'
				? { role: 'tablist' as const, 'aria-label': tabListAriaLabel }
				: {})}
		>
			{tabs.map((tab) => (
				<DesktopAppButton
					key={tab.key}
					type="button"
					{...(roleMode === 'tab'
						? {
								role: 'tab' as const,
								'aria-selected': activeKey === tab.key,
							}
						: {})}
					variant={activeKey === tab.key ? 'accent' : 'neutral'}
					size="sm"
					onClick={() => onChange(tab.key)}
				>
					{tab.label}
				</DesktopAppButton>
			))}
		</div>
	);
}
