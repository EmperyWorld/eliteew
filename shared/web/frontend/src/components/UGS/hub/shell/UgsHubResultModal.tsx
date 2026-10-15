/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen modal for viewing a completed UGS task result.
 *
 * Related:
 * - UgsHubResultContent.tsx, ugsHubSharedUi.tsx
 */

import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import type { UGSTask } from '../../../../hooks/api/useUgsDashboard';
import { DESKTOP_LUCIDE } from '../../../../pages/Desktop/constants';
import { cn } from '../../../../utils/cn';
import { UgsHubResultContent } from '../results/UgsHubResultContent';
import {
	UgsHubModalFrame,
	ugsHubHeaderBtnClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
} from '../ugsHubSharedUi';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';
import { formatDateTime } from '../utils/ugsHubFormatting';

export interface UgsHubResultModalProps {
	task: UGSTask;
	displayName: string;
	loading: boolean;
	allowRawJson: boolean;
	backdropZ: number;
	contentZ: number;
	onClose: () => void;
	onDownload: () => void;
	onCopy: (content: string) => void;
}

export const UgsHubResultModal: FC<UgsHubResultModalProps> = ({
	task,
	displayName,
	loading,
	allowRawJson,
	backdropZ,
	contentZ,
	onClose,
	onDownload,
	onCopy,
}) => {
	const { t, i18n } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const btn = ugsHubHeaderBtnClasses(theme);

	return (
		<UgsHubModalFrame
			backdropZ={backdropZ}
			contentZ={contentZ}
			onClose={onClose}
			maxWidthClass="max-w-4xl"
			maxHeightClass="max-h-[82vh]"
			header={
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						<p
							className={cn(
								'text-xs uppercase tracking-[0.25em]',
								ugsHubTextMuted(theme)
							)}
						>
							{t('resultModal.eyebrow')}
						</p>
						<h2
							className={cn(
								'truncate text-lg font-semibold',
								ugsHubTextPrimary(theme)
							)}
						>
							{displayName}
						</h2>
						<p className={cn('text-xs', ugsHubTextMuted(theme))}>
							{formatDateTime(
								task.updated_at || task.created_at,
								i18n.language
							)}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<button
							type="button"
							onClick={onDownload}
							className={cn(btn, 'text-xs')}
						>
							<ArrowDownTrayIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{t('common.download')}
						</button>
						<button
							type="button"
							onClick={onClose}
							className={btn}
							aria-label={t('common.closeAria')}
						>
							<XMarkIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</button>
					</div>
				</div>
			}
		>
			{loading ? (
				<div
					className={cn(
						'flex items-center gap-2 text-sm',
						ugsHubTextMuted(theme)
					)}
				>
					<ArrowPathIcon
						className="h-5 w-5 animate-spin motion-reduce:animate-none"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('resultModal.loading')}
				</div>
			) : (
				<UgsHubResultContent
					task={task}
					onCopy={onCopy}
					allowRawJson={allowRawJson}
				/>
			)}
		</UgsHubModalFrame>
	);
};
