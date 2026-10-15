/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Completed-job PDF download / open / copy actions for the EWRP Presentations status column (non-editing).
 *
 * Invariants:
 * - Props-driven presentational extract — no local orchestration SoT.
 * - Parent `EwrpPresentationsTabPanel` remains the Presentations tab orchestrator.
 *
 * Related:
 * - `EwrpPresentationsTabPanel.tsx`
 * - `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 * - `documentation/product/EWRP-EDITOR.md`
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { EwrpStatusResponse } from '../../services/ewrpApi';
import { sw } from './EwrpGeneratorChunks';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	CheckIcon,
	LinkIcon,
	PresentationChartBarIcon,
} from '@heroicons/react/24/outline';

export type EwrpPresentationsCompletedPdfActionsProps = {
	jobId: string | null;
	status: EwrpStatusResponse;
	secondaryBtnClass: string;
	primaryBtnClass: string;
	downloading: boolean;
	handleDownload: () => void | Promise<void>;
	handleOpenPdfNewTab: () => void;
	pdfUrlCopied: boolean;
	handleCopyPdfUrl: () => void | Promise<void>;
	statusManualPollPending: boolean;
	handleManualPollStatus: () => void;
	setPdfPresentationOpen: (open: boolean) => void;
};

export function EwrpPresentationsCompletedPdfActions(
	props: EwrpPresentationsCompletedPdfActionsProps
) {
	const { t } = useTranslation('ewrp');
	const {
		jobId,
		status,
		secondaryBtnClass,
		primaryBtnClass,
		downloading,
		handleDownload,
		handleOpenPdfNewTab,
		pdfUrlCopied,
		handleCopyPdfUrl,
		statusManualPollPending,
		handleManualPollStatus,
		setPdfPresentationOpen,
	} = props;

	return (
		<div className="mt-4 shrink-0 border-t border-(--desktop-border-subtle) pt-4">
			{status.pdf_url ? (
				<div className="space-y-2">
					<button
						type="button"
						onClick={() => void handleDownload()}
						disabled={downloading}
						aria-busy={downloading}
						className={cn(
							primaryBtnClass,
							'w-full shrink-0 gap-2.5 rounded-2xl py-3.5'
						)}
					>
						{downloading ? (
							<ArrowPathIcon
								className="h-5 w-5 shrink-0 animate-spin"
								strokeWidth={sw}
							/>
						) : (
							<ArrowDownTrayIcon
								className="h-5 w-5 shrink-0 opacity-95"
								strokeWidth={sw}
							/>
						)}
						<span>
							{downloading
								? t('form.downloadPdfRunning')
								: t('form.downloadPdfIdle')}
						</span>
					</button>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => setPdfPresentationOpen(true)}
							className={cn(
								secondaryBtnClass,
								'min-w-40 flex-1 justify-center gap-2 py-2.5 text-[11px]'
							)}
							title={t('presentation.hint')}
						>
							<PresentationChartBarIcon
								className="h-3.5 w-3.5 shrink-0"
								strokeWidth={sw}
							/>
							{t('presentation.openButton')}
						</button>
						<button
							type="button"
							onClick={handleOpenPdfNewTab}
							className={cn(
								secondaryBtnClass,
								'min-w-40 flex-1 justify-center gap-2 py-2.5 text-[11px]'
							)}
							title={t('form.pdfLinkHintToken')}
							aria-label={t('form.openPdfNewTabAria')}
						>
							<ArrowTopRightOnSquareIcon
								className="h-3.5 w-3.5 shrink-0"
								strokeWidth={sw}
							/>
							{t('form.openPdfNewTab')}
						</button>
						<button
							type="button"
							onClick={() => void handleCopyPdfUrl()}
							className={cn(
								secondaryBtnClass,
								'min-w-40 flex-1 justify-center gap-2 py-2.5 text-[11px]',
								pdfUrlCopied && 'border-emerald-500/35 text-emerald-200/95'
							)}
							title={t('form.copyPdfUrlTitle')}
							aria-label={
								pdfUrlCopied
									? t('form.copyPdfUrlCopied')
									: t('form.copyPdfUrlTitle')
							}
						>
							{pdfUrlCopied ? (
								<CheckIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={sw} />
							) : (
								<LinkIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={sw} />
							)}
							{pdfUrlCopied
								? t('form.copyPdfUrlCopied')
								: t('form.copyPdfUrlIdle')}
						</button>
					</div>
					<p
						className={cn(DESKTOP_TYPOGRAPHY.meta, 'text-(--desktop-text-dim)')}
					>
						{t('form.pdfLinkHintSame')}
					</p>
				</div>
			) : (
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={() => void handleManualPollStatus()}
						disabled={!jobId || statusManualPollPending}
						aria-busy={statusManualPollPending || undefined}
						className={cn(
							secondaryBtnClass,
							'gap-2 py-2.5',
							statusManualPollPending && 'opacity-80'
						)}
					>
						{statusManualPollPending ? (
							<ArrowPathIcon
								className="h-4 w-4 shrink-0 animate-spin"
								strokeWidth={sw}
							/>
						) : (
							<ArrowPathIcon className="h-4 w-4" strokeWidth={sw} />
						)}
						{t('form.refreshStatusShort')}
					</button>
					<span className={DESKTOP_TYPOGRAPHY.body}>
						{t('form.pdfReadyPollHint')}
					</span>
				</div>
			)}
		</div>
	);
}
