/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cursor-anchored quick preview tooltip for Unified Content list/grid rows.
 *
 * Invariants:
 * - Never uses API `thumbnail_url` as `<img src>` (unauthenticated navigation requests → 401).
 * - Loads thumbnails or full blobs via authenticated `apiClient`.
 * - Blob GETs use `withBlobFetchConcurrency` (shared CM I6 gate with ContentThumbnail).
 *
 * Related:
 * - FileCard.tsx; ContentThumbnail.tsx.
 * - pages/ContentManager/utils/contentManagerBlobFetchConcurrency.ts
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import {
	useEffect,
	useId,
	useLayoutEffect,
	useReducer,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { withBlobFetchConcurrency } from '@/pages/ContentManager/utils/contentManagerBlobFetchConcurrency';
import { apiClient } from '../../../../services/api';
import { log } from '../../../../utils/logger';
import type { Content } from '../../types';
import { formatBytes, formatDate } from '../../utils/contentUtils';
import {
	ArchiveBoxIcon,
	CalendarIcon,
	DocumentTextIcon,
	EyeIcon,
	MusicalNoteIcon,
	PhotoIcon,
	ServerIcon,
	TagIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';

interface HoverPreviewProps {
	content: Content;
	isVisible: boolean;
	mousePosition: { x: number; y: number };
	onClose?: () => void;
}

/** Задержка перед показом панели (мс) */
const SHOW_DELAY_MS = 500;
/** Задержка перед скрытием после снятия hover (мс) */
const HIDE_DELAY_MS = 180;
/** Целевая ширина карточки; фактическая ширина не больше вьюпорта */
const PREVIEW_MAX_WIDTH_PX = 320;
/** Максимальная высота блока медиа внутри карточки */
const PREVIEW_MEDIA_MAX_HEIGHT_PX = 280;
const POSITION_MARGIN_PX = 12;
const CURSOR_OFFSET_PX = 16;
/** Оценка высоты метаданных под превью для флипа по вертикали */
const PANEL_META_ESTIMATE_PX = 200;

function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

export const HoverPreview: React.FC<HoverPreviewProps> = ({
	content,
	isVisible,
	mousePosition,
	onClose,
}) => {
	const { t, i18n } = useTranslation('contentManager');
	const tooltipId = useId();
	const prefersReducedMotion = useReducedMotion();

	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [panelOpen, setPanelOpen] = useState(false);
	const [, bumpLayout] = useReducer((x: number) => x + 1, 0);

	const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const blobUrlRef = useRef<string | null>(null);

	const isImage =
		content.content_type === 'image' ||
		['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].some((ext) =>
			content.name.toLowerCase().endsWith(`.${ext}`)
		);

	const isVideo =
		content.content_type === 'video' ||
		['mp4', 'webm', 'ogg', 'mov', 'avi'].some((ext) =>
			content.name.toLowerCase().endsWith(`.${ext}`)
		);

	// Показ / скрытие панели с задержкой (независимо от isVisible для hide)
	useEffect(() => {
		if (isVisible) {
			if (hideTimeoutRef.current !== null) {
				clearTimeout(hideTimeoutRef.current);
				hideTimeoutRef.current = null;
			}
			showTimeoutRef.current = setTimeout(() => {
				setPanelOpen(true);
				showTimeoutRef.current = null;
			}, SHOW_DELAY_MS);
		} else {
			if (showTimeoutRef.current !== null) {
				clearTimeout(showTimeoutRef.current);
				showTimeoutRef.current = null;
			}
			hideTimeoutRef.current = setTimeout(() => {
				setPanelOpen(false);
				hideTimeoutRef.current = null;
			}, HIDE_DELAY_MS);
		}

		return (): void => {
			if (showTimeoutRef.current !== null) {
				clearTimeout(showTimeoutRef.current);
				showTimeoutRef.current = null;
			}
			if (hideTimeoutRef.current !== null) {
				clearTimeout(hideTimeoutRef.current);
				hideTimeoutRef.current = null;
			}
		};
	}, [isVisible]);

	// Escape закрывает превью (фокус остаётся на карточке / документе)
	useEffect(() => {
		if (!panelOpen || !onClose) {
			return;
		}
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				onClose();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return (): void => window.removeEventListener('keydown', onKeyDown);
	}, [panelOpen, onClose]);

	// Blur focused descendants when the panel closes (framer-motion has no onExitStart on motion.div).
	useLayoutEffect(() => {
		if (panelOpen) {
			return;
		}
		const host = containerRef.current;
		const active = document.activeElement;
		if (host && active instanceof HTMLElement && host.contains(active)) {
			active.blur();
		}
	}, [panelOpen]);

	useEffect(() => {
		if (!panelOpen) {
			return;
		}
		const onResize = (): void => {
			bumpLayout();
		};
		window.addEventListener('resize', onResize);
		return (): void => window.removeEventListener('resize', onResize);
	}, [panelOpen]);

	// Authenticated preview: `/thumbnail` when stored; `/download` only if no thumb path (images).
	useEffect(() => {
		if (!panelOpen || (!isImage && !isVideo)) {
			if (blobUrlRef.current) {
				window.URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
			setPreviewUrl(null);
			setLoading(false);
			setError(null);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		setPreviewUrl(null);

		void (async (): Promise<void> => {
			const hasStoredThumbnail = Boolean(
				content.thumbnail_url?.trim() || content.thumbnail_path?.trim()
			);
			if (hasStoredThumbnail) {
				try {
					const thumbResp = await withBlobFetchConcurrency(() =>
						apiClient.get(
							`/api/v1/content/${encodeURIComponent(content.id)}/thumbnail`,
							{
								responseType: 'blob',
								timeout: 8000,
							}
						)
					);

					if (cancelled) {
						return;
					}

					const thumbBlob = thumbResp.data;
					if (thumbBlob instanceof Blob && thumbBlob.size > 0) {
						if (blobUrlRef.current) {
							window.URL.revokeObjectURL(blobUrlRef.current);
						}
						const url = window.URL.createObjectURL(thumbBlob);
						blobUrlRef.current = url;
						setPreviewUrl(url);
						setLoading(false);
						return;
					}
				} catch {
					/* stored thumb broken/unavailable — no /download fallback */
				}
				if (!cancelled) {
					setError(t('hoverPreview.loadFailed'));
					setLoading(false);
				}
				return;
			}

			if (!isImage) {
				if (!cancelled) {
					setLoading(false);
				}
				return;
			}

			try {
				const response = await withBlobFetchConcurrency(() =>
					apiClient.get(
						`/api/v1/content/${encodeURIComponent(content.id)}/download`,
						{
							responseType: 'blob',
							timeout: 8000,
						}
					)
				);

				if (cancelled) {
					return;
				}

				if (response.data instanceof Blob && response.data.size > 0) {
					if (blobUrlRef.current) {
						window.URL.revokeObjectURL(blobUrlRef.current);
					}
					const url = window.URL.createObjectURL(response.data);
					blobUrlRef.current = url;
					setPreviewUrl(url);
				} else {
					throw new Error('Invalid response data type');
				}
			} catch (err) {
				if (!cancelled) {
					const errorMessage = err instanceof Error ? err.message : String(err);
					log.debug('Failed to load preview:', errorMessage);
					setError(t('hoverPreview.loadFailed'));
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();

		return (): void => {
			cancelled = true;
			if (blobUrlRef.current) {
				window.URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
		};
	}, [
		panelOpen,
		isImage,
		isVideo,
		content.id,
		content.thumbnail_url,
		content.thumbnail_path,
		t,
	]);

	const panelWidthPx = Math.min(
		PREVIEW_MAX_WIDTH_PX,
		typeof window !== 'undefined'
			? window.innerWidth - POSITION_MARGIN_PX * 2
			: PREVIEW_MAX_WIDTH_PX
	);
	const estimatedPanelHeightPx = Math.min(
		PREVIEW_MEDIA_MAX_HEIGHT_PX + PANEL_META_ESTIMATE_PX,
		typeof window !== 'undefined'
			? window.innerHeight - POSITION_MARGIN_PX * 2
			: PREVIEW_MEDIA_MAX_HEIGHT_PX + PANEL_META_ESTIMATE_PX
	);

	const getPosition = (): { top: number; left: number } => {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const m = POSITION_MARGIN_PX;

		let left = mousePosition.x + CURSOR_OFFSET_PX;
		if (left + panelWidthPx > vw - m) {
			left = mousePosition.x - panelWidthPx - CURSOR_OFFSET_PX;
		}
		const maxLeft = vw - panelWidthPx - m;
		left = clamp(left, m, Math.max(m, maxLeft));

		let top = mousePosition.y + CURSOR_OFFSET_PX;
		if (top + estimatedPanelHeightPx > vh - m) {
			top = mousePosition.y - estimatedPanelHeightPx - CURSOR_OFFSET_PX;
		}
		const maxTop = vh - estimatedPanelHeightPx - m;
		top = clamp(top, m, Math.max(m, maxTop));

		return { left, top };
	};

	const position =
		typeof window !== 'undefined' ? getPosition() : { left: 0, top: 0 };

	const getFileIcon = (): React.ReactElement => {
		switch (content.content_type) {
			case 'image':
				return <PhotoIcon className="w-12 h-12 text-blue-400" />;
			case 'video':
				return <VideoCameraIcon className="w-12 h-12 text-purple-400" />;
			case 'audio':
				return <MusicalNoteIcon className="w-12 h-12 text-pink-400" />;
			case 'archive':
				return <ArchiveBoxIcon className="w-12 h-12 text-yellow-400" />;
			default:
				return <DocumentTextIcon className="w-12 h-12 text-gray-400" />;
		}
	};

	const motionTransition = prefersReducedMotion
		? { duration: 0 }
		: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };

	const motionInitial = prefersReducedMotion
		? { opacity: 1, scale: 1 }
		: { opacity: 0, scale: 0.94 };
	const motionAnimate = { opacity: 1, scale: 1 };
	const motionExit = prefersReducedMotion
		? { opacity: 1, scale: 1 }
		: { opacity: 0, scale: 0.94 };

	const tooltipAriaLabel = content.name;

	return (
		<AnimatePresence>
			{panelOpen ? (
				<motion.div
					key={`hover-preview-${content.id}`}
					ref={containerRef}
					id={tooltipId}
					role="tooltip"
					aria-label={tooltipAriaLabel}
					aria-busy={loading}
					initial={motionInitial}
					animate={motionAnimate}
					exit={motionExit}
					transition={motionTransition}
					className="fixed z-50 pointer-events-none motion-reduce:transition-none"
					style={{
						left: `${position.left}px`,
						top: `${position.top}px`,
						width: `${panelWidthPx}px`,
						maxWidth: `min(${PREVIEW_MAX_WIDTH_PX}px, calc(100vw - ${POSITION_MARGIN_PX * 2}px))`,
					}}
				>
					<div className="pointer-events-none flex max-h-[min(92vh,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/96 shadow-(--desktop-shadow-panel) backdrop-blur-xl">
						{/* Preview: blob URL from authenticated /thumbnail or /download — never bare API thumbnail URLs */}
						{(isImage || isVideo) && previewUrl && !loading && !error ? (
							<div
								className="relative flex shrink-0 items-center justify-center overflow-hidden bg-black/50"
								style={{
									maxHeight: PREVIEW_MEDIA_MAX_HEIGHT_PX,
									...(isImage ? { aspectRatio: '1' } : {}),
								}}
							>
								<img
									src={previewUrl}
									alt={content.name}
									className={
										isVideo
											? 'h-full max-h-full w-full object-cover'
											: 'h-auto max-h-full w-auto max-w-full object-contain'
									}
									style={
										isVideo
											? { maxHeight: PREVIEW_MEDIA_MAX_HEIGHT_PX }
											: undefined
									}
									onError={() => setError(t('hoverPreview.imageError'))}
								/>
								{isVideo ? (
									<div className="absolute inset-0 flex items-center justify-center">
										<div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60">
											<VideoCameraIcon className="h-8 w-8 text-white" />
										</div>
									</div>
								) : null}
							</div>
						) : (
							<div
								className="relative bg-linear-to-br from-purple-900/20 to-pink-900/20 flex items-center justify-center shrink-0 overflow-hidden"
								style={{
									maxHeight: PREVIEW_MEDIA_MAX_HEIGHT_PX,
									minHeight: 120,
								}}
							>
								{loading ? (
									<div className="flex flex-col items-center gap-2">
										<div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full motion-safe:animate-spin motion-reduce:animate-none" />
										<span className="text-xs text-gray-400">
											{t('hoverPreview.loading')}
										</span>
									</div>
								) : error ? (
									<div className="flex flex-col items-center gap-2 text-gray-400">
										{getFileIcon()}
										<span className="text-xs">{error}</span>
									</div>
								) : (
									getFileIcon()
								)}
							</div>
						)}

						{/* File Info */}
						<div className="p-4 space-y-2 bg-black/40 min-h-0 overflow-y-auto shrink">
							<h4
								className="text-white font-semibold text-sm truncate"
								title={content.name}
							>
								{content.name}
							</h4>

							<div className="flex items-center gap-4 text-xs text-gray-400">
								<div className="flex items-center gap-1">
									<ServerIcon className="w-3 h-3" />
									<span>{formatBytes(content.file_size, i18n.language)}</span>
								</div>
								<div className="flex items-center gap-1">
									<CalendarIcon className="w-3 h-3" />
									<span>{formatDate(content.created_at, i18n.language)}</span>
								</div>
							</div>

							{content.tags && content.tags.length > 0 && (
								<div className="flex items-center gap-1 flex-wrap">
									<TagIcon className="w-3 h-3 text-purple-400/60" />
									{content.tags.slice(0, 3).map((tag) => (
										<span
											key={tag}
											className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-xs"
										>
											{tag}
										</span>
									))}
									{content.tags.length > 3 && (
										<span className="text-xs text-gray-500">
											+{content.tags.length - 3}
										</span>
									)}
								</div>
							)}

							<div className="flex items-center gap-2 border-t border-(--desktop-border-subtle) pt-2">
								<div className="flex items-center gap-1 text-xs text-gray-400">
									<EyeIcon className="w-3 h-3" />
									<span>{t('hoverPreview.hint')}</span>
								</div>
							</div>
						</div>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
};

export default HoverPreview;
