/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render inline image preview for GAF attachment messages and picker items.
 * Chooses chat-scoped attachment download for persisted chat messages and
 * unified content download for non-chat/optimistic contexts.
 *
 * Invariants:
 * - Object URLs are always revoked on unmount/reload.
 * - `skipDownload` must return deterministic placeholder state with no fetch.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/components/gafAttachmentDownload.ts
 * - src/pages/Desktop/components/GAFChat/components/GafChatAttachmentBlock.tsx
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowPathIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { downloadGafAttachmentBlob } from './gafAttachmentDownload';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;

export function GafChatImageInline({
	contentId,
	chatId,
	messageId,
	alt,
	className,
	/** For fullscreen modal: same object URL as inline image (no second download). */
	onBlobUrlReady,
	/** Не скачивать blob (экономия трафика — настройка чата). */
	skipDownload,
}: {
	contentId: string;
	chatId?: string | null;
	messageId?: string | null;
	alt: string;
	className?: string;
	onBlobUrlReady?: (url: string | null) => void;
	skipDownload?: boolean;
}): JSX.Element | null {
	const { t } = useTranslation('gafChat');
	const [url, setUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const blobUrlRef = useRef<string | null>(null);
	const onReadyRef = useRef(onBlobUrlReady);
	useLayoutEffect(() => {
		onReadyRef.current = onBlobUrlReady;
	});

	useEffect(() => {
		if (skipDownload) {
			setLoading(false);
			setFailed(false);
			setUrl(null);
			onReadyRef.current?.(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setFailed(false);
		if (blobUrlRef.current) {
			URL.revokeObjectURL(blobUrlRef.current);
			blobUrlRef.current = null;
		}
		setUrl(null);

		(async () => {
			try {
				const blob = await downloadGafAttachmentBlob({
					contentId,
					chatId,
					messageId,
				});
				if (cancelled) return;
				const u = URL.createObjectURL(blob);
				blobUrlRef.current = u;
				setUrl(u);
				onReadyRef.current?.(u);
			} catch {
				if (!cancelled) {
					setFailed(true);
					onReadyRef.current?.(null);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
			onReadyRef.current?.(null);
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
		};
	}, [contentId, chatId, messageId, skipDownload]);

	if (skipDownload) {
		return (
			<div
				className={cn(
					'flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated)/30 px-3 text-center',
					className
				)}
			>
				<PhotoIcon
					className="h-8 w-8 text-(--desktop-text-muted)"
					aria-hidden
					strokeWidth={LUCIDE_SW}
				/>
				<p className={DESKTOP_TYPOGRAPHY.caption}>{t('mediaLoadDisabled')}</p>
			</div>
		);
	}

	if (failed) {
		return (
			<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-amber-300/90')}>
				{t('attachmentPreviewFailed')}
			</p>
		);
	}
	if (loading) {
		return (
			<div
				className="flex min-h-[120px] items-center justify-center rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated)/30"
				aria-busy
			>
				<ArrowPathIcon
					className="h-8 w-8 animate-spin motion-reduce:animate-none text-(--desktop-text-muted)"
					strokeWidth={LUCIDE_SW}
				/>
			</div>
		);
	}
	if (!url) return null;

	return (
		<img
			src={url}
			alt={alt}
			loading="lazy"
			decoding="async"
			className={cn(
				'max-h-[min(22rem,65vh)] w-full rounded-lg border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-elevated)/25 object-contain',
				className
			)}
		/>
	);
}
