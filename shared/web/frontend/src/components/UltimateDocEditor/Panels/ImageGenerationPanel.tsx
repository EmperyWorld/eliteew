/**
 * 🔥💎 Image Generation Panel 💎🔥
 *
 * ComfyUI integration panel for AI image generation
 *
 * Features:
 * - Text-to-image generation (Stable Diffusion XL)
 * - Workflow selection (text2img, inpaint, upscale)
 * - Prompt input with negative prompts
 * - Size controls (512x512, 1024x1024, custom)
 * - Generation settings (steps, CFG scale, seed)
 * - Insert generated images into editor
 * - Generation history with thumbnails
 *
 * Created: 2025-10-18
 * Updated: 2025-10-19 - Dark glassmorphism redesign
 */

import { useNotifications } from '@/notifications';
import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import { motion } from 'framer-motion';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { useComfyUI } from '../hooks/useComfyUI';
import { useEditorStoreApi } from '../store/editorStoreContext';
import type {
	ImageGenerationPanelProps,
	ImageGenerationRequest,
} from '../types/editor.types';
import {
	ArrowDownTrayIcon,
	DocumentDuplicateIcon,
	ExclamationTriangleIcon,
	PhotoIcon,
	SparklesIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import {
	fetchApiImageAsBlobUrl,
	fetchApiImageAsDataUrl,
	fetchApiImageBlob,
	needsAuthenticatedImageFetch,
} from '../utils/authenticatedImageUrl';

/** Spinner ring: respects prefers-reduced-motion (static ring when reduced). */
const PANEL_SPINNER_RING =
	'shrink-0 animate-spin rounded-full border-2 border-[rgb(var(--desktop-accent-rgb))] border-t-transparent motion-reduce:animate-none motion-reduce:border-t-[rgb(var(--desktop-accent-rgb))/0.35]';

/** Single pipeline for the document editor: UGS `image_generation_comfyui` + Comfy `01_top`. */
const UGS_DOC_IMAGE_WORKFLOW = '01_top' as const;
const DEFAULT_SIZE = { width: 1024, height: 1024 } as const;

/** Preview: `/api/...` without Bearer on `<img>` returns 401 — load via authFetch → blob:. */
const AuthImagePreview: React.FC<{
	url: string;
	alt: string;
	className?: string;
	onPick: () => void;
}> = ({ url, alt, className, onPick }) => {
	const { t } = useTranslation('docEditorPanels');
	const [src, setSrc] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let revoke: string | null = null;
		let cancelled = false;
		setSrc(null);
		setFailed(false);

		(async () => {
			if (!url) {
				return;
			}
			if (!needsAuthenticatedImageFetch(url)) {
				setSrc(url);
				return;
			}
			try {
				const b = await fetchApiImageAsBlobUrl(url);
				if (cancelled) {
					URL.revokeObjectURL(b);
					return;
				}
				revoke = b;
				setSrc(b);
			} catch {
				if (!cancelled) {
					setFailed(true);
				}
			}
		})();

		return () => {
			cancelled = true;
			if (revoke) {
				URL.revokeObjectURL(revoke);
			}
		};
	}, [url]);

	if (failed) {
		return (
			<div
				className="flex h-40 w-full flex-col items-center justify-center gap-2 bg-[color-mix(in_srgb,var(--desktop-surface-accent)_35%,transparent)] px-3 text-center"
				role="alert"
			>
				<ExclamationTriangleIcon
					width={28}
					height={28}
					className="text-amber-300"
					aria-hidden
				/>
				<span className="text-xs text-(--desktop-text-secondary)">
					{t('panels.imageGen.previewLoadError')}
				</span>
			</div>
		);
	}

	if (!src) {
		return (
			<div
				className="flex h-40 w-full items-center justify-center bg-[color-mix(in_srgb,var(--desktop-surface-accent)_35%,transparent)]"
				role="status"
				aria-busy
				aria-label={t('panels.imageGen.previewLoadingAria')}
			>
				<div className={cn('h-8 w-8', PANEL_SPINNER_RING)} aria-hidden />
			</div>
		);
	}

	return (
		<button
			type="button"
			className="block w-full border-0 bg-transparent p-0 text-left"
			onClick={onPick}
		>
			<img
				src={src}
				alt={alt}
				className={className}
				loading="lazy"
				decoding="async"
			/>
		</button>
	);
};

export const ImageGenerationPanel: React.FC<ImageGenerationPanelProps> = ({
	isOpen,
	onClose,
	onInsertImage,
	layout = 'dock',
}) => {
	const editorStoreApi = useEditorStoreApi();
	const { t } = useTranslation('docEditorPanels');
	const { isGenerating, generatedImages, error, generateImage, clearImages } =
		useComfyUI();
	const { success, error: showError, info } = useNotifications();
	const docSidePanelZ = useDocEditorSidePanelZIndex();

	const [prompt, setPrompt] = useState('');
	const [insertBusy, setInsertBusy] = useState(false);

	// Close on Escape
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

	const hasPendingGalleryJob = useMemo(
		() => generatedImages.some((img) => !img.image_url && !img.error),
		[generatedImages]
	);

	const cancelPendingGenerations = (): void => {
		editorStoreApi.setState((state) => ({
			generatedImages: state.generatedImages.filter(
				(img) => Boolean(img.image_url) || Boolean(img.error)
			),
			isGeneratingImage: false,
			error: undefined,
		}));
	};

	const progressLabel = isGenerating
		? t('panels.imageGen.progressConnect')
		: hasPendingGalleryJob
			? t('panels.imageGen.progressRunning')
			: '';

	const handleGenerate = async (): Promise<void> => {
		if (!prompt.trim()) {
			showError(
				t('panels.imageGen.toast.missingPromptTitle'),
				t('panels.imageGen.toast.missingPromptBody')
			);
			return;
		}

		const request: ImageGenerationRequest = {
			prompt: prompt.trim(),
			workflow_template: UGS_DOC_IMAGE_WORKFLOW,
			width: DEFAULT_SIZE.width,
			height: DEFAULT_SIZE.height,
		};

		try {
			await generateImage(request);
			info(
				t('panels.imageGen.toast.startedTitle'),
				t('panels.imageGen.toast.startedBody')
			);
		} catch (err: unknown) {
			const errorMessage =
				err instanceof Error
					? err.message
					: t('panels.imageGen.toast.genFailedFallback');
			showError(t('panels.imageGen.toast.genFailedTitle'), errorMessage);
		}
	};

	const handleInsertImage = async (imageUrl: string): Promise<void> => {
		if (insertBusy) {
			return;
		}
		setInsertBusy(true);
		try {
			let src = imageUrl;
			if (needsAuthenticatedImageFetch(imageUrl)) {
				src = await fetchApiImageAsDataUrl(imageUrl);
			}
			onInsertImage(src);
			success(
				t('panels.imageGen.toast.insertedTitle'),
				t('panels.imageGen.toast.insertedBody')
			);
		} catch {
			showError(
				t('panels.imageGen.toast.insertFailedTitle'),
				t('panels.imageGen.toast.insertFailedBody')
			);
		} finally {
			setInsertBusy(false);
		}
	};

	const handleDownloadImage = async (
		imageUrl: string,
		index: number
	): Promise<void> => {
		let revoke: string | null = null;
		try {
			let href = imageUrl;
			if (needsAuthenticatedImageFetch(imageUrl)) {
				const blob = await fetchApiImageBlob(imageUrl);
				href = URL.createObjectURL(blob);
				revoke = href;
			}
			const link = document.createElement('a');
			link.href = href;
			link.download = `doc-editor-01-top-${index + 1}.png`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			success(
				t('panels.imageGen.toast.downloadedTitle'),
				t('panels.imageGen.toast.downloadedBody')
			);
		} catch {
			showError(
				t('panels.imageGen.toast.downloadFailedTitle'),
				t('panels.imageGen.toast.downloadFailedBody')
			);
		} finally {
			if (revoke) {
				URL.revokeObjectURL(revoke);
			}
		}
	};

	const handleCopyPrompt = async (promptText: string): Promise<void> => {
		try {
			await navigator.clipboard.writeText(promptText);
			success(
				t('panels.imageGen.toast.copiedTitle'),
				t('panels.imageGen.toast.copiedBody')
			);
		} catch {
			showError(
				t('panels.imageGen.toast.copyFailedTitle'),
				t('panels.imageGen.toast.copyFailedBody')
			);
		}
	};

	if (!isOpen) {
		return null;
	}

	const isOverlay = layout === 'overlay';

	return (
		<motion.div
			role={isOverlay ? 'dialog' : 'region'}
			aria-modal={isOverlay ? true : undefined}
			aria-labelledby="image-gen-panel-title"
			initial={isOverlay ? { opacity: 0, x: 460, scale: 0.985 } : false}
			animate={isOverlay ? { opacity: 1, x: 0 } : { opacity: 1 }}
			exit={isOverlay ? { opacity: 0, x: 460, scale: 0.985 } : undefined}
			transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }}
			className={cn(
				'image-gen-panel flex min-h-0 flex-col bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-2xl',
				isOverlay
					? 'fixed bottom-0 right-0 top-0 w-[420px] max-w-[calc(100vw-1rem)] will-change-transform border-l border-(--desktop-border-strong)'
					: 'relative h-full min-h-0 w-full min-w-0 overflow-hidden'
			)}
			style={isOverlay ? { zIndex: docSidePanelZ } : undefined}
		>
			{/* Header — align with AI panel (px-4 py-3) */}
			<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-3">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<div className="shrink-0 rounded-lg border border-[rgb(var(--desktop-accent-rgb))]/35 bg-[color-mix(in_srgb,var(--desktop-surface-accent)_55%,transparent)] p-1.5">
							<SparklesIcon
								className="text-[rgb(var(--desktop-accent-rgb))]"
								width={14}
								height={14}
							/>
						</div>
						<div className="min-w-0">
							<h3
								id="image-gen-panel-title"
								className="truncate text-sm font-semibold text-(--desktop-text-primary)"
							>
								{t('panels.imageGen.title')}
							</h3>
							<p className="text-[10px] text-(--desktop-text-dim)">
								{t('panels.imageGen.subtitle')}
							</p>
						</div>
					</div>
					<DesktopAppButton
						type="button"
						onClick={onClose}
						variant="ghost"
						size="icon"
						title={t('panels.imageGen.close')}
						aria-label={t('panels.imageGen.close')}
					>
						<XMarkIcon
							width={16}
							height={16}
							className="text-(--desktop-text-muted)"
						/>
					</DesktopAppButton>
				</div>
			</div>

			{/* Settings form — height-limited so more space for results */}
			<div className="max-h-[46%] shrink-0 space-y-5 overflow-y-auto border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3">
				{(isGenerating || hasPendingGalleryJob) && (
					<div
						role="status"
						aria-live="polite"
						className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-2 text-xs text-(--desktop-text-secondary)"
					>
						<div className="flex flex-wrap items-center gap-2">
							<div className={cn('h-4 w-4', PANEL_SPINNER_RING)} aria-hidden />
							<span className="font-medium text-(--desktop-text-primary)">
								{progressLabel}
							</span>
						</div>
						{hasPendingGalleryJob || isGenerating ? (
							<div className="mt-2 flex flex-wrap gap-2 border-t border-(--desktop-border-subtle) pt-2">
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									className="gap-1"
									title={t('panels.imageGen.cancelHint')}
									onClick={cancelPendingGenerations}
								>
									{t('panels.imageGen.cancelWait')}
								</DesktopAppButton>
								<span className="text-(--desktop-text-dim) max-w-[280px] leading-snug">
									{t('panels.imageGen.cancelHint')}
								</span>
							</div>
						) : null}
					</div>
				)}
				<p className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-2 text-xs text-(--desktop-text-muted)">
					{t('panels.imageGen.pipelineHint')}{' '}
					<code className="text-(--desktop-text-primary)">
						{UGS_DOC_IMAGE_WORKFLOW}
					</code>
					{' · '}
					{DEFAULT_SIZE.width}×{DEFAULT_SIZE.height}
				</p>

				{/* Prompt */}
				<div>
					<label
						htmlFor="img-gen-prompt"
						className="mb-2 block text-sm font-semibold text-(--desktop-text-secondary)"
					>
						{t('panels.imageGen.promptLabel')}{' '}
						<span className="text-[rgb(var(--desktop-accent-rgb))]">*</span>
					</label>
					<textarea
						id="img-gen-prompt"
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder={t('panels.imageGen.promptPlaceholder')}
						className="min-h-22 w-full resize-y rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-app) px-3 py-2 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb))]/40"
						rows={5}
						disabled={isGenerating}
					/>
					<div className="mt-1 text-xs text-(--desktop-text-dim)">
						{t('panels.imageGen.promptCharCount', { count: prompt.length })}
					</div>
				</div>

				{/* Error Display */}
				{error && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						className="rounded-lg border border-red-400/30 bg-red-500/20 p-3 text-sm text-red-200"
					>
						❌ {error}
					</motion.div>
				)}

				{/* Generate Button */}
				<DesktopAppButton
					onClick={handleGenerate}
					disabled={!prompt.trim() || isGenerating}
					variant="accent"
					className="w-full gap-2 py-3 font-semibold"
				>
					{isGenerating ? (
						<>
							<div className={cn('h-5 w-5', PANEL_SPINNER_RING)} aria-hidden />
							<span>{t('panels.imageGen.generating')}</span>
						</>
					) : (
						<>
							<SparklesIcon width={20} height={20} />
							<span>{t('panels.imageGen.generate')}</span>
						</>
					)}
				</DesktopAppButton>
			</div>

			{/* Results — main scroll area */}
			<div className="flex min-h-0 min-w-0 flex-1 overflow-y-auto bg-(--desktop-surface-app) p-3">
				{generatedImages.length > 0 && (
					<div className="min-w-0">
						<div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<h4 className="text-sm font-semibold text-(--desktop-text-secondary)">
								{t('panels.imageGen.resultsHeading', {
									count: generatedImages.length,
								})}
							</h4>
							<DesktopAppButton
								onClick={clearImages}
								variant="danger"
								size="sm"
								className="w-full gap-1 sm:w-auto"
							>
								<TrashIcon width={14} height={14} />
								{t('panels.imageGen.clear')}
							</DesktopAppButton>
						</div>

						<div className="grid min-w-0 grid-cols-1 gap-3">
							{generatedImages.map((img, index) => {
								const statusLabelRaw = img.status
									? img.status.split('\n')[0]
									: undefined;
								const showStatusLabel =
									!!statusLabelRaw && statusLabelRaw.length <= 120;
								const formattedStatusLabel =
									showStatusLabel && statusLabelRaw
										? statusLabelRaw
												.replace(/_/g, ' ')
												.replace(/^\w/, (c) => c.toUpperCase())
										: undefined;
								const showSpinner = !img.error;
								const rowKey =
									img.job_id ??
									img.image_url ??
									`${img.prompt}\0${img.status ?? ''}\0${img.error ?? ''}`;

								return (
									<motion.div
										key={rowKey}
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ duration: 0.2 }}
										className="min-w-0 overflow-hidden rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none hover:border-(--desktop-border-strong)"
									>
										{img.image_url ? (
											<AuthImagePreview
												url={img.image_url as string}
												alt={img.prompt}
												className="h-40 w-full object-cover transition-opacity hover:opacity-90"
												onPick={() => {
													void handleInsertImage(img.image_url as string);
												}}
											/>
										) : (
											<div
												role="status"
												aria-live="polite"
												className="flex h-40 w-full min-w-0 items-center justify-center bg-[color-mix(in_srgb,var(--desktop-surface-accent)_35%,transparent)]"
												aria-label={
													showSpinner
														? t('panels.imageGen.generatingAria')
														: t('panels.imageGen.genErrorAria')
												}
											>
												<div className="min-w-0 px-3 text-center text-(--desktop-text-secondary)">
													{showSpinner ? (
														<>
															<div
																className={cn(
																	'mx-auto mb-3 h-8 w-8',
																	PANEL_SPINNER_RING
																)}
																aria-hidden
															/>
															<div className="text-sm font-medium">
																{formattedStatusLabel ??
																	t('panels.imageGen.generatingFallback')}
															</div>
														</>
													) : (
														<>
															<ExclamationTriangleIcon
																width={32}
																height={32}
																className="mx-auto mb-2 text-red-300"
															/>
															<div className="text-sm font-medium text-red-200">
																{formattedStatusLabel ??
																	t('panels.imageGen.generationFailed')}
															</div>
														</>
													)}
													{img.error && (
														<div className="mt-1 text-xs text-red-300">
															{img.error}
														</div>
													)}
												</div>
											</div>
										)}
										<div className="bg-(--desktop-surface-soft) p-3">
											<div className="mb-2 line-clamp-2 text-xs text-(--desktop-text-secondary)">
												{img.prompt}
											</div>
											<div className="mb-2 flex items-center justify-between gap-2 text-xs text-(--desktop-text-dim)">
												<span>
													{img.width && img.height
														? `${img.width}×${img.height}`
														: t('panels.imageGen.pending')}{' '}
													•{' '}
													{img.workflow_template ??
														img.workflow_type ??
														UGS_DOC_IMAGE_WORKFLOW}
												</span>
												{formattedStatusLabel && (
													<DesktopAppStatusBadge className="capitalize border-(--desktop-border-subtle) bg-(--desktop-surface-app) text-(--desktop-text-muted)">
														{formattedStatusLabel}
													</DesktopAppStatusBadge>
												)}
												{img.generation_time && (
													<span className="text-green-300 whitespace-nowrap">
														{img.generation_time.toFixed(1)}s
													</span>
												)}
											</div>
											{img.image_url && (
												<div className="flex gap-2">
													<DesktopAppButton
														disabled={insertBusy}
														onClick={() => {
															if (img.image_url) {
																void handleInsertImage(img.image_url);
															}
														}}
														variant="accent"
														size="sm"
														className="flex-1 gap-1"
													>
														<PhotoIcon width={12} height={12} />
														{t('panels.imageGen.insert')}
													</DesktopAppButton>
													<DesktopAppButton
														onClick={() => {
															if (img.image_url) {
																void handleDownloadImage(img.image_url, index);
															}
														}}
														variant="neutral"
														size="sm"
														title={t('panels.imageGen.downloadTitle')}
														aria-label={t('panels.imageGen.downloadAria')}
													>
														<ArrowDownTrayIcon width={12} height={12} />
													</DesktopAppButton>
													<DesktopAppButton
														onClick={() => handleCopyPrompt(img.prompt)}
														variant="neutral"
														size="sm"
														title={t('panels.imageGen.copyPromptTitle')}
														aria-label={t('panels.imageGen.copyPromptAria')}
													>
														<DocumentDuplicateIcon width={12} height={12} />
													</DesktopAppButton>
												</div>
											)}
										</div>
									</motion.div>
								);
							})}
						</div>
					</div>
				)}

				{generatedImages.length === 0 && isGenerating && (
					<DesktopAppPanel className="min-h-[200px] border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-panel)">
						<div
							role="status"
							aria-live="polite"
							className="flex min-h-[180px] flex-col items-center justify-center gap-3 px-4 py-10 text-(--desktop-text-muted)"
							aria-busy="true"
							aria-label={t('panels.imageGen.firstResultAria')}
						>
							<div className={cn('h-8 w-8', PANEL_SPINNER_RING)} aria-hidden />
							<p className="text-center text-sm font-medium text-(--desktop-text-secondary)">
								{t('panels.imageGen.generating')}
							</p>
							<p className="text-center text-xs text-(--desktop-text-dim)">
								{t('panels.imageGen.firstResultHint')}
							</p>
						</div>
					</DesktopAppPanel>
				)}

				{generatedImages.length === 0 && !isGenerating && (
					<DesktopAppPanel className="border-dashed bg-transparent">
						<DesktopAppEmptyState
							icon={
								<PhotoIcon
									width={32}
									height={32}
									className="text-[rgb(var(--desktop-accent-rgb))]/80"
								/>
							}
							title={t('panels.imageGen.emptyTitle')}
							description={t('panels.imageGen.emptyDescription')}
							className="py-8"
						/>
					</DesktopAppPanel>
				)}
			</div>
		</motion.div>
	);
};
