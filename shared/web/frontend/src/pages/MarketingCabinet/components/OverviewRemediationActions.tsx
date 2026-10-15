import { useMemo, useState } from 'react';
import {
	ArrowPathIcon,
	CheckCircleIcon,
	ClipboardDocumentListIcon,
	ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { marketingCabinetApi } from '../marketingCabinetApi';
import { extractApiErrorMessage } from '../utils';
import { cn } from '@/utils/cn';
import {
	marketingCabinetDashboardLayoutInvalidationQueryKey,
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';

interface OverviewRemediationActionsProps {
	projectId: string;
	issueCodes: string[];
	allowAlert?: boolean;
	compact?: boolean;
	className?: string;
}

export function OverviewRemediationActions({
	projectId,
	issueCodes,
	allowAlert = false,
	compact = false,
	className,
}: OverviewRemediationActionsProps) {
	const { t } = useTranslation('marketing');
	const queryClient = useQueryClient();
	const [feedback, setFeedback] = useState<{
		tone: 'success' | 'error';
		text: string;
	} | null>(null);
	const uniqueIssueCodes = useMemo(
		() =>
			Array.from(
				new Set(issueCodes.map((code) => code.trim()).filter(Boolean))
			),
		[issueCodes]
	);

	const remediationMutation = useMutation({
		mutationFn: (target: 'task' | 'alert') =>
			marketingCabinetApi.createRemediationActions({
				project_id: projectId,
				issue_codes: uniqueIssueCodes,
				target,
			}),
		onSuccess: async (response, target) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
						'tasks',
						projectId
					),
				}),
				queryClient.invalidateQueries({
					queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
						'alerts',
						projectId
					),
				}),
				queryClient.invalidateQueries({
					queryKey:
						marketingCabinetProjectDashboardInvalidationQueryKey(projectId),
				}),
				queryClient.invalidateQueries({
					queryKey:
						marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
				}),
			]);

			const createdCount = (response.created ?? []).length;
			const existingCount = (response.existing ?? []).length;
			const createdText =
				createdCount > 0
					? t(`overview.remediationActions.created.${target}`, {
							count: createdCount,
						})
					: '';
			const existingText =
				existingCount > 0
					? t('overview.remediationActions.existing', { count: existingCount })
					: '';
			setFeedback({
				tone: 'success',
				text:
					[createdText, existingText].filter(Boolean).join(' · ') ||
					t('overview.remediationActions.ready'),
			});
		},
		onError: (error) => {
			setFeedback({
				tone: 'error',
				text: extractApiErrorMessage(
					error,
					t('overview.remediationActions.error')
				),
			});
		},
	});

	if (!projectId || uniqueIssueCodes.length === 0) {
		return null;
	}

	const isBulk = uniqueIssueCodes.length > 1;
	const pendingTarget = remediationMutation.isPending
		? remediationMutation.variables
		: null;
	const showChrome = !compact;

	return (
		<DesktopAppSurface
			variant="soft"
			className={cn(
				'flex min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center',
				showChrome &&
					'border border-(--mc-accent-35)/25 bg-(--desktop-surface-accent)/[0.07] p-2.5 shadow-none',
				!showChrome && 'border-transparent bg-transparent p-0 shadow-none',
				className
			)}
		>
			<DesktopAppButton
				type="button"
				size="sm"
				variant={compact ? 'neutral' : 'accent'}
				className="shrink-0"
				disabled={remediationMutation.isPending}
				onClick={() => remediationMutation.mutate('task')}
			>
				{pendingTarget === 'task' ? (
					<ArrowPathIcon
						className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				) : (
					<ClipboardDocumentListIcon
						className="h-3.5 w-3.5"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				)}
				{isBulk
					? t('overview.remediationActions.createTaskBulk')
					: compact
						? t('overview.remediationActions.taskCompact')
						: t('overview.remediationActions.createTask')}
			</DesktopAppButton>

			{allowAlert ? (
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					className={cn(
						'shrink-0',
						!compact &&
							'border-amber-600/35 bg-amber-950/30 text-amber-100/95 hover:bg-amber-950/45',
						compact &&
							'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)'
					)}
					disabled={remediationMutation.isPending}
					onClick={() => remediationMutation.mutate('alert')}
				>
					{pendingTarget === 'alert' ? (
						<ArrowPathIcon
							className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					) : (
						<ExclamationTriangleIcon
							className="h-3.5 w-3.5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					)}
					{isBulk
						? t('overview.remediationActions.createAlertBulk')
						: compact
							? t('overview.remediationActions.alertCompact')
							: t('overview.remediationActions.createAlert')}
				</DesktopAppButton>
			) : null}

			{feedback ? (
				<div
					className={cn(
						'flex min-w-0 items-start gap-1.5 text-xs leading-snug sm:inline-flex sm:items-center',
						feedback.tone === 'success'
							? 'text-(--mc-accent-85)'
							: 'text-red-300/90'
					)}
					role="status"
				>
					{feedback.tone === 'success' ? (
						<CheckCircleIcon
							className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					) : null}
					<span className="min-w-0 break-words">{feedback.text}</span>
				</div>
			) : null}
		</DesktopAppSurface>
	);
}
