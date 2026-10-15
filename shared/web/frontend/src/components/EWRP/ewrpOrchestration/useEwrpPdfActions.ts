/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * PDF download/open/copy actions and presentation outline export for EWRP jobs.
 *
 * Invariants:
 * - Direct download URL preferred over blob fallback when token present.
 *
 * Related:
 * - `useEwrpGeneratorCompose.tsx`, `ewrpApi`, `EwrpPresentationsCompletedPdfActions.tsx`
 */

import { useCallback, useMemo } from 'react';
import { notify } from '@/notifications';
import {
	ewrpApi,
	ewrpPdfAbsoluteUrl,
	ewrpPdfDirectDownloadUrl,
	type EwrpSlide,
	type EwrpStatusResponse,
} from '@/services/ewrpApi';
import {
	triggerBrowserDownloadFromBlob,
	triggerBrowserDownloadFromUrl,
} from '../../../utils/browserDownload';
import { buildOutlineMarkdown, downloadTextFile } from '../EwrpGeneratorChunks';

export type UseEwrpPdfActionsParams = {
	jobId: string | null;
	status: EwrpStatusResponse | null;
	topic: string;
	title: string;
	downloading: boolean;
	setDownloading: React.Dispatch<React.SetStateAction<boolean>>;
	setCopyDone: React.Dispatch<React.SetStateAction<boolean>>;
	setJobIdCopied: React.Dispatch<React.SetStateAction<boolean>>;
	setPdfUrlCopied: React.Dispatch<React.SetStateAction<boolean>>;
	t: (key: string, opts?: Record<string, unknown>) => string;
};

export function useEwrpPdfActions(params: UseEwrpPdfActionsParams) {
	const {
		jobId,
		status,
		topic,
		title,
		downloading,
		setDownloading,
		setCopyDone,
		setJobIdCopied,
		setPdfUrlCopied,
		t,
	} = params;

	const absolutePdfHref = useMemo(() => {
		if (!jobId || !status?.pdf_url) return null;
		return ewrpPdfAbsoluteUrl(jobId, status.pdf_download_token);
	}, [jobId, status?.pdf_download_token, status?.pdf_url]);

	const handleDownload = useCallback(async () => {
		if (!jobId || !status?.pdf_url || downloading) return;
		const directHref = ewrpPdfDirectDownloadUrl(
			jobId,
			status.pdf_download_token
		);
		if (directHref) {
			triggerBrowserDownloadFromUrl(directHref, {
				download: `ewrp_${jobId}.pdf`,
			});
			notify.success(t('notify.pdfDownloaded'));
			return;
		}
		setDownloading(true);
		try {
			const blob = await ewrpApi.downloadPdf(jobId);
			if (!blob || blob.size === 0) {
				notify.error(
					t('notify.pdfDownloadFailed'),
					t('notify.pdfDownloadEmpty')
				);
				return;
			}
			triggerBrowserDownloadFromBlob(blob, `ewrp_${jobId}.pdf`);
			notify.success(t('notify.pdfDownloaded'));
		} catch (e: unknown) {
			const msg =
				(e as { message?: string })?.message ||
				(e as { response?: { data?: { detail?: string } } })?.response?.data
					?.detail ||
				t('notify.pdfUnavailableOnServer');
			notify.error(t('notify.pdfDownloadFailed'), msg);
		} finally {
			setDownloading(false);
		}
	}, [
		jobId,
		status?.pdf_url,
		status?.pdf_download_token,
		downloading,
		setDownloading,
		t,
	]);

	const handleOpenPdfNewTab = useCallback(() => {
		if (!absolutePdfHref) return;
		window.open(absolutePdfHref, '_blank', 'noopener,noreferrer');
	}, [absolutePdfHref]);

	const handleCopyPdfUrl = useCallback(async () => {
		if (!absolutePdfHref) return;
		try {
			await navigator.clipboard.writeText(absolutePdfHref);
			setPdfUrlCopied(true);
			notify.success(t('notify.pdfLinkCopied'));
			window.setTimeout(() => setPdfUrlCopied(false), 2000);
		} catch {
			notify.error(t('notify.copyFailed'));
		}
	}, [absolutePdfHref, setPdfUrlCopied, t]);

	const handleCopyOutline = useCallback(async () => {
		const slides = status?.slides;
		if (!slides?.length) return;
		const lines = slides.map((s: EwrpSlide, i: number) => {
			const slideTitle =
				s.title?.trim() || t('draft.slideFallback', { n: i + 1 });
			const bullets = (s.bullets || []).filter(Boolean);
			return bullets.length
				? `${i + 1}. ${slideTitle}\n${bullets.map((b) => `  • ${b}`).join('\n')}`
				: `${i + 1}. ${slideTitle}`;
		});
		const text = lines.join('\n\n');
		try {
			await navigator.clipboard.writeText(text);
			setCopyDone(true);
			notify.success(t('notify.outlineCopied'));
			window.setTimeout(() => setCopyDone(false), 2000);
		} catch {
			notify.error(t('notify.copyFailed'));
		}
	}, [status?.slides, setCopyDone, t]);

	const handleExportOutlineMarkdown = useCallback(() => {
		const slides = status?.slides;
		if (!slides?.length) return;
		const presentationTitle = (title.trim() ||
			topic.trim() ||
			status?.title?.trim() ||
			t('outline.defaultTitle')) as string;
		const md = buildOutlineMarkdown(presentationTitle, slides);
		const safe = presentationTitle.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 80);
		downloadTextFile(
			`ewrp-outline-${safe || 'presentation'}.md`,
			md,
			'text/markdown;charset=utf-8'
		);
		notify.success(t('notify.markdownSaved'));
	}, [status?.slides, status?.title, title, topic, t]);

	const handleCopyJobId = useCallback(async () => {
		if (!jobId) return;
		try {
			await navigator.clipboard.writeText(jobId);
			setJobIdCopied(true);
			notify.success(t('notify.jobIdCopied'));
			window.setTimeout(() => setJobIdCopied(false), 2000);
		} catch {
			notify.error(t('notify.copyFailed'));
		}
	}, [jobId, setJobIdCopied, t]);

	return {
		absolutePdfHref,
		handleDownload,
		handleOpenPdfNewTab,
		handleCopyPdfUrl,
		handleCopyOutline,
		handleExportOutlineMarkdown,
		handleCopyJobId,
	};
}
