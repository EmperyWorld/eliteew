/**
 * 🔥💎 OCR PANEL 💎🔥
 *
 * GPU-accelerated Optical Character Recognition
 *
 * Features:
 * - Image to text conversion using GPU
 * - Support for multiple languages (Russian, English, etc.)
 * - Batch processing
 * - Text correction and enhancement
 * - Insert OCR results into editor
 * - Progress tracking with GPU acceleration
 *
 * Created: 2025-10-20
 */

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useNotifications } from '@/notifications';
import { cn } from '@/utils/cn';
import { motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { useEditorStoreShallow } from '../store/editorStoreContext';
import { selectOCRPanelSlice } from '../store/editorStoreSelectors';
import type { OCRProgress, OCRResult } from '../types/editor.types';
import {
	ArrowPathIcon,
	CheckCircleIcon,
	DocumentDuplicateIcon,
	ExclamationCircleIcon,
	PencilSquareIcon,
	PhotoIcon,
	QrCodeIcon,
	Square2StackIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

const OCR_LANG_ITEMS = [
	{ code: 'rus', langKey: 'rus', flag: '🇷🇺' },
	{ code: 'eng', langKey: 'eng', flag: '🇺🇸' },
	{ code: 'rus+eng', langKey: 'rus_eng', flag: '🌍' },
	{ code: 'fra', langKey: 'fra', flag: '🇫🇷' },
	{ code: 'deu', langKey: 'deu', flag: '🇩🇪' },
	{ code: 'spa', langKey: 'spa', flag: '🇪🇸' },
] as const;

interface OCRPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onInsertText?: (text: string) => void;
}

export const OCRPanel: React.FC<OCRPanelProps> = ({
	isOpen,
	onClose,
	onInsertText,
}) => {
	const { t } = useTranslation('docEditorPanels');
	const { performOCR, isLoading } = useEditorStoreShallow(selectOCRPanelSlice);
	const { success, error: showError, info } = useNotifications();
	const docSidePanelZ = useDocEditorSidePanelZIndex();
	const ocrAbortRef = useRef(false);

	const [images, setImages] = useState<File[]>([]);
	const [selectedLanguage, setSelectedLanguage] = useState('rus+eng');
	const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
	const [progress, setProgress] = useState<OCRProgress | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [isDropZoneFocused, setIsDropZoneFocused] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const resultsAnchorRef = useRef<HTMLDivElement>(null);
	const isDropZoneBusy = isLoading || !!progress;

	const isSupportedImageFile = useCallback((file: File): boolean => {
		const extension = file.name.toLowerCase().split('.').pop() || '';
		const supportedExtensions = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp'];
		return (
			supportedExtensions.includes(extension) &&
			(file.type === '' || file.type.startsWith('image/'))
		);
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				onClose();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen, onClose]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);

			const droppedFiles = Array.from(e.dataTransfer.files);
			const imageFiles = droppedFiles.filter((file) =>
				isSupportedImageFile(file)
			);

			if (imageFiles.length !== droppedFiles.length) {
				showError(
					t('panels.ocr.errors.invalidDropTitle'),
					t('panels.ocr.errors.invalidDropBody')
				);
			}

			setImages((prev) => [...prev, ...imageFiles]);
		},
		[isSupportedImageFile, showError, t]
	);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
		const selectedFiles = Array.from(e.target.files || []);
		const imageFiles = selectedFiles.filter((file) =>
			isSupportedImageFile(file)
		);

		if (imageFiles.length !== selectedFiles.length) {
			showError(
				t('panels.ocr.errors.invalidSelectTitle'),
				t('panels.ocr.errors.invalidSelectBody')
			);
		}

		setImages((prev) => [...prev, ...imageFiles]);
	};

	const removeImage = (index: number): void => {
		setImages((prev) => prev.filter((_, i) => i !== index));
	};

	const clearAllImages = (): void => {
		setImages([]);
		setOcrResults([]);
		setProgress(null);
	};

	const processImages = async (): Promise<void> => {
		if (images.length === 0) {
			return;
		}

		ocrAbortRef.current = false;

		setProgress({
			current: 0,
			total: images.length,
			status: t('panels.ocr.progress.initializing'),
		});
		const results: OCRResult[] = [];

		for (let i = 0; i < images.length; i++) {
			if (ocrAbortRef.current) {
				break;
			}
			const image = images[i];
			if (!image) {
				continue;
			}

			setProgress({
				current: i + 1,
				total: images.length,
				status: t('panels.ocr.progress.processing', { name: image.name }),
				fileName: image.name,
			});

			try {
				const result = await performOCR(image, selectedLanguage);
				if (!result.success || !result.text?.trim()) {
					results.push({
						fileName: image.name,
						success: false,
						error: result.error ?? t('panels.ocr.errors.processFailed'),
					});
					continue;
				}
				results.push({
					fileName: image.name,
					success: true,
					text: result.text,
					confidence: result.confidence,
					language: selectedLanguage,
					processingTime: result.processingTime,
				});
			} catch (err: unknown) {
				const errorMessage =
					err instanceof Error
						? err.message
						: t('panels.ocr.errors.processFailed');
				results.push({
					fileName: image.name,
					success: false,
					error: errorMessage,
				});
			}
		}

		if (ocrAbortRef.current) {
			setOcrResults(results);
			setImages([]);
			setProgress(null);
			info(
				t('panels.ocr.toast.stoppedTitle'),
				t('panels.ocr.toast.stoppedBody')
			);
			return;
		}

		setProgress({
			current: images.length,
			total: images.length,
			status: t('panels.ocr.progress.complete'),
		});
		setOcrResults(results);
		setImages([]);

		const successCount = results.filter(
			(r) => r.success && r.text?.trim()
		).length;
		const failCount = results.length - successCount;

		if (successCount > 0) {
			success(
				t('panels.ocr.toast.completeTitle'),
				t('panels.ocr.toast.complete', { count: successCount })
			);
			requestAnimationFrame(() => {
				resultsAnchorRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
				});
			});
		}
		if (failCount > 0) {
			showError(
				t('panels.ocr.toast.issuesTitle'),
				t('panels.ocr.toast.failed', { count: failCount })
			);
		}

		// Clear progress after 3 seconds
		setTimeout(() => setProgress(null), 3000);
	};

	const handleInsertText = (text: string): void => {
		const trimmed = text.trim();
		if (!trimmed) {
			showError(
				t('panels.ocr.toast.insertFailedTitle'),
				t('panels.ocr.toast.insertFailedBody')
			);
			return;
		}
		if (!onInsertText) {
			showError(
				t('panels.ocr.toast.insertFailedTitle'),
				t('panels.ocr.toast.editorNotReady')
			);
			return;
		}
		onInsertText(trimmed);
		success(
			t('panels.ocr.toast.insertedTitle'),
			t('panels.ocr.toast.insertedBody')
		);
	};

	const handleCopyText = async (text: string): Promise<void> => {
		try {
			await navigator.clipboard.writeText(text);
			success(
				t('panels.ocr.toast.copiedTitle'),
				t('panels.ocr.toast.copiedBody')
			);
		} catch {
			showError(
				t('panels.ocr.toast.copyFailedTitle'),
				t('panels.ocr.toast.copyFailedBody')
			);
		}
	};

	const insertableOcrText = ocrResults
		.filter((result) => result.success && result.text?.trim())
		.map((result) => result.text?.trim() ?? '')
		.join('\n\n');

	const formatFileSize = useCallback(
		(bytes: number): string => {
			if (bytes === 0) {
				return `0 ${t('panels.ocr.fileSize.bytes')}`;
			}
			const k = 1024;
			const sizeLabels = [
				t('panels.ocr.fileSize.bytes'),
				t('panels.ocr.fileSize.kb'),
				t('panels.ocr.fileSize.mb'),
				t('panels.ocr.fileSize.gb'),
			];
			const i = Math.floor(Math.log(bytes) / Math.log(k));
			const label = sizeLabels[i] ?? sizeLabels[sizeLabels.length - 1];
			return `${parseFloat((bytes / k ** i).toFixed(2))} ${label}`;
		},
		[t]
	);

	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			role="dialog"
			aria-modal="true"
			aria-labelledby="ocr-panel-title"
			initial={{ opacity: 0, x: 100 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 100 }}
			transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as const }}
			className="ocr-panel fixed bottom-0 right-0 top-0 flex min-h-0 w-[520px] min-w-0 flex-col border-l border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-2xl"
			style={{ zIndex: docSidePanelZ }}
		>
			{/* Header */}
			<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-3">
				<div className="flex min-w-0 items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-3">
						<div className="shrink-0 p-2 rounded-xl bg-linear-to-br from-purple-500/30 to-blue-500/30 border border-purple-400/30">
							<QrCodeIcon className="text-purple-300" width={18} height={18} />
						</div>
						<div className="min-w-0">
							<h3
								id="ocr-panel-title"
								className="truncate font-semibold text-(--desktop-text-primary)"
							>
								{t('panels.ocr.title')}
							</h3>
							<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
								{t('panels.ocr.subtitleGpu')}
							</p>
						</div>
					</div>
					<DesktopAppButton
						type="button"
						onClick={onClose}
						variant="ghost"
						size="icon"
						title={t('panels.ocr.closeTitle')}
						aria-label={t('panels.ocr.closeAria')}
					>
						<XMarkIcon width={18} height={18} />
					</DesktopAppButton>
				</div>
			</div>

			{/* Language Selection */}
			<div className="min-w-0 border-b border-(--desktop-border-subtle) p-5">
				<div className="mb-3 block text-sm font-semibold text-(--desktop-text-secondary)">
					{t('panels.ocr.languageHeading')}
				</div>
				<div className="grid min-w-0 grid-cols-2 gap-2">
					{OCR_LANG_ITEMS.map((lang) => (
						<DesktopAppButton
							key={lang.code}
							onClick={() => setSelectedLanguage(lang.code)}
							variant={selectedLanguage === lang.code ? 'accent' : 'neutral'}
							className="justify-start px-3 py-2 text-sm font-medium"
						>
							<span className="mr-2">{lang.flag}</span>
							{t(`panels.ocr.languages.${lang.langKey}`)}
						</DesktopAppButton>
					))}
				</div>
			</div>

			{isDropZoneBusy ? (
				<div
					role="status"
					aria-live="polite"
					className="flex flex-wrap items-center gap-3 border-b border-(--desktop-border-subtle) bg-purple-500/10 px-5 py-3 text-sm text-(--desktop-text-secondary)"
				>
					<span className="min-w-0 flex-1">{t('panels.ocr.statusBanner')}</span>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className="shrink-0 gap-1"
						onClick={() => {
							ocrAbortRef.current = true;
						}}
					>
						<Square2StackIcon width={14} height={14} />
						{t('panels.ocr.cancel')}
					</DesktopAppButton>
				</div>
			) : null}

			{/* Upload Area */}
			<div className="min-w-0 border-b border-(--desktop-border-subtle) p-5">
				{/* biome-ignore lint/a11y/useSemanticElements: Drop zone includes headings and hints; not a compact text button */}
				<div
					role="button"
					tabIndex={isDropZoneBusy ? -1 : 0}
					aria-busy={isDropZoneBusy}
					aria-disabled={isDropZoneBusy}
					onFocus={() => setIsDropZoneFocused(true)}
					onBlur={() => setIsDropZoneFocused(false)}
					onDragOver={isDropZoneBusy ? undefined : handleDragOver}
					onDragLeave={isDropZoneBusy ? undefined : handleDragLeave}
					onDrop={isDropZoneBusy ? undefined : handleDrop}
					className={`
            relative rounded-xl border-2 border-dashed p-8 text-center transition-all
            ${
							isDropZoneBusy
								? 'cursor-not-allowed border-(--desktop-border-subtle) bg-(--desktop-surface-soft) opacity-[0.88]'
								: 'cursor-pointer'
						}
            ${
							!isDropZoneBusy && isDragOver
								? 'border-purple-400 bg-purple-500/15 shadow-[0_0_0_1px_rgba(168,85,247,0.25)]'
								: ''
						}
            ${
							!isDropZoneBusy && !isDragOver && isDropZoneFocused
								? 'border-[rgb(var(--desktop-accent-rgb))]/50 bg-(--desktop-surface-soft) ring-2 ring-[rgb(var(--desktop-accent-rgb))]/25 ring-offset-2 ring-offset-(--desktop-surface-panel-strong)'
								: ''
						}
            ${
							!isDropZoneBusy && !isDragOver && !isDropZoneFocused
								? 'border-(--desktop-border-subtle) hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft)'
								: ''
						}
          `}
					onClick={() => {
						if (!isDropZoneBusy) fileInputRef.current?.click();
					}}
					onKeyDown={(e) => {
						if (isDropZoneBusy) return;
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							fileInputRef.current?.click();
						}
					}}
					aria-label={t('panels.ocr.dropAria')}
				>
					<input
						ref={fileInputRef}
						type="file"
						multiple
						accept="image/*"
						onChange={handleFileSelect}
						className="hidden"
					/>

					<PhotoIcon
						width={48}
						height={48}
						className={`mx-auto mb-4 ${isDropZoneBusy ? 'text-(--desktop-text-dim)' : 'text-(--desktop-text-muted)'}`}
					/>
					<h4 className="mb-2 text-lg font-semibold text-(--desktop-text-primary)">
						{isDropZoneBusy
							? t('panels.ocr.dropHeadingBusy')
							: isDragOver
								? t('panels.ocr.dropHeadingRelease')
								: t('panels.ocr.dropHeadingDefault')}
					</h4>
					<p className="mb-4 text-sm text-(--desktop-text-muted) antialiased">
						{isDropZoneBusy
							? t('panels.ocr.dropHintBusy')
							: t('panels.ocr.dropHintDefault')}
					</p>
					<div className="flex flex-wrap justify-center gap-2 text-xs text-(--desktop-text-dim)">
						<span>PNG</span>
						<span>JPG</span>
						<span>JPEG</span>
						<span>BMP</span>
						<span>TIFF</span>
						<span>WebP</span>
					</div>
				</div>
			</div>

			{/* Image List */}
			{images.length > 0 && (
				<div className="min-h-0 min-w-0 flex-1 overflow-y-auto border-b border-(--desktop-border-subtle) p-5">
					<div className="mb-4 flex min-w-0 items-center justify-between gap-2">
						<h4 className="min-w-0 truncate text-sm font-semibold text-(--desktop-text-secondary)">
							{t('panels.ocr.filesHeading', { count: images.length })}
						</h4>
						<DesktopAppButton
							onClick={clearAllImages}
							variant="ghost"
							size="sm"
							className="shrink-0 gap-1 text-(--desktop-text-muted) hover:bg-red-500/10 hover:text-red-200"
							title={t('panels.ocr.clearAllTitle')}
						>
							<TrashIcon width={14} height={14} />
							{t('panels.ocr.clearAll')}
						</DesktopAppButton>
					</div>

					<div className="space-y-2">
						{images.map((image, index) => (
							<motion.div
								key={`${image.name}-${image.size}-${image.lastModified}`}
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								className="flex min-w-0 items-center gap-3 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3"
							>
								<div className="p-2 bg-purple-500/20 rounded-lg border border-purple-400/30">
									<PhotoIcon
										width={16}
										height={16}
										className="text-purple-300"
									/>
								</div>
								<div className="flex-1 min-w-0">
									<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
										{image.name}
									</div>
									<div className="text-xs text-(--desktop-text-dim)">
										{formatFileSize(image.size)}
									</div>
								</div>
								<DesktopAppButton
									onClick={() => removeImage(index)}
									variant="ghost"
									size="icon"
									title={t('panels.ocr.removeImageTitle')}
								>
									<XMarkIcon width={16} height={16} />
								</DesktopAppButton>
							</motion.div>
						))}
					</div>
				</div>
			)}

			{/* Progress */}
			{progress && (
				<div className="min-w-0 border-b border-(--desktop-border-subtle) bg-purple-500/10 p-5">
					<div className="mb-3 flex min-w-0 items-center gap-3">
						<ArrowPathIcon
							width={16}
							height={16}
							className="shrink-0 animate-spin text-purple-300 motion-reduce:animate-none motion-reduce:opacity-80"
						/>
						<span className="min-w-0 text-sm font-medium text-purple-200">
							{progress.status}
						</span>
					</div>
					<div className="h-2 w-full rounded-full bg-(--desktop-surface-soft)">
						<div
							className="h-2 rounded-full bg-purple-500 transition-all duration-300 motion-reduce:transition-none"
							style={{ width: `${(progress.current / progress.total) * 100}%` }}
						/>
					</div>
					<div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-purple-200">
						<span>
							{t('panels.ocr.progressLine', {
								current: progress.current,
								total: progress.total,
							})}
						</span>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="text-purple-100 hover:bg-purple-500/20"
							onClick={() => {
								ocrAbortRef.current = true;
							}}
						>
							{t('panels.ocr.cancel')}
						</DesktopAppButton>
					</div>
				</div>
			)}

			{/* OCR Results */}
			{ocrResults.length > 0 && (
				<div
					ref={resultsAnchorRef}
					className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-(--desktop-surface-app) p-5"
				>
					<h4 className="mb-4 text-sm font-semibold text-(--desktop-text-secondary)">
						{t('panels.ocr.resultsHeading')}
					</h4>

					<div className="space-y-4">
						{ocrResults.map((result) => (
							<motion.div
								key={`${result.fileName}-${result.success ? 'ok' : 'err'}`}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								className={`min-w-0 rounded-lg border p-4 ${
									result.success
										? 'bg-green-500/10 border-green-400/30'
										: 'bg-red-500/10 border-red-400/30'
								}`}
							>
								<div className="mb-3 flex min-w-0 items-start gap-3">
									{result.success ? (
										<CheckCircleIcon
											width={16}
											height={16}
											className="text-green-300 mt-0.5 shrink-0"
										/>
									) : (
										<ExclamationCircleIcon
											width={16}
											height={16}
											className="text-red-300 mt-0.5 shrink-0"
										/>
									)}
									<div className="flex-1 min-w-0">
										<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
											{result.fileName}
										</div>
										{result.success ? (
											<div className="mt-1 flex items-center gap-2 text-xs text-green-200">
												{t('panels.ocr.successLine')}
												{result.confidence && (
													<DesktopAppStatusBadge className="border-green-400/30 bg-green-500/30 text-green-100">
														{t('panels.ocr.confidencePct', {
															pct: Math.round(result.confidence * 100),
														})}
													</DesktopAppStatusBadge>
												)}
												{result.processingTime && (
													<span className="text-(--desktop-text-dim)">
														{result.processingTime.toFixed(1)}s
													</span>
												)}
											</div>
										) : (
											<div className="text-xs text-red-200 mt-1">
												✗ {result.error}
											</div>
										)}
									</div>
								</div>

								{result.success && result.text && (
									<div className="mt-3">
										<div className="max-h-32 min-w-0 overflow-y-auto rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3">
											<pre className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-(--desktop-text-primary)">
												{result.text}
											</pre>
										</div>
										<div className="mt-3 flex min-w-0 flex-wrap gap-2">
											{result.text && (
												<>
													<DesktopAppButton
														onClick={() => handleInsertText(result.text ?? '')}
														variant="accent"
														size="sm"
													>
														<PencilSquareIcon
															width={12}
															height={12}
															className="inline mr-1"
														/>
														{t('panels.ocr.insertToDocument')}
													</DesktopAppButton>
													<DesktopAppButton
														onClick={() =>
															void handleCopyText(result.text ?? '')
														}
														variant="neutral"
														size="sm"
													>
														<DocumentDuplicateIcon
															width={12}
															height={12}
															className="inline mr-1"
														/>
														{t('panels.ocr.copy')}
													</DesktopAppButton>
												</>
											)}
										</div>
									</div>
								)}
							</motion.div>
						))}
					</div>
				</div>
			)}

			{/* Actions */}
			<div className="shrink-0 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-5">
				<div className="flex min-w-0 gap-3">
					<DesktopAppButton
						onClick={processImages}
						disabled={images.length === 0 || isLoading || !!progress}
						variant="accent"
						className="min-w-0 flex-1 gap-2 py-2.5 font-semibold"
					>
						{progress ? (
							<>
								<ArrowPathIcon
									width={16}
									height={16}
									className="animate-spin motion-reduce:animate-none motion-reduce:opacity-80"
								/>
								<span>{t('panels.ocr.processingShort')}</span>
							</>
						) : (
							<>
								<QrCodeIcon width={16} height={16} />
								<span>
									{t('panels.ocr.processCta', { count: images.length })}
								</span>
							</>
						)}
					</DesktopAppButton>
				</div>

				{insertableOcrText ? (
					<DesktopAppButton
						type="button"
						onClick={() => handleInsertText(insertableOcrText)}
						variant="accent"
						size="md"
						className="mt-3 w-full gap-2 py-2.5 font-semibold"
					>
						<PencilSquareIcon width={16} height={16} />
						<span>{t('panels.ocr.insertAllToDocument')}</span>
					</DesktopAppButton>
				) : null}

				<div className="mt-3 text-center text-xs text-(--desktop-text-dim)">
					{t('panels.ocr.footerHint')}
				</div>
			</div>
		</motion.div>
	);
};
