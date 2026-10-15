import { ModalAdvanced } from '@/components/ui/ModalAdvanced';
import { useNotifications } from '@/notifications';
import { ImcResearchResultMarkdown } from '@/pages/MarketingCabinet/components/ImcResearchResultMarkdown';
import { extractApiErrorMessage } from '@/pages/MarketingCabinet/utils';
import {
	useImcResearchDetail,
	useImcResearchStatus,
} from '@/hooks/api/useImcResearch';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	ArrowPathIcon,
	DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'partial']);

export type CustomerDiagnosticImcAnalysisModalProps = {
	isOpen: boolean;
	onClose: () => void;
	researchId: string | null;
};

export function CustomerDiagnosticImcAnalysisModal({
	isOpen,
	onClose,
	researchId,
}: CustomerDiagnosticImcAnalysisModalProps) {
	const { t } = useTranslation('marketing');
	const { success: notifySuccess } = useNotifications();
	const titleId = useId();
	const [copiedPulse, setCopiedPulse] = useState(false);

	const detailQuery = useImcResearchDetail(researchId ?? undefined);
	const statusQuery = useImcResearchStatus(researchId ?? undefined, {
		pollWhileActive: true,
	});

	useEffect(() => {
		if (!isOpen) setCopiedPulse(false);
	}, [isOpen]);

	useEffect(() => {
		if (statusQuery.data?.status === 'completed') {
			void detailQuery.refetch();
		}
	}, [statusQuery.data?.status, detailQuery.refetch]);

	const status = statusQuery.data?.status ?? detailQuery.data?.status;
	const terminal = status ? TERMINAL.has(status) : false;
	const running = Boolean(
		researchId && !terminal && (status === 'running' || status === 'pending')
	);
	const resultText = detailQuery.data?.result_text?.trim();
	const showResult = Boolean(terminal && resultText);
	const errorMessage =
		status === 'failed'
			? (detailQuery.data?.errors?.[0]?.message ??
				t('imcView.runStatus.failed'))
			: null;

	const handleCopy = async () => {
		if (!resultText) return;
		try {
			await navigator.clipboard.writeText(resultText);
			setCopiedPulse(true);
			notifySuccess(t('imcView.copied'));
			window.setTimeout(() => setCopiedPulse(false), 1600);
		} catch {
			/* ignore */
		}
	};

	return (
		<ModalAdvanced
			isOpen={isOpen}
			onClose={onClose}
			title={t('clientInteractionView.customerDiagnostic.imcModalTitle')}
			variant="desktop"
			size="full"
			animation="fadeScale"
			ariaDescribedBy={titleId}
			footer={
				<div className="flex justify-end gap-2">
					<DesktopAppButton type="button" variant="ghost" onClick={onClose}>
						{t('clientInteractionView.customerDiagnostic.imcModalClose')}
					</DesktopAppButton>
				</div>
			}
		>
			<div className="flex max-h-[min(75vh,40rem)] flex-col gap-3">
				<p id={titleId} className={DESKTOP_APP_STYLE_CONTRACT.helperText}>
					{t('clientInteractionView.customerDiagnostic.imcModalHint')}
				</p>

				{researchId && running ? (
					<div
						className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)"
						role="status"
					>
						<ArrowPathIcon
							className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{statusQuery.data?.progress_message ??
							t('clientInteractionView.customerDiagnostic.imcRunning')}
					</div>
				) : null}

				{detailQuery.isError ? (
					<p className="text-sm text-red-300">
						{extractApiErrorMessage(
							detailQuery.error,
							t('clientInteractionView.customerDiagnostic.imcLoadError')
						)}
					</p>
				) : null}

				{errorMessage && !showResult ? (
					<p className="text-sm text-red-300">{errorMessage}</p>
				) : null}

				{showResult ? (
					<div className="flex min-h-0 flex-col gap-2">
						<div className="flex flex-wrap items-center gap-2">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="gap-1"
								onClick={() => void handleCopy()}
							>
								<DocumentDuplicateIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
								{copiedPulse ? t('imcView.copied') : t('imcView.copyResult')}
							</DesktopAppButton>
						</div>
						<article
							className="min-h-0 flex-1 overflow-y-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-4 sm:p-5"
							aria-label={t(
								'clientInteractionView.customerDiagnostic.imcResultRegion'
							)}
						>
							<ImcResearchResultMarkdown markdown={resultText ?? ''} />
						</article>
					</div>
				) : null}

				{terminal && !resultText && status === 'completed' ? (
					<p className="text-sm text-(--desktop-text-muted)">
						{t('clientInteractionView.customerDiagnostic.imcEmptyResult')}
					</p>
				) : null}
			</div>
		</ModalAdvanced>
	);
}
