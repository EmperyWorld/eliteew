/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing survey deadline badge for runner/list headers.
 *
 * Related:
 * - SurveyHubDesktopApp.tsx, surveyHubUserUtils.ts
 */
import { cn } from '@/utils/cn';
import { ClockIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { formatSurveyDateLabel, surveyClosesSoon } from './surveyHubUserUtils';

type Props = {
	closesAt: string | null | undefined;
	className?: string;
};

export function SurveyUserDeadlineBadge({
	closesAt,
	className,
}: Props): React.ReactElement | null {
	const { t } = useTranslation('surveys');
	const label = formatSurveyDateLabel(closesAt);
	if (!label) return null;
	const urgent = surveyClosesSoon(closesAt);

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
				urgent
					? 'border-amber-500/40 bg-amber-500/12 text-amber-100'
					: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)',
				className
			)}
		>
			<ClockIcon
				className="size-3.5 shrink-0"
				strokeWidth={DESKTOP_LUCIDE.stroke}
				aria-hidden
			/>
			{t('list.closesAt', { date: label })}
		</span>
	);
}
