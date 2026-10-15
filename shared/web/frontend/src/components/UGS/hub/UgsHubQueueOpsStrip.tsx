/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline queue-snapshot status strip for embedded UGS Hub (workflows tab compact header).
 *
 * Invariants:
 * - Caller gates on UGS admin; strip does not fetch when disabled upstream.
 * - User-visible copy avoids internal «queue-ops» jargon.
 *
 * Related:
 * - UgsHubQueueOpsPanel.tsx, ugsHubSharedUi.tsx
 */

import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { UGS_WORKSPACE_SEMANTIC } from '@/features/ugs/shared/ugsDesktopUi';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { useUgsQueueOpsSnapshot } from '../../../hooks/api/useUgsQueueOpsSnapshot';
import { useUgsHubShellTheme } from './ugsHubShellThemeContext';
import {
	ugsHubHeaderBtnClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
} from './ugsHubSharedUi';

function statusDotClass(status: string | undefined): string {
	if (status === 'healthy') return UGS_WORKSPACE_SEMANTIC.successDot;
	if (status === 'degraded') return UGS_WORKSPACE_SEMANTIC.warningDot;
	return UGS_WORKSPACE_SEMANTIC.dangerDot;
}

export interface UgsHubQueueOpsStripProps {
	onOpenAdmin?: () => void;
}

export const UgsHubQueueOpsStrip: FC<UgsHubQueueOpsStripProps> = ({
	onOpenAdmin,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const query = useUgsQueueOpsSnapshot();
	const snapshot = query.data;
	const warningCount =
		snapshot?.hints?.filter((h) => h.level === 'warning').length ?? 0;

	return (
		<button
			type="button"
			onClick={onOpenAdmin}
			data-testid="ugs-hub-queue-ops-strip"
			className={cn(
				ugsHubHeaderBtnClasses(theme),
				'max-w-full text-xs',
				DESKTOP_CHROME_FOCUS_VISIBLE
			)}
			title={t('queueOps.stripTitle')}
		>
			<span
				className={cn(
					'h-2 w-2 shrink-0 rounded-full',
					statusDotClass(snapshot?.status)
				)}
				aria-hidden
			/>
			<span className="truncate">
				{t('queueOps.stripLabel')}{' '}
				<span className={cn('font-medium', ugsHubTextPrimary(theme))}>
					{query.isLoading ? '…' : (snapshot?.status ?? '—')}
				</span>
			</span>
			{typeof snapshot?.postgres?.total_queued === 'number' ? (
				<span className={cn('shrink-0 tabular-nums', ugsHubTextMuted(theme))}>
					{t('queueOps.stripQueued', {
						count: snapshot.postgres.total_queued,
					})}
				</span>
			) : null}
			{warningCount > 0 ? (
				<span className={cn('shrink-0', UGS_WORKSPACE_SEMANTIC.warningBadge)}>
					{warningCount}
				</span>
			) : null}
		</button>
	);
};
