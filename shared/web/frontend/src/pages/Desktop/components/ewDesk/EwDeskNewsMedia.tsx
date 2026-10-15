/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hero/list media for EWDesk posts (image URL, linked image/video/audio blobs).
 *
 * Invariants:
 * - Failed loads hide the media slot without breaking the article layout.
 * - Hide-on-error state is keyed by the current `src`/`blobUrl` so a later valid URL can show.
 *
 * Related:
 * - useEwDeskNewsBlob.ts, EWDeskApp.tsx
 */

import { cn } from '@/utils/cn';
import { InlineAudioPreview } from '@/components/Audio/InlineAudioPreview';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE } from '../../constants';
import {
	ewDeskNewsLinkedAudioPath,
	ewDeskNewsLinkedImagePath,
	ewDeskNewsLinkedVideoPath,
} from '../../services/productDesktopApi';
import { useEwDeskNewsBlob } from './useEwDeskNewsBlob';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';
import { desktopMediaContextMenuProps } from '../../utils/desktopEmbeddedSurfacePolicy';

export function EwDeskNewsImage({
	src,
	contentId,
	alt,
	className,
}: {
	src?: string | null;
	contentId?: string | null;
	alt: string;
	className?: string;
}): React.ReactElement | null {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'ewDesk' });
	const mediaKey = `${contentId ?? ''}:${src ?? ''}`;
	const blobPath = contentId ? ewDeskNewsLinkedImagePath(contentId) : null;
	const {
		blobUrl,
		isLoading,
		failed: blobFailed,
	} = useEwDeskNewsBlob(blobPath, Boolean(contentId));

	if (contentId) {
		if (blobFailed) return null;
		if (isLoading || !blobUrl) {
			return (
				<span
					className={cn(
						className,
						'block min-h-10 animate-pulse bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)]'
					)}
					role="status"
					aria-label={t('imageLoadingAria')}
				/>
			);
		}
		return (
			<EwDeskNewsHideOnErrorImg
				key={blobUrl}
				src={blobUrl}
				alt={alt}
				className={className}
				mediaKey={mediaKey}
			/>
		);
	}

	if (!src) return null;
	return (
		<EwDeskNewsHideOnErrorImg
			key={src}
			src={src}
			alt={alt}
			className={className}
			mediaKey={mediaKey}
		/>
	);
}

function EwDeskNewsHideOnErrorImg({
	src,
	alt,
	className,
	mediaKey,
}: {
	src: string;
	alt: string;
	className?: string;
	mediaKey: string;
}): React.ReactElement | null {
	const [failed, setFailed] = React.useState(false);
	if (failed) return null;
	return (
		<img
			key={mediaKey}
			src={src}
			alt={alt}
			className={className}
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			onError={() => setFailed(true)}
		/>
	);
}

export function EwDeskNewsVideo({
	contentId,
	variant,
	className,
}: {
	contentId: string;
	variant: 'thumb' | 'hero';
	className?: string;
}): React.ReactElement | null {
	const blobPath = ewDeskNewsLinkedVideoPath(contentId);
	const { blobUrl, isLoading, failed } = useEwDeskNewsBlob(blobPath);

	if (failed) return null;
	if (isLoading || !blobUrl) {
		return (
			<span
				className={cn(
					className,
					'block min-h-10 animate-pulse bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)]'
				)}
				aria-hidden
			/>
		);
	}

	if (variant === 'thumb') {
		return (
			<video
				src={blobUrl}
				muted
				playsInline
				preload="metadata"
				className={className}
				aria-hidden
			>
				<track kind="captions" srcLang="ru" label="Captions" />
			</video>
		);
	}

	return (
		<video
			src={blobUrl}
			controls
			playsInline
			preload="metadata"
			className={cn(
				className,
				'block w-full max-h-[min(30rem,60vh)] object-contain outline-none'
			)}
			{...desktopMediaContextMenuProps}
		>
			<track kind="captions" srcLang="ru" label="Captions" />
		</video>
	);
}

export function EwDeskNewsAudio({
	contentId,
	className,
}: {
	contentId: string;
	className?: string;
}): React.ReactElement | null {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'ewDesk' });
	const blobPath = ewDeskNewsLinkedAudioPath(contentId);
	const { blobUrl, isLoading, failed } = useEwDeskNewsBlob(blobPath);

	if (failed) return null;
	if (isLoading || !blobUrl) {
		return (
			<div
				className={cn(
					'min-h-12 animate-pulse rounded-(--desktop-radius) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)]',
					className
				)}
				aria-hidden
			/>
		);
	}

	return (
		<InlineAudioPreview
			src={blobUrl}
			trackName={t('audioAttachmentAria')}
			ariaLabel={t('audioAttachmentAria')}
			compact
			className={cn('w-full max-w-full', className)}
		/>
	);
}

export function EwDeskNewsAudioBadge(): React.ReactElement {
	return (
		<MusicalNoteIcon
			className="h-3 w-3"
			strokeWidth={DESKTOP_LUCIDE.stroke}
			aria-hidden
		/>
	);
}
