/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Polished EWRP presentation result/progress card inside companion operations.
 *
 * Invariants:
 * - Presentation generation stays backend-first; this component only renders task-run payloads and existing PDF links.
 * - Edit/open actions draft companion-readable text instead of mutating EWRP state directly.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionOperationRunCard.tsx
 * - documentation/product/ewa/EWA-COMPANION-OPERATIONS-PANEL.md
 */

import {
	ArrowDownTrayIcon,
	ArrowsPointingOutIcon,
	CheckCircleIcon,
	ClockIcon,
	PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
	OperationPresentationSummary,
	OperationReadyPresentation,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import {
	companionProgressBarA11y,
	companionProgressBarValueTextKey,
} from '@/features/ewa/companionUx/companionProgressA11y';
import {
	CompanionGlassCard,
	CompanionPillBadge,
} from '@/features/ewa/companionPremiumPrimitives';
import { notify } from '@/notifications';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { ewrpApi, ewrpPdfDirectDownloadUrl } from '@/services/ewrpApi';
import {
	createRevocableObjectUrlFromBlob,
	triggerBrowserDownloadFromBlob,
	triggerBrowserDownloadFromUrl,
} from '@/utils/browserDownload';
import { cn } from '@/utils/cn';

export type CompanionOperationPresentationCardProps = {
	summary: OperationPresentationSummary;
	readyPresentation: OperationReadyPresentation | null;
	onOpenInEwrp: (jobId: string) => void;
};

export function CompanionOperationPresentationCard({
	summary,
	readyPresentation,
	onOpenInEwrp,
}: CompanionOperationPresentationCardProps) {
	const { t } = useTranslation('marketing');
	const [busyAction, setBusyAction] = useState<'open' | 'download' | null>(
		null
	);
	const slideCount = summary.slidesCount ?? summary.numSlides ?? 0;
	const progress = Math.max(
		0,
		Math.min(100, Math.round(summary.progress || 0))
	);
	const presentationProgressA11y = companionProgressBarA11y(progress, 100, {
		completed: summary.ready,
		percentScale: true,
	});
	const visualSlides = Math.max(3, Math.min(5, slideCount || 4));
	const visualSlideKeys = ['cover', 'agenda', 'story', 'data', 'closing'].slice(
		0,
		visualSlides
	);
	const pdfFileName = readyPresentation
		? `ewrp-${readyPresentation.jobId.slice(0, 8)}.pdf`
		: 'ewrp-presentation.pdf';

	const handleOpenPdf = async () => {
		if (!readyPresentation || busyAction) return;
		const directHref = ewrpPdfDirectDownloadUrl(
			readyPresentation.jobId,
			readyPresentation.pdfDownloadToken
		);
		if (directHref) {
			window.open(directHref, '_blank', 'noopener,noreferrer');
			return;
		}
		setBusyAction('open');
		const openedWindow = window.open('', '_blank', 'noopener,noreferrer');
		try {
			const blob = await ewrpApi.downloadPdf(readyPresentation.jobId);
			const url = createRevocableObjectUrlFromBlob(blob);
			if (openedWindow) {
				if (url) openedWindow.location.href = url;
				return;
			}
			if (url) window.open(url, '_blank', 'noopener,noreferrer');
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_operations_presentation_pdf_open',
				'EWRP PDF open failed',
				err
			);
			if (openedWindow) openedWindow.close();
			notify.error(t('ewaCompanion.operationsPresentationPdfFailed'));
		} finally {
			setBusyAction(null);
		}
	};

	const handleDownloadPdf = async () => {
		if (!readyPresentation || busyAction) return;
		const directHref = ewrpPdfDirectDownloadUrl(
			readyPresentation.jobId,
			readyPresentation.pdfDownloadToken
		);
		if (directHref) {
			triggerBrowserDownloadFromUrl(directHref, { download: pdfFileName });
			return;
		}
		setBusyAction('download');
		try {
			const blob = await ewrpApi.downloadPdf(readyPresentation.jobId);
			triggerBrowserDownloadFromBlob(blob, pdfFileName);
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_operations_presentation_pdf_download',
				'EWRP PDF download failed',
				err
			);
			notify.error(t('ewaCompanion.operationsPresentationPdfFailed'));
		} finally {
			setBusyAction(null);
		}
	};

	return (
		<CompanionGlassCard
			className={cn(
				'mt-2 overflow-hidden rounded-xl p-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.22)]',
				'border-(--companion-divider) bg-[radial-gradient(circle_at_18%_0%,var(--companion-glow),transparent_36%),radial-gradient(circle_at_92%_22%,var(--companion-bg),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.84),rgba(15,23,42,0.48))]'
			)}
			data-testid="presentation-operation-card"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-1.5">
						<CompanionPillBadge
							tone="aura"
							className="text-[9px] font-semibold uppercase tracking-[0.18em]"
						>
							{t('ewaCompanion.operationPresentationDeckBadge')}
						</CompanionPillBadge>
						<CompanionPillBadge
							tone={summary.ready ? 'success' : 'info'}
							className={cn('inline-flex items-center gap-1 text-[10px]')}
						>
							{summary.ready ? (
								<CheckCircleIcon className="size-3" aria-hidden />
							) : (
								<ClockIcon className="size-3" aria-hidden />
							)}
							{summary.ready
								? t('ewaCompanion.operationPresentationPdfReady')
								: t('ewaCompanion.operationPresentationRendering')}
						</CompanionPillBadge>
					</div>
					<p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-white">
						{summary.title || t('ewaCompanion.operationPresentationUntitled')}
					</p>
					{summary.topic ? (
						<p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-(--companion-text-soft)">
							{summary.topic}
						</p>
					) : null}
				</div>
				<div className="shrink-0 text-right">
					<div className="rounded-lg border border-white/15 bg-white/10 px-2 py-1">
						<p className="text-[15px] font-semibold leading-none text-white">
							{slideCount || '—'}
						</p>
						<p className="mt-0.5 text-[9px] text-(--companion-aura)">
							{t('ewaCompanion.operationPresentationSlidesShort')}
						</p>
					</div>
				</div>
			</div>

			<div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
				<div className="min-w-0 space-y-1.5">
					<div className="flex flex-wrap items-center gap-1">
						{summary.presentationTheme ? (
							<CompanionPillBadge className="border-white/15 bg-black/15 text-[10px] text-(--companion-text-soft)">
								{t('ewaCompanion.operationPresentationTheme', {
									theme: summary.presentationTheme,
								})}
							</CompanionPillBadge>
						) : null}
						{summary.jobId ? (
							<CompanionPillBadge className="bg-black/10 text-[10px] text-(--companion-text-soft)">
								{t('ewaCompanion.operationPresentationJobId', {
									id: summary.jobId.slice(0, 8),
								})}
							</CompanionPillBadge>
						) : null}
					</div>
					<div>
						<div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-(--companion-text-soft)">
							<span>
								{summary.ready
									? t('ewaCompanion.operationPresentationReadyShort')
									: t('ewaCompanion.operationPresentationProgress', {
											progress,
										})}
							</span>
							<span className="tabular-nums">{progress}%</span>
						</div>
						<div
							className="h-1.5 overflow-hidden rounded-full bg-black/25"
							role="progressbar"
							aria-valuemin={presentationProgressA11y.valueMin}
							aria-valuemax={presentationProgressA11y.valueMax}
							aria-valuenow={presentationProgressA11y.valueNow}
							aria-valuetext={t(
								companionProgressBarValueTextKey(presentationProgressA11y.mode),
								{
									current: presentationProgressA11y.current,
									total: presentationProgressA11y.total,
									percent: presentationProgressA11y.percent,
								}
							)}
						>
							<div
								className={cn(
									'h-full rounded-full transition-[width] duration-500',
									summary.ready
										? 'bg-emerald-300'
										: 'bg-[linear-gradient(90deg,var(--companion-aura),rgba(125,211,252,0.88),var(--companion-aura))]'
								)}
								style={{ width: `${progress}%` }}
							/>
						</div>
					</div>
				</div>

				<div className="relative h-16 w-20" aria-hidden>
					{visualSlideKeys.map((slideKey, index) => (
						<div
							key={slideKey}
							className="absolute h-11 w-14 rounded-md border border-white/20 bg-white/12 shadow-[0_10px_20px_rgba(0,0,0,0.18)] backdrop-blur"
							style={{
								right: `${index * 5}px`,
								bottom: `${index * 4}px`,
								transform: `rotate(${(index - 1) * 3}deg)`,
								opacity: 1 - index * 0.08,
							}}
						>
							<div className="mx-1 mt-1 h-1 rounded-full bg-white/55" />
							<div className="mx-1 mt-1 h-1 rounded-full bg-(--companion-bg)" />
							<div className="absolute bottom-1 left-1 right-1 h-3 rounded bg-sky-200/25" />
						</div>
					))}
				</div>
			</div>

			{readyPresentation ? (
				<div className="mt-2 flex flex-wrap items-center gap-1">
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-emerald-300/45 px-2 py-1',
							'bg-emerald-400/10 text-[11px] text-emerald-50 hover:bg-emerald-400/20',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => void handleOpenPdf()}
						disabled={busyAction !== null}
						aria-busy={busyAction === 'open'}
					>
						<ArrowsPointingOutIcon className="size-3" aria-hidden />
						<span>{t('ewaCompanion.operationsPresentationOpenPdf')}</span>
					</button>
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1',
							'text-[11px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => void handleDownloadPdf()}
						disabled={busyAction !== null}
						aria-busy={busyAction === 'download'}
					>
						<ArrowDownTrayIcon className="size-3" aria-hidden />
						<span>{t('ewaCompanion.operationsPresentationDownloadPdf')}</span>
					</button>
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-sky-300/35 px-2 py-1',
							'text-[11px] text-sky-50 hover:bg-sky-400/10',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => onOpenInEwrp(readyPresentation.jobId)}
					>
						<PaperAirplaneIcon className="size-3" aria-hidden />
						<span>{t('ewaCompanion.operationsPresentationOpenEditor')}</span>
					</button>
				</div>
			) : (
				<p className="mt-2 text-[10px] text-(--companion-text-soft)">
					{t('ewaCompanion.operationPresentationPreparingHint')}
				</p>
			)}
		</CompanionGlassCard>
	);
}
