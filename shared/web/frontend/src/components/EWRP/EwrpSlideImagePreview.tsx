/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated PNG preview for one EWRP slide (`GET /api/v1/ewrp/{jobId}/slides/{index}/image`).
 * Compact mode shows a thumbnail with click-to-zoom lightbox.
 *
 * Invariants:
 * - Never use the slide image API URL directly in `<img src>` without blob fetch (Bearer auth).
 * - Zoom lightbox mounts via ShellPortalMount (no createPortal(document.body)).
 *
 * Related:
 * - src/services/ewrpApi.ts
 * - src/components/EWRP/EwrpGeneratorChunks.tsx
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md (U3.1-B)
 */

import {
	ArrowPathIcon,
	MagnifyingGlassPlusIcon,
	PhotoIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_OVERLAY,
} from '@/pages/Desktop/constants';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants/lucideDesktop';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { ewrpApi } from '@/services/ewrpApi';
import { cn } from '@/utils/cn';

import { ewrpZIndexClass } from './ewrpZIndex';
import { useEwrpDialogFocusTrap } from './useEwrpDialogFocusTrap';

const sw = DESKTOP_LUCIDE.stroke;

export type EwrpSlideImagePreviewProps = {
	jobId: string;
	slideIndex: number;
	className?: string;
	thumbClassName?: string;
	alt?: string;
	/** When true, show compact placeholder instead of spinner in thumb mode. */
	compact?: boolean;
};

export function EwrpSlideImagePreview({
	jobId,
	slideIndex,
	className,
	thumbClassName,
	alt = '',
	compact = false,
}: EwrpSlideImagePreviewProps) {
	const { t } = useTranslation('ewrp');
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const [loading, setLoading] = useState(true);
	const [zoomOpen, setZoomOpen] = useState(false);
	const blobUrlRef = useRef<string | null>(null);
	const zoomPanelRef = useRef<HTMLDivElement>(null);

	useEwrpDialogFocusTrap(zoomPanelRef, zoomOpen);

	const closeZoom = useCallback(() => setZoomOpen(false), []);

	useEffect(() => {
		const jid = jobId.trim();
		if (!jid || slideIndex < 0) {
			setBlobUrl(null);
			setFailed(true);
			setLoading(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setFailed(false);
		setZoomOpen(false);
		if (blobUrlRef.current) {
			URL.revokeObjectURL(blobUrlRef.current);
			blobUrlRef.current = null;
		}
		setBlobUrl(null);

		void (async () => {
			try {
				const blob = await ewrpApi.downloadSlideImage(jid, slideIndex);
				if (cancelled) return;
				const url = URL.createObjectURL(blob);
				blobUrlRef.current = url;
				setBlobUrl(url);
			} catch {
				if (!cancelled) setFailed(true);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
		};
	}, [jobId, slideIndex]);

	useEffect(() => {
		if (!zoomOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			e.stopPropagation();
			closeZoom();
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [zoomOpen, closeZoom]);

	const shellClass = cn(
		'flex items-center justify-center overflow-hidden rounded-lg border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/35',
		compact ? (thumbClassName ?? 'h-8 w-12 shrink-0') : className
	);

	const zoomAlt = alt || t('form.slideImageZoomAlt', { n: slideIndex + 1 });

	const zoomLightbox =
		zoomOpen && blobUrl && typeof document !== 'undefined' ? (
			<ShellPortalMount layer="embedded_modal_backdrop">
				<div
					className={cn(
						'fixed inset-0 flex items-center justify-center p-4 sm:p-8',
						ewrpZIndexClass.overlayModal,
						DESKTOP_OVERLAY.backdrop
					)}
					data-ewrp-ignore-hotkey
				>
					<button
						type="button"
						className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
						aria-label={t('form.slideImageZoomClose')}
						onClick={closeZoom}
						tabIndex={-1}
					/>
					<div
						ref={zoomPanelRef}
						className={cn(
							'relative z-10 flex max-h-[min(92vh,920px)] max-w-[min(96vw,1200px)] flex-col overflow-hidden rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.55)]',
							DESKTOP_OVERLAY.panelSurfaceStrong
						)}
						role="dialog"
						aria-modal="true"
						aria-label={zoomAlt}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						<div className="flex shrink-0 items-center justify-between gap-2 border-b border-(--desktop-border-subtle)/50 px-3 py-2">
							<p className="min-w-0 truncate text-xs font-medium text-(--desktop-text-secondary)">
								{t('outline.slideTitle', { n: slideIndex + 1 })}
							</p>
							<button
								type="button"
								onClick={closeZoom}
								className={cn(
									'rounded-lg p-2 text-(--desktop-text-muted)',
									DESKTOP_INTERACTIVE.btnRounded,
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								aria-label={t('form.slideImageZoomClose')}
							>
								<XMarkIcon className="h-4 w-4" strokeWidth={sw} />
							</button>
						</div>
						<div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black/35 p-3 sm:p-4">
							<img
								src={blobUrl}
								alt={zoomAlt}
								className="max-h-[min(82vh,840px)] w-auto max-w-full object-contain"
								draggable={false}
							/>
						</div>
					</div>
				</div>
			</ShellPortalMount>
		) : null;

	if (failed) {
		if (compact) {
			return (
				<span
					className={cn(
						shellClass,
						'text-[9px] font-medium uppercase tracking-wide text-(--desktop-text-dim)'
					)}
					title={t('form.slideImagePreviewFailed')}
				>
					<PhotoIcon className="h-3.5 w-3.5 opacity-60" aria-hidden />
				</span>
			);
		}
		return (
			<div className={cn(shellClass, 'px-3 py-4 text-center')} role="status">
				<p className="text-[11px] text-(--desktop-text-dim)">
					{t('form.slideImagePreviewFailed')}
				</p>
			</div>
		);
	}

	if (loading || !blobUrl) {
		return (
			<div className={shellClass} aria-busy="true">
				<ArrowPathIcon
					className={cn(
						'animate-spin text-(--desktop-text-muted)',
						compact ? 'h-3.5 w-3.5' : 'h-5 w-5'
					)}
					aria-hidden
				/>
			</div>
		);
	}

	if (compact) {
		return (
			<>
				<div className={cn(shellClass, 'group relative')}>
					<img
						src={blobUrl}
						alt={zoomAlt}
						className={cn('h-full w-full object-cover', thumbClassName)}
						draggable={false}
					/>
					<button
						type="button"
						onClick={() => setZoomOpen(true)}
						className={cn(
							'absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 text-white opacity-0 transition-[background-color,opacity] duration-150',
							'group-hover:bg-black/45 group-hover:opacity-100 group-focus-within:bg-black/45 group-focus-within:opacity-100',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-label={t('form.slideImageZoomOpen')}
						title={t('form.slideImageZoomOpen')}
					>
						<MagnifyingGlassPlusIcon
							className="h-4 w-4 drop-shadow-sm"
							strokeWidth={sw}
							aria-hidden
						/>
					</button>
				</div>
				{zoomLightbox}
			</>
		);
	}

	return (
		<img
			src={blobUrl}
			alt={zoomAlt}
			className={cn('max-h-48 w-full object-contain', className)}
			draggable={false}
		/>
	);
}
