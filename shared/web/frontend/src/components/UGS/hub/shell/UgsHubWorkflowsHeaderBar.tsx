/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Workflows tab header extras: admin queue-snapshot strip and manual «+100» page load.
 *
 * Related:
 * - UgsHubQueueOpsStrip.tsx, ugsHubSharedUi.tsx
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE } from '../../../../pages/Desktop/constants';
import { cn } from '../../../../utils/cn';
import { UgsHubQueueOpsStrip } from '../UgsHubQueueOpsStrip';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';
import { ugsHubHeaderBtnClasses } from '../ugsHubSharedUi';

export interface UgsHubWorkflowsHeaderBarProps {
	showUgsAdminLink: boolean;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	isMobile: boolean;
	onOpenAdmin?: () => void;
	onLoadMore: () => void;
}

export const UgsHubWorkflowsHeaderBar: FC<UgsHubWorkflowsHeaderBarProps> = ({
	showUgsAdminLink,
	hasNextPage,
	isFetchingNextPage,
	isMobile,
	onOpenAdmin,
	onLoadMore,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();

	if (!showUgsAdminLink && !hasNextPage) return null;

	return (
		<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
			{showUgsAdminLink ? (
				<UgsHubQueueOpsStrip onOpenAdmin={onOpenAdmin} />
			) : (
				<span />
			)}
			{hasNextPage ? (
				<button
					type="button"
					onClick={onLoadMore}
					disabled={isFetchingNextPage}
					className={cn(
						ugsHubHeaderBtnClasses(theme),
						isFetchingNextPage && 'cursor-progress opacity-60'
					)}
				>
					<ArrowPathIcon
						className={cn(
							'h-4 w-4',
							isFetchingNextPage && 'animate-spin motion-reduce:animate-none'
						)}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{isMobile ? t('common.loadMore') : t('common.loadMoreBatch')}
				</button>
			) : null}
		</div>
	);
};
