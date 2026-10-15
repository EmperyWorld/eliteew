/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-file upload queue panel for Content Manager with retry and dismiss actions.
 *
 * Invariants:
 * - Retry is only offered for failed items; dismiss clears non-uploading rows via parent.
 *
 * Related:
 * - `hooks/useContentManagerUploadOrchestration.ts`
 * - `ContentManagerPro.tsx`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	CheckCircleIcon,
	ClockIcon,
	XCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import type { ContentManagerUploadQueueItem } from '../hooks/useContentManagerUploadOrchestration';

export type ContentManagerUploadQueuePanelProps = {
	queue: ContentManagerUploadQueueItem[];
	retryFile: (itemId: string) => void | Promise<void>;
	clearQueue: () => void;
	uploading: boolean;
	className?: string;
};

function statusIcon(status: ContentManagerUploadQueueItem['status']) {
	switch (status) {
		case 'success':
			return <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-400" />;
		case 'failed':
			return <XCircleIcon className="h-4 w-4 shrink-0 text-red-400" />;
		case 'uploading':
			return (
				<ArrowPathIcon className="h-4 w-4 shrink-0 animate-spin text-violet-300" />
			);
		default:
			return <ClockIcon className="h-4 w-4 shrink-0 text-slate-400" />;
	}
}

export function ContentManagerUploadQueuePanel({
	queue,
	retryFile,
	clearQueue,
	uploading,
	className,
}: ContentManagerUploadQueuePanelProps): React.ReactElement | null {
	const { t } = useTranslation('contentManager');

	if (queue.length === 0) {
		return null;
	}

	const hasDismissable = queue.some((q) => q.status !== 'uploading');

	return (
		<section
			className={cn(
				'rounded-xl border border-white/10 bg-black/30 p-3',
				className
			)}
			aria-label={t('pro.uploadQueue.title')}
		>
			<div className="mb-2 flex items-center justify-between gap-2">
				<h3 className={DESKTOP_TYPOGRAPHY.caption}>
					{t('pro.uploadQueue.title')} ({queue.length})
				</h3>
				{hasDismissable && !uploading ? (
					<button
						type="button"
						onClick={clearQueue}
						className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white`}
					>
						<XMarkIcon className="h-3.5 w-3.5" />
						{t('pro.uploadQueue.dismiss')}
					</button>
				) : null}
			</div>

			<ul className="max-h-48 space-y-1 overflow-y-auto">
				{queue.map((item) => (
					<li
						key={item.id}
						className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-sm"
					>
						{statusIcon(item.status)}
						<div className="min-w-0 flex-1">
							<p className="truncate text-slate-100">{item.file.name}</p>
							{item.status === 'failed' && item.errorMessage ? (
								<p className="truncate text-xs text-red-300">
									{item.errorMessage}
								</p>
							) : null}
							{item.deduplicated ? (
								<p className="text-xs text-amber-200/80">
									{t('pro.uploadQueue.deduplicated')}
								</p>
							) : null}
						</div>
						{item.status === 'failed' && !uploading ? (
							<button
								type="button"
								onClick={() => void retryFile(item.id)}
								className={`${DESKTOP_INTERACTIVE.btnRounded} shrink-0 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/20`}
							>
								{t('pro.uploadQueue.retry')}
							</button>
						) : null}
					</li>
				))}
			</ul>
		</section>
	);
}
