/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Premium-styled loading placeholder for lazy Social Hub sections.
 *
 * Invariants:
 * - Uses DesktopAppSkeleton only; no fake data rows.
 *
 * Related:
 * - SocialHubShell.tsx
 */

import { useTranslation } from 'react-i18next';

import { DesktopAppSkeleton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export function SocialHubLoadingPlaceholder({
	className,
	minHeightClass = 'min-h-[320px]',
}: {
	className?: string;
	minHeightClass?: string;
}): JSX.Element {
	const { t } = useTranslation('contentManager');

	return (
		<div
			className={cn('grid gap-3', minHeightClass, className)}
			role="status"
			aria-live="polite"
			aria-busy="true"
			aria-label={t('friends.socialHubSectionLoadingAria')}
		>
			<DesktopAppSkeleton className="h-10 w-2/5 max-w-xs rounded-(--desktop-radius)" />
			<DesktopAppSkeleton className="h-4 w-3/5 max-w-md rounded-(--desktop-radius)" />
			<div className="mt-2 grid gap-2 sm:grid-cols-3">
				<DesktopAppSkeleton className="h-20 rounded-(--desktop-radius-lg)" />
				<DesktopAppSkeleton className="h-20 rounded-(--desktop-radius-lg)" />
				<DesktopAppSkeleton className="h-20 rounded-(--desktop-radius-lg)" />
			</div>
			<DesktopAppSkeleton className="min-h-[180px] flex-1 rounded-(--desktop-radius-lg)" />
		</div>
	);
}
