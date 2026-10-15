/**
 * PDF panel: preview via the browser PDF plugin (iframe + #page) and insert a link into the document.
 * No pdf.js dependency — heavy annotation/merge/split tooling was removed accordingly.
 */

import { useNotifications } from '@/notifications';
import { DESKTOP_OVERLAY } from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import {
	buildContentDownloadUrl,
	contentApi,
} from '../../../services/contentApi';
import { log } from '../../../utils/logger';
import type { PDFProcessingPanelProps } from '../types/editor.types';
import { useTranslation } from 'react-i18next';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowUpTrayIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	DocumentTextIcon,
	ExclamationCircleIcon,
	PlusIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

const SOFT_MAX_PAGE_STEP = 998;

const escapeHtmlPlain = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

const PANEL_ACCENT_ICON_CLASS =
	'flex items-center justify-center rounded-2xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) text-white shadow-(--desktop-shadow-panel)';

export const PDFProcessingPanel: React.FC<PDFProcessingPanelProps> = ({
	isOpen,
	onClose,
	onInsertProcessedPDF,
}) => {
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [uploadedPDF, setUploadedPDF] = useState<File | null>(null);
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [panelError, setPanelError] = useState<string | null>(null);
	const [pdfInsertBusy, setPdfInsertBusy] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const blobUrlRef = useRef<string | null>(null);

	const { success, error } = useNotifications();
	const { t } = useTranslation('docEditorPanels');

	const replaceBlobUrl = useCallback((next: string | null) => {
		if (blobUrlRef.current) {
			URL.revokeObjectURL(blobUrlRef.current);
			blobUrlRef.current = null;
		}
		if (next) {
			blobUrlRef.current = next;
		}
		setPdfUrl(next);
	}, []);

	useEffect(() => {
		if (!isOpen) {
			replaceBlobUrl(null);
			setUploadedPDF(null);
			setCurrentPage(1);
			setPanelError(null);
			setPdfInsertBusy(false);
		}
	}, [isOpen, replaceBlobUrl]);

	useEffect(
		() => () => {
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
		},
		[]
	);

	const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		setPanelError(null);
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;

		if (
			file.type !== 'application/pdf' &&
			!file.name.toLowerCase().endsWith('.pdf')
		) {
			setPanelError(t('panels.pdf.errors.invalidFile'));
			error(t('panels.pdf.errors.invalidFile'));
			return;
		}

		replaceBlobUrl(URL.createObjectURL(file));
		setUploadedPDF(file);
		setCurrentPage(1);
		success(t('panels.pdf.toasts.uploadSuccess'));
	};

	const handleExportPDF = useCallback(async () => {
		if (!uploadedPDF) return;

		try {
			const blob = new Blob([uploadedPDF], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `exported-${uploadedPDF.name}`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			success(t('panels.pdf.toasts.exportSuccess'));
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			log.error('PDF export error:', msg);
			error(t('panels.pdf.errors.exportFailed'));
		}
	}, [uploadedPDF, success, error, t]);

	const handleInsertToDocument = useCallback(async () => {
		if (!uploadedPDF) return;

		setPdfInsertBusy(true);
		let href: string;
		let note: string;

		try {
			const content = await contentApi.uploadContent(uploadedPDF, {
				content_type: 'document',
				name: uploadedPDF.name,
			});
			href = buildContentDownloadUrl(content.id);
			note = t('panels.pdf.insert.noteSavedUnknown');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			log.warn(
				'PDFProcessingPanel',
				'PDF insert: upload failed, using blob URL',
				{
					message,
				}
			);
			href = pdfUrl ?? URL.createObjectURL(uploadedPDF);
			note = t('panels.pdf.insert.noteTempUnknown', { message });
		} finally {
			setPdfInsertBusy(false);
		}

		const safeName = escapeHtmlPlain(uploadedPDF.name);
		const safeNote = escapeHtmlPlain(note);
		const hrefAttr = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

		const pdfHtml = `<p><a href="${hrefAttr}" target="_blank" rel="noopener noreferrer">${safeName}</a></p><p>${safeNote}</p>`;

		onInsertProcessedPDF(pdfHtml);
		success(t('panels.pdf.toasts.insertSuccess'));
		onClose();
	}, [uploadedPDF, pdfUrl, onInsertProcessedPDF, success, onClose, t]);

	if (!isOpen) {
		return null;
	}

	const iframeSrc = pdfUrl ? `${pdfUrl}#page=${currentPage}` : null;

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className={cn(
					'fixed inset-0 flex items-center justify-center',
					DESKTOP_OVERLAY.backdrop
				)}
				style={{ zIndex: embeddedModalZ.backdrop }}
				onClick={onClose}
			>
				<motion.div
					initial={{ scale: 0.95, opacity: 0, y: 20 }}
					animate={{ scale: 1, opacity: 1, y: 0 }}
					exit={{ scale: 0.95, opacity: 0, y: 20 }}
					transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
					className="flex h-[90vh] w-full max-w-[95vw] min-w-0 flex-col overflow-hidden rounded-3xl border border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-xl"
					style={{ zIndex: embeddedModalZ.content }}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="flex min-w-0 items-center justify-between gap-3 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-6 py-4">
						<div className="flex min-w-0 items-center gap-4">
							<div className={`${PANEL_ACCENT_ICON_CLASS} shrink-0 p-3`}>
								<DocumentTextIcon width={24} height={24} />
							</div>
							<div className="min-w-0">
								<h2 className="text-2xl font-bold tracking-tight text-(--desktop-text-primary)">
									{t('panels.pdf.header.title')}
								</h2>
								<p
									className="mt-0.5 truncate text-sm text-(--desktop-text-muted) antialiased"
									title={
										uploadedPDF
											? t('panels.pdf.header.pagesSubtitlePreview', {
													name: uploadedPDF.name,
												})
											: undefined
									}
								>
									{uploadedPDF
										? t('panels.pdf.header.pagesSubtitlePreview', {
												name: uploadedPDF.name,
											})
										: t('panels.pdf.header.subtitleIdle')}
								</p>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							{uploadedPDF ? (
								<>
									<DesktopAppButton
										onClick={handleExportPDF}
										variant="neutral"
										className="gap-2 px-4 py-2"
									>
										<ArrowDownTrayIcon width={18} height={18} />
										<span className="font-medium">
											{t('panels.pdf.actions.export')}
										</span>
									</DesktopAppButton>
									<DesktopAppButton
										onClick={() => void handleInsertToDocument()}
										variant="accent"
										className="gap-2 px-4 py-2"
										disabled={pdfInsertBusy}
										aria-busy={pdfInsertBusy}
									>
										{pdfInsertBusy ? (
											<ArrowPathIcon
												width={18}
												height={18}
												className="animate-spin"
											/>
										) : (
											<PlusIcon width={18} height={18} />
										)}
										<span className="font-medium">
											{t('panels.pdf.actions.insert')}
										</span>
									</DesktopAppButton>
								</>
							) : null}
							<button
								type="button"
								title={t('panels.pdf.actions.closeTitle')}
								aria-label={t('panels.pdf.actions.closePanelAria')}
								className="rounded-2xl p-3 text-white transition-colors hover:bg-red-900/85"
								style={{ border: `1px solid rgba(239,68,68,0.35)` }}
								onClick={onClose}
							>
								<XMarkIcon width={18} height={18} aria-hidden />
							</button>
						</div>
					</div>

					<input
						ref={fileInputRef}
						type="file"
						accept=".pdf,application/pdf"
						onChange={handlePdfUpload}
						className="hidden"
						aria-hidden
						tabIndex={-1}
					/>

					{panelError ? (
						<div className="mx-6 mb-5 flex shrink-0 items-start gap-2 rounded-3xl bg-red-950/45 px-4 py-4 text-[13px] text-red-200">
							<ExclamationCircleIcon
								className="mt-1 h-[18px] w-[18px] shrink-0 text-red-200"
								strokeWidth={2}
							/>
							<span className="flex-1 leading-relaxed">{panelError}</span>
							<button
								type="button"
								title={t('panels.pdf.actions.dismissErrorAria')}
								aria-label={t('panels.pdf.actions.dismissErrorAria')}
								onClick={() => setPanelError(null)}
								className="ml-3 rounded-full p-3 text-[11px] font-semibold text-red-200 ring-2 ring-transparent transition-colors hover:bg-red-950/70 focus-visible:focus:bg-red-950/85"
								style={{
									boxShadow:
										'0 14px 32px rgb(239 68 68 / var(--desktop-focus-visible-opacity,18%)), 0 0 0 var(--desktop-focus-visible-ring-offset) rgb(var(--desktop-surface-void))',
								}}
							>
								×
							</button>
						</div>
					) : null}

					<div className="relative flex flex-1 min-h-0 flex-col lg:flex-row">
						<DesktopAppPanel
							className="relative order-2 flex flex-1 min-h-[40vh] min-w-0 flex-col gap-3 overflow-hidden p-3 lg:p-4"
							variant="panel"
							padding="none"
						>
							{!uploadedPDF ? (
								<DesktopAppEmptyState
									className="min-h-[32vh]"
									title={t('panels.pdf.empty.title')}
									description={t('panels.pdf.empty.description')}
								/>
							) : iframeSrc ? (
								<>
									<div
										data-desktop-iframe-host=""
										className="flex min-h-0 w-full flex-1"
									>
										<iframe
											key={iframeSrc}
											title={t('panels.pdf.previewFrameTitle')}
											src={iframeSrc}
											className="min-h-72 w-full flex-1 rounded-2xl border border-(--desktop-border-strong) bg-white/5"
										/>
									</div>
									<div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-(--desktop-border-subtle) pt-3">
										<DesktopAppButton
											type="button"
											size="sm"
											variant="neutral"
											disabled={currentPage <= 1}
											className="gap-1"
											aria-label={t('panels.pdf.viewer.prevPageAria')}
											onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
										>
											<ChevronLeftIcon width={18} height={18} />
										</DesktopAppButton>
										<span className="min-w-36 text-center text-xs tabular-nums text-(--desktop-text-secondary)">
											{t('panels.pdf.viewer.pageOfUnknown', {
												current: currentPage,
												count: '…',
											})}
										</span>
										<DesktopAppButton
											type="button"
											size="sm"
											variant="neutral"
											disabled={currentPage >= SOFT_MAX_PAGE_STEP}
											className="gap-1"
											aria-label={t('panels.pdf.viewer.nextPageAria')}
											onClick={() =>
												setCurrentPage((p) =>
													Math.min(SOFT_MAX_PAGE_STEP, p + 1)
												)
											}
										>
											<ChevronRightIcon width={18} height={18} />
										</DesktopAppButton>
									</div>
									<p className="text-center text-[10px] text-(--desktop-text-muted)">
										{t('panels.pdf.viewer.nativeViewerHint')}
									</p>
								</>
							) : null}
						</DesktopAppPanel>

						<aside className="order-1 flex w-full shrink-0 flex-col gap-3 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 lg:order-2 lg:w-80 lg:border-b-0 lg:border-l">
							<DesktopAppButton
								type="button"
								variant="accent"
								className="w-full justify-center gap-2"
								onClick={() => fileInputRef.current?.click()}
								aria-label={t('panels.pdf.upload.uploadAria')}
							>
								<ArrowUpTrayIcon width={18} height={18} />
								{t('panels.pdf.upload.uploadButton')}
							</DesktopAppButton>
							<p className="text-xs leading-relaxed text-(--desktop-text-muted)">
								{t('panels.pdf.empty.previewHelp')}
							</p>
						</aside>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
};
