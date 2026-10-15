/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Blob-backed image/video/audio previews for EWDesk admin news media pickers.
 *
 * Invariants:
 * - Object URLs revoked on unmount or content id change.
 *
 * Related:
 * - EwDeskAdminSection.tsx, EwDeskAdminEditNewsForm.tsx
 * - documentation/product/desktop/EWDESK-NEWS.md
 */
import { contentApi } from '@/services/contentApi';
import { cn } from '@/utils/cn';
import * as React from 'react';

export function EwDeskAdminNewsImagePreview({
	imageUrl,
	imageContentId,
	className,
}: {
	imageUrl: string;
	imageContentId: string | null;
	className?: string;
}): React.ReactElement | null {
	const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
	React.useEffect(() => {
		if (!imageContentId) {
			setBlobUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return null;
			});
			return;
		}
		let cancelled = false;
		void contentApi
			.downloadContentBlob(imageContentId)
			.then(({ blob }) => {
				if (cancelled) return;
				setBlobUrl((prev) => {
					if (prev) URL.revokeObjectURL(prev);
					return URL.createObjectURL(blob);
				});
			})
			.catch(() => {});
		return () => {
			cancelled = true;
			setBlobUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return null;
			});
		};
	}, [imageContentId]);
	if (imageContentId && blobUrl) {
		return <img src={blobUrl} alt="" className={className} />;
	}
	if (!imageContentId && imageUrl.trim()) {
		return <img src={imageUrl.trim()} alt="" className={className} />;
	}
	return null;
}

export function EwDeskAdminNewsVideoPreview({
	videoContentId,
	className,
}: {
	videoContentId: string;
	className?: string;
}): React.ReactElement | null {
	const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
	React.useEffect(() => {
		let cancelled = false;
		void contentApi
			.downloadContentBlob(videoContentId)
			.then(({ blob }) => {
				if (cancelled) return;
				setBlobUrl((prev) => {
					if (prev) URL.revokeObjectURL(prev);
					return URL.createObjectURL(blob);
				});
			})
			.catch(() => {});
		return () => {
			cancelled = true;
			setBlobUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return null;
			});
		};
	}, [videoContentId]);
	if (!blobUrl) {
		return (
			<div
				className={cn(
					'min-h-24 w-full animate-pulse rounded-(--desktop-radius) bg-(--desktop-surface-soft)',
					className
				)}
			/>
		);
	}
	return (
		<video
			src={blobUrl}
			controls
			playsInline
			preload="metadata"
			className={className}
		>
			<track kind="captions" srcLang="ru" label="Captions" />
		</video>
	);
}

export function EwDeskAdminNewsAudioPreview({
	audioContentId,
	className,
}: {
	audioContentId: string;
	className?: string;
}): React.ReactElement | null {
	const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
	React.useEffect(() => {
		let cancelled = false;
		void contentApi
			.downloadContentBlob(audioContentId)
			.then(({ blob }) => {
				if (cancelled) return;
				setBlobUrl((prev) => {
					if (prev) URL.revokeObjectURL(prev);
					return URL.createObjectURL(blob);
				});
			})
			.catch(() => {});
		return () => {
			cancelled = true;
			setBlobUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return null;
			});
		};
	}, [audioContentId]);
	if (!blobUrl) {
		return (
			<div
				className={cn(
					'min-h-12 w-full animate-pulse rounded-(--desktop-radius) bg-(--desktop-surface-soft)',
					className
				)}
			/>
		);
	}
	return (
		<audio
			src={blobUrl}
			controls
			preload="metadata"
			className={cn('w-full', className)}
		>
			<track kind="captions" srcLang="ru" label="Captions" />
		</audio>
	);
}
