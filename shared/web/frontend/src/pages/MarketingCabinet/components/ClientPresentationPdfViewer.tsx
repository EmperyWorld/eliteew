import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';

const SOFT_MAX_PAGE_STEP = 998;

export type ClientPresentationPdfViewerProps = {
	fileUrl: string;
	className?: string;
};

/**
 * PDF preview via native browser viewer (iframe). Page stepping uses URL #page (Chrome-style).
 */
export function ClientPresentationPdfViewer({
	fileUrl,
	className,
}: ClientPresentationPdfViewerProps) {
	const { t } = useTranslation('marketing');
	const [pageNumber, setPageNumber] = useState(1);
	const iframeSrc = `${fileUrl}#page=${pageNumber}`;

	return (
		<div
			className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
		>
			<div
				data-desktop-iframe-host=""
				className="min-h-0 flex-1 overflow-hidden"
			>
				<iframe
					key={iframeSrc}
					title={t('clientInteractionView.pdfFrameTitle')}
					src={iframeSrc}
					className="h-full min-h-[12rem] w-full border-0"
				/>
			</div>

			<div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-2">
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					disabled={pageNumber <= 1}
					className="gap-1"
					aria-label={t('clientInteractionView.pdfPrevPage')}
					onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
				>
					<ChevronLeftIcon
						className="h-4 w-4 shrink-0"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				</DesktopAppButton>
				<span className="min-w-[4.5rem] text-center text-xs tabular-nums text-(--desktop-text-secondary)">
					{t('clientInteractionView.pdfPageOf', {
						current: pageNumber,
						count: '…',
					})}
				</span>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					disabled={pageNumber >= SOFT_MAX_PAGE_STEP}
					className="gap-1"
					aria-label={t('clientInteractionView.pdfNextPage')}
					onClick={() =>
						setPageNumber((p) => Math.min(SOFT_MAX_PAGE_STEP, p + 1))
					}
				>
					<ChevronRightIcon
						className="h-4 w-4 shrink-0"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				</DesktopAppButton>
			</div>
			<p
				className={cn(
					'px-2 pb-2 text-center text-[10px]',
					DESKTOP_TYPOGRAPHY.meta
				)}
			>
				{t('clientInteractionView.pdfNativeViewerHint')}
			</p>
		</div>
	);
}
