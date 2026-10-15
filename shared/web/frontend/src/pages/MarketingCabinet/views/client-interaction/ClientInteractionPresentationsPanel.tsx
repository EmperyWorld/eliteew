import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import type {
	ClientEwrpJobListItem,
	ClientPresShare,
} from '../../marketingCabinetApi';

const ClientPresentationPdfViewer = lazy(async () => {
	const m = await import('../../components/ClientPresentationPdfViewer');
	return { default: m.ClientPresentationPdfViewer };
});

export type ClientInteractionPresentationsPanelProps = {
	embedded: boolean;
	mcPanel: string;
	ixPadding: string;
	readOnlyMarketing: boolean;
	isLead: boolean;
	ewrpJobs: ClientEwrpJobListItem[] | undefined;
	ewrpLoaded: boolean;
	sharePresPending: boolean;
	onShareJob: (jobId: string) => void;
	shares: ClientPresShare[] | undefined;
	revokePresPending: boolean;
	onRevokeShare: (shareId: string) => void;
	onOpenPresentationPreview: (shareId: string) => void;
	onDownloadPresPdf: (shareId: string) => void;
	presObjectUrl: string | null;
	presViewerMinH: string;
};

export function ClientInteractionPresentationsPanel({
	embedded,
	mcPanel,
	ixPadding,
	readOnlyMarketing,
	isLead,
	ewrpJobs,
	ewrpLoaded,
	sharePresPending,
	onShareJob,
	shares,
	revokePresPending,
	onRevokeShare,
	onOpenPresentationPreview,
	onDownloadPresPdf,
	presObjectUrl,
	presViewerMinH,
}: ClientInteractionPresentationsPanelProps) {
	const { t } = useTranslation('marketing');

	return (
		<div
			className={cn(
				mcPanel,
				'flex min-h-0 flex-col gap-4',
				ixPadding,
				embedded && 'flex-1',
				!embedded && 'rounded-(--desktop-radius-xl)'
			)}
		>
			<div className="min-w-0 space-y-1 border-b border-(--desktop-border-subtle)/55 pb-3">
				{!embedded ? (
					<DesktopAppSectionLabel className="mb-0">
						{t('clientInteractionView.presTitle')}
					</DesktopAppSectionLabel>
				) : null}
				<p
					className={cn(
						'leading-relaxed',
						embedded
							? DESKTOP_TYPOGRAPHY.meta
							: 'text-xs text-(--desktop-text-secondary)'
					)}
				>
					{readOnlyMarketing
						? t('clientInteractionView.presHintCustomer')
						: t('clientInteractionView.presHint')}
				</p>
			</div>

			{isLead && (ewrpJobs?.length ?? 0) > 0 ? (
				<div className="flex flex-wrap gap-2">
					{ewrpJobs?.map((job) => (
						<DesktopAppButton
							key={job.id}
							type="button"
							size="sm"
							variant="neutral"
							disabled={!job.has_html || sharePresPending}
							onClick={() => onShareJob(job.id)}
						>
							{t('clientInteractionView.shareSelected')}:{' '}
							{job.title || job.id.slice(0, 8)}
						</DesktopAppButton>
					))}
				</div>
			) : null}
			{isLead && ewrpLoaded && (ewrpJobs?.length ?? 0) === 0 ? (
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					{t('clientInteractionView.noEwrpJobs')}
				</p>
			) : null}

			<div
				className={cn(
					'grid min-h-0 min-w-0 flex-1 gap-4',
					!embedded &&
						'lg:grid-cols-[minmax(14rem,22rem)_minmax(0,1fr)] lg:items-start'
				)}
			>
				<div
					className={cn(
						mcPanel,
						'flex min-h-0 min-w-0 flex-col gap-2',
						embedded
							? 'max-h-[min(40vh,22rem)] overflow-y-auto'
							: 'max-h-[min(42vh,24rem)] overflow-y-auto p-3 lg:sticky lg:top-1 lg:max-h-[min(calc(100vh-12rem),52rem)] lg:overflow-y-auto'
					)}
				>
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'font-semibold uppercase tracking-[0.08em]'
						)}
					>
						{t('clientInteractionView.published')}
					</div>
					<ul className="space-y-2">
						{(shares ?? []).map((s) => (
							<li
								key={s.share_id}
								className={cn(
									mcPanel,
									'flex flex-wrap items-center gap-2 rounded p-2 text-sm'
								)}
							>
								<span className="min-w-0 flex-1 truncate">
									{s.title || s.ewrp_job_id}
								</span>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => void onOpenPresentationPreview(s.share_id)}
								>
									{readOnlyMarketing
										? t('clientInteractionView.watchPdf')
										: t('clientInteractionView.watchHtml')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="neutral"
									onClick={() => void onDownloadPresPdf(s.share_id)}
								>
									{t('clientInteractionView.downloadPdf')}
								</DesktopAppButton>
								{isLead ? (
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										className="text-amber-600/95 hover:text-amber-500"
										disabled={revokePresPending}
										onClick={() => onRevokeShare(s.share_id)}
									>
										{t('clientInteractionView.revokePresentation')}
									</DesktopAppButton>
								) : null}
							</li>
						))}
						{(shares ?? []).length === 0 ? (
							<li className={DESKTOP_TYPOGRAPHY.meta}>—</li>
						) : null}
					</ul>
				</div>
				<div
					className={cn(
						mcPanel,
						'flex min-h-0 min-w-0 flex-col overflow-hidden',
						presViewerMinH
					)}
				>
					{presObjectUrl ? (
						readOnlyMarketing ? (
							<Suspense
								fallback={
									<div
										className={cn(
											'flex flex-1 items-center justify-center p-4',
											DESKTOP_TYPOGRAPHY.meta,
											presViewerMinH
										)}
									>
										{t('clientInteractionView.loading')}
									</div>
								}
							>
								<ClientPresentationPdfViewer
									fileUrl={presObjectUrl}
									className="h-full min-h-0 rounded-md bg-(--desktop-surface-base)"
								/>
							</Suspense>
						) : (
							<div
								data-desktop-iframe-host=""
								className="flex h-full min-h-0 w-full flex-1"
							>
								<iframe
									title="presentation-html"
									className="h-full w-full min-h-0 flex-1 rounded-md border-0 bg-(--desktop-surface-base)"
									src={presObjectUrl}
								/>
							</div>
						)
					) : (
						<div
							className={cn(
								'flex flex-1 items-center justify-center p-4 text-center',
								DESKTOP_TYPOGRAPHY.meta,
								presViewerMinH
							)}
						>
							{readOnlyMarketing
								? t('clientInteractionView.openPdfPreviewHint')
								: t('clientInteractionView.watchHtml')}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
