/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline audio playback for GAF chat attachment bubbles (music and other audio
 * files) without opening the fullscreen preview modal.
 *
 * Invariants:
 * - Blob object URLs are revoked on unmount or when download is cancelled.
 *
 * Related:
 * - GafChatAttachmentBlock.tsx
 * - gafAttachmentDownload.ts
 * - gafChatAttachmentPreviewUtils.ts
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { audioMimeHintForFile } from '../gafChatAttachmentPreviewUtils';
import { downloadGafAttachmentBlob } from './gafAttachmentDownload';
import {
	foflineNowPlaying,
	isFoflineSpaWebAudioHost,
	releaseHtmlMediaElement,
} from '@/services/audio/foflineDecodedPlayback';
import { ArrowPathIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';
import { desktopMediaContextMenuProps } from '@/pages/Desktop/utils/desktopEmbeddedSurfacePolicy';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;

/**
 * Встроенное воспроизведение музыки/аудиофайлов в пузыре (без модалки «как видео»).
 */
export function GafChatInlineAudioPlayer({
	chatId,
	messageId,
	contentId,
	mimeHint,
	fileName,
}: {
	chatId: string;
	messageId: string;
	contentId: string;
	mimeHint: string | null;
	fileName: string;
}): JSX.Element | null {
	const { t } = useTranslation('gafChat');
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [memoryReady, setMemoryReady] = useState(false);
	const bytesRef = useRef<ArrayBuffer | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		let objectUrl: string | null = null;
		(async () => {
			setLoading(true);
			setError(false);
			try {
				const blob = await downloadGafAttachmentBlob({
					contentId,
					chatId,
					messageId,
				});
				const hint = audioMimeHintForFile(mimeHint, fileName);
				const typed =
					hint &&
					(!blob.type ||
						blob.type === 'application/octet-stream' ||
						blob.type === '')
						? new Blob([blob], { type: hint })
						: blob;
				if (isFoflineSpaWebAudioHost()) {
					const bytes = await typed.arrayBuffer();
					if (cancelled) return;
					bytesRef.current = bytes;
					setMemoryReady(bytes.byteLength > 0);
					return;
				}
				objectUrl = URL.createObjectURL(typed);
				if (cancelled) {
					URL.revokeObjectURL(objectUrl);
					return;
				}
				setBlobUrl(objectUrl);
			} catch {
				if (!cancelled) setError(true);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [contentId, chatId, messageId, mimeHint, fileName]);

	if (error) {
		return (
			<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-amber-300/90')}>
				{t('attachmentPreviewFailed')}
			</p>
		);
	}
	if (loading) {
		return (
			<div
				className="flex h-11 items-center gap-2.5 rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-[linear-gradient(165deg,rgb(var(--desktop-accent-rgb)/0.12),transparent)] px-3 text-(--desktop-text-muted) shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.08)]"
				aria-busy
			>
				<ArrowPathIcon
					className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none text-[rgb(var(--desktop-accent-rgb)/0.75)]"
					strokeWidth={LUCIDE_SW}
				/>
				<span className={cn(DESKTOP_TYPOGRAPHY.meta, 'font-medium')}>
					{t('attachmentAudioLoading')}
				</span>
			</div>
		);
	}
	if (!blobUrl && !memoryReady) return null;

	return (
		<div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[color-mix(in_srgb,var(--desktop-surface-elevated)_88%,transparent)] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.1)]">
			<MusicalNoteIcon
				className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.88)]"
				aria-hidden
				strokeWidth={LUCIDE_SW}
			/>
			{memoryReady ? (
				<button
					type="button"
					className="min-h-9 min-w-0 flex-1 text-left text-xs text-(--desktop-text-primary)"
					onClick={() => {
						const bytes = bytesRef.current;
						if (!bytes) return;
						releaseHtmlMediaElement(null);
						void foflineNowPlaying
							.loadBytes(bytes, 0)
							.then(() => foflineNowPlaying.play())
							.catch(() => setError(true));
					}}
				>
					{fileName}
				</button>
			) : (
				<audio
					src={blobUrl ?? undefined}
					controls
					preload="metadata"
					className="min-h-9 min-w-0 flex-1 max-w-[min(100%,min(420px,100vw))] accent-[rgb(var(--desktop-accent-rgb))]"
					{...desktopMediaContextMenuProps}
				/>
			)}
		</div>
	);
}
