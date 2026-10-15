/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated Unified Content visuals: prefers `GET /api/v1/content/{id}/thumbnail`
 * (WebP when available, legacy JPEG otherwise).
 * Falls back for image rows that have **no** stored thumbnail path via metadata +
 * inline download. If a thumbnail path exists but fetch fails (storage unavailable /
 * quarantined), show placeholder — never hammer `/download` for broken Seaweed objects.
 * Callers may pass `loadingClassName` so the loading overlay fills non-square or flex-sized frames.
 *
 * Invariants:
 * - Lazy-load when the viewport intersects the frame (unless `skipThumbnail`).
 * - Inline-download fallback only when `thumbnail_path`/`thumbnail_url` is absent and size cap permits.
 * - Thumbnail/download blob GETs go through `withBlobFetchConcurrency` (CM I6 gate).
 * - Revoke blob URLs on dependency change and unmount.
 *
 * Related:
 * - `GET /content/{id}/thumbnail` vs `download` (API `shared/api/routers/unified_content.py`)
 * - `services/api/client`; Unified Content picker and FileCard.
 * - `pages/ContentManager/utils/contentManagerBlobFetchConcurrency.ts`
 */
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Content } from '@/components/UnifiedContent/types';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { withBlobFetchConcurrency } from '@/pages/ContentManager/utils/contentManagerBlobFetchConcurrency';
import { api } from '@/services/api/client';
import { cn } from '@/utils/cn';

const MAX_INLINE_PREVIEW_BYTES = 42 * 1024 * 1024;

function isRenderableImageMeta(meta: Content): boolean {
	const mime = (meta.mime_type ?? '').trim().toLowerCase();
	if (mime.startsWith('image/')) return true;
	return meta.content_type === 'image';
}

function exceedsInlinePreviewCap(meta: Content): boolean {
	if (meta.file_size == null || meta.file_size <= 0) return false;
	return meta.file_size > MAX_INLINE_PREVIEW_BYTES;
}

const FOCUS_RING_CLASS =
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app)';

interface ContentThumbnailProps {
	contentId: string;
	className?: string;
	/**
	 * Optional class for the loading overlay wrapper (fills parent when the frame uses flex/grid).
	 */
	loadingClassName?: string;
	alt?: string;
	/** Rendered while loading / waiting for viewport, or inside the error state. */
	children?: React.ReactNode;
	/** If true, do not request thumbnail (e.g. for audio). Renders children only, avoids 404 in console. */
	skipThumbnail?: boolean;
	/**
	 * When true, the frame is `tabIndex={0}` and shows an accent focus ring for keyboard users.
	 * Leave false inside larger clickable targets (e.g. whole-card `div`s) to avoid extra tab stops.
	 */
	focusable?: boolean;
	/**
	 * When true, omit the default square aspect so the component can fill a non-square parent
	 * (e.g. 16:10 card header) while the inner `<img>` still uses `object-cover`.
	 */
	fillParent?: boolean;
}

export const ContentThumbnail: React.FC<ContentThumbnailProps> = ({
	contentId,
	className,
	loadingClassName,
	alt = '',
	children,
	skipThumbnail = false,
	focusable = false,
	fillParent = false,
}) => {
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const [inView, setInView] = useState(false);
	const [fetching, setFetching] = useState(false);
	const blobUrlRef = useRef<string | null>(null);
	const frameRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (skipThumbnail) return;
		const el = frameRef.current;
		if (!el) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					setInView(true);
				}
			},
			{ rootMargin: '160px', threshold: 0.01 }
		);
		io.observe(el);
		return () => io.disconnect();
	}, [skipThumbnail]);

	useEffect(() => {
		if (skipThumbnail || !contentId) {
			if (!contentId) setFailed(true);
			return undefined;
		}
		if (!inView) {
			setFetching(false);
			return undefined;
		}
		setFailed(false);
		setFetching(true);
		let cancelled = false;
		const load = async () => {
			try {
				let blob: Blob | null = null;
				let meta: Content | null = null;
				try {
					meta = await api.get<Content>(`/content/${contentId}`, {
						baseURL: '/api/v1',
					});
				} catch {
					meta = null;
				}

				const hasStoredThumbnail = Boolean(
					meta?.thumbnail_url?.trim() || meta?.thumbnail_path?.trim()
				);

				if (hasStoredThumbnail) {
					try {
						const thumb = await withBlobFetchConcurrency(() =>
							api.get<Blob>(`/content/${contentId}/thumbnail`, {
								baseURL: '/api/v1',
								responseType: 'blob',
							})
						);
						if (thumb instanceof Blob && thumb.size > 0) {
							blob = thumb;
						}
					} catch {
						blob = null;
					}
					// Stored thumb failed or empty: do not fall back to original download
					// (broken/quarantined objects must not re-hit Seaweed via /download).
				} else if (
					meta &&
					isRenderableImageMeta(meta) &&
					!exceedsInlinePreviewCap(meta)
				) {
					try {
						const file = await withBlobFetchConcurrency(() =>
							api.get<Blob>(`/content/${contentId}/download`, {
								baseURL: '/api/v1',
								responseType: 'blob',
								params: { disposition: 'inline' },
							})
						);
						if (file instanceof Blob && file.size > 0) {
							blob = file;
						}
					} catch {
						blob = null;
					}
				}

				if (cancelled) return;
				if (!blob?.size) {
					setFailed(true);
					return;
				}
				const url = URL.createObjectURL(blob);
				if (cancelled) {
					URL.revokeObjectURL(url);
					return;
				}
				if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = url;
				setBlobUrl(url);
			} catch {
				if (!cancelled) setFailed(true);
			} finally {
				if (!cancelled) setFetching(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
			setFetching(false);
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
			setBlobUrl(null);
		};
	}, [contentId, skipThumbnail, inView]);

	const handleImgError = useCallback(() => {
		setFailed(true);
	}, []);

	if (skipThumbnail) {
		return <>{children}</>;
	}

	if (!contentId) {
		return <>{children}</>;
	}

	const frameShellClass = cn(
		'relative size-full min-h-0 overflow-hidden bg-(--desktop-surface-soft) rounded-[inherit]',
		!fillParent && 'aspect-square'
	);

	const errorFallbackIcon = (
		<span
			className="flex flex-col items-center justify-center gap-1 text-center"
			role="presentation"
		>
			<PhotoIcon
				className="size-8 shrink-0 text-(--desktop-text-muted) opacity-70"
				strokeWidth={1.5}
				aria-hidden
			/>
		</span>
	);

	const skeletonShell = (
		<div
			className="absolute inset-0 overflow-hidden rounded-[inherit] bg-(--desktop-surface-soft)"
			aria-hidden
		>
			<div className="absolute inset-0 bg-linear-to-br from-(--desktop-border-subtle)/15 via-transparent to-(--desktop-border-subtle)/10" />
			<div className="absolute inset-[10%] animate-pulse rounded-md bg-(--desktop-border-subtle)/25 motion-reduce:animate-none" />
			<div className="absolute bottom-[12%] left-[12%] right-[25%] h-2 animate-pulse rounded bg-(--desktop-border-subtle)/20 motion-reduce:animate-none" />
		</div>
	);

	const idlePlaceholder = children ?? (
		<PhotoIcon
			className="size-7 shrink-0 text-(--desktop-text-muted) opacity-40"
			aria-hidden
		/>
	);

	const renderPlaceholder = (kind: 'loading' | 'idle' | 'error') => {
		if (kind === 'loading') {
			return (
				<div
					className={cn(
						'absolute inset-0 rounded-[inherit] bg-(--desktop-surface-soft)/90',
						loadingClassName
					)}
				>
					{skeletonShell}
				</div>
			);
		}
		return (
			<div
				className={cn(
					'absolute inset-0 flex items-center justify-center rounded-[inherit]',
					kind === 'idle' && 'bg-(--desktop-surface-soft)/75',
					kind === 'error' && 'bg-(--desktop-surface-soft)'
				)}
			>
				{kind === 'error' ? (children ?? errorFallbackIcon) : idlePlaceholder}
			</div>
		);
	};

	const loadingActive = inView && fetching;

	if (failed) {
		const failedBackdrop = (
			<div
				className="absolute inset-0 bg-(--desktop-surface-soft) bg-[repeating-linear-gradient(135deg,transparent,transparent_7px,color-mix(in_srgb,var(--desktop-border-subtle)_28%,transparent)_7px,color-mix(in_srgb,var(--desktop-border-subtle)_28%,transparent)_8px)]"
				aria-hidden
			/>
		);
		if (focusable) {
			return (
				<div
					ref={frameRef}
					role="img"
					aria-label={alt || 'Thumbnail unavailable'}
					className={cn(frameShellClass, FOCUS_RING_CLASS)}
					// biome-ignore lint/a11y/noNoninteractiveTabindex: optional keyboard focus ring target when image is not yet loaded
					tabIndex={0}
				>
					{failedBackdrop}
					{renderPlaceholder('error')}
				</div>
			);
		}
		return (
			<div ref={frameRef} className={frameShellClass}>
				{failedBackdrop}
				{renderPlaceholder('error')}
			</div>
		);
	}

	if (blobUrl) {
		return (
			<div ref={frameRef} className={frameShellClass}>
				<img
					src={blobUrl}
					alt={alt}
					loading="lazy"
					decoding="async"
					tabIndex={focusable ? 0 : undefined}
					className={cn(
						'absolute inset-0 size-full object-cover',
						focusable && FOCUS_RING_CLASS,
						className
					)}
					onError={handleImgError}
				/>
			</div>
		);
	}

	/* Loading or waiting for intersection: show children as fallback */
	if (focusable) {
		return (
			<div
				ref={frameRef}
				role="img"
				aria-label={alt || 'Loading thumbnail'}
				aria-busy={loadingActive}
				className={cn(frameShellClass, FOCUS_RING_CLASS)}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: optional keyboard focus ring target while thumbnail loads
				tabIndex={0}
			>
				{renderPlaceholder(loadingActive ? 'loading' : 'idle')}
			</div>
		);
	}
	return (
		<div ref={frameRef} className={frameShellClass}>
			{renderPlaceholder(loadingActive ? 'loading' : 'idle')}
		</div>
	);
};
