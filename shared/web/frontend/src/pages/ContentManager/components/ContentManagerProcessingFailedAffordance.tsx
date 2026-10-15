/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-visible retry affordance when unified_content processing_status is failed.
 *
 * Invariants:
 * - Shown only when canReprocessUnifiedContent(item) and onReprocess handler is provided.
 * - Click handlers stop propagation so card/row selection is not toggled.
 *
 * Related:
 * - utils/contentManagerReprocess.ts
 * - ContentManagerFileCard.tsx, ContentManagerFileRow.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { cn } from '../../../utils/cn';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import {
	canReprocessUnifiedContent,
	isUnifiedContentProcessingFailed,
} from '../utils/contentManagerReprocess';

export type ContentManagerProcessingFailedAffordanceProps = {
	item: ContentItem;
	onReprocess?: (id: string, name: string) => void | Promise<void>;
	displayLabel: string;
	layout?: 'card' | 'row';
	className?: string;
};

export function ContentManagerProcessingFailedAffordance({
	item,
	onReprocess,
	displayLabel,
	layout = 'card',
	className,
}: ContentManagerProcessingFailedAffordanceProps): React.ReactElement | null {
	const { t } = useTranslation('contentManager');

	if (!isUnifiedContentProcessingFailed(item)) {
		return null;
	}
	if (!onReprocess || !canReprocessUnifiedContent(item)) {
		return null;
	}

	const errorHint =
		typeof item.processing_error === 'string' && item.processing_error.trim()
			? item.processing_error.trim()
			: null;

	const handleRetry = (event: React.MouseEvent<HTMLButtonElement>): void => {
		event.preventDefault();
		event.stopPropagation();
		void onReprocess(item.id, displayLabel);
	};

	if (layout === 'row') {
		return (
			<div
				className={cn(
					'col-span-full flex flex-wrap items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1.5',
					className
				)}
			>
				<div className="flex min-w-0 flex-1 items-start gap-1.5">
					<ExclamationTriangleIcon
						className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
						aria-hidden
					/>
					<div className="min-w-0">
						<p className="text-xs font-medium text-red-100">
							{t('pro.processingFailed.badge')}
						</p>
						{errorHint ? (
							<p
								className="line-clamp-2 text-[11px] text-red-200/80"
								title={errorHint}
							>
								{errorHint}
							</p>
						) : null}
					</div>
				</div>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={handleRetry}
					className="h-7 shrink-0 border border-red-400/25 text-xs text-red-100 hover:bg-red-500/15"
				>
					<ArrowPathIcon className="h-3.5 w-3.5 shrink-0" />
					{t('pro.processingFailed.retryButton')}
				</DesktopAppButton>
			</div>
		);
	}

	return (
		<div
			className={cn(
				'mt-1 flex flex-col gap-1 rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1.5',
				className
			)}
		>
			<div className="flex items-start gap-1.5">
				<ExclamationTriangleIcon
					className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300"
					aria-hidden
				/>
				<div className="min-w-0 flex-1">
					<p className="text-[10px] font-medium leading-tight text-red-100">
						{t('pro.processingFailed.badge')}
					</p>
					{errorHint ? (
						<p
							className="line-clamp-2 text-[9px] leading-tight text-red-200/80"
							title={errorHint}
						>
							{errorHint}
						</p>
					) : null}
				</div>
			</div>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				onClick={handleRetry}
				className="h-6 w-full justify-center border border-red-400/25 text-[10px] text-red-100 hover:bg-red-500/15"
			>
				<ArrowPathIcon className="h-3 w-3 shrink-0" />
				{t('pro.processingFailed.retryButton')}
			</DesktopAppButton>
		</div>
	);
}
