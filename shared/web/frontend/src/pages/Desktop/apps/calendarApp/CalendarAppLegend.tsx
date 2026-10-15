/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline legend for personal events vs assistant plan overlay chips.
 *
 * Related:
 * - CalendarApp.tsx
 */

import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

export function CalendarAppLegend(): ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'calendarApp' });

	return (
		<div
			className={`${DESKTOP_TYPOGRAPHY.caption} flex flex-wrap items-center gap-x-4 gap-y-1 text-(--desktop-text-muted)`}
		>
			<span className="inline-flex items-center gap-1.5">
				<span
					className="h-2 w-2 rounded-full bg-[rgb(var(--desktop-accent-rgb))]"
					aria-hidden
				/>
				{t('legendPersonalEvents')}
			</span>
			<span className="inline-flex items-center gap-1.5">
				<span
					className="h-2 w-2 rounded-full border border-dashed border-[hsl(198_72%_38%)] bg-[hsl(198_72%_42%_/_0.35)]"
					aria-hidden
				/>
				{t('legendAssistantPlan')}
			</span>
		</div>
	);
}
