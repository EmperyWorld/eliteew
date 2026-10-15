/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve and display Site Studio image draft previews, including protected image URLs fetched through the API.
 *
 * Invariants:
 * - Object URLs created for protected blobs are revoked on cleanup.
 * - Preview status copy comes from the `siteStudio` i18n namespace.
 *
 * Related:
 * - ../api.ts
 * - ./SiteStudioDraftCard.tsx
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { fetchSiteStudioImageBlob, isSiteStudioDataUrl } from '../api';

interface SiteStudioImagePreviewProps {
	imageUrl: string;
	alt: string;
	className?: string;
}

export const SiteStudioImagePreview: React.FC<SiteStudioImagePreviewProps> = ({
	imageUrl,
	alt,
	className,
}) => {
	const { t } = useTranslation('siteStudio');
	const [resolvedUrl, setResolvedUrl] = useState<string | null>(
		isSiteStudioDataUrl(imageUrl) ? imageUrl : null
	);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
		isSiteStudioDataUrl(imageUrl) ? 'ready' : 'loading'
	);

	useEffect(() => {
		let active = true;
		let objectUrl: string | null = null;

		if (!imageUrl) {
			setResolvedUrl(null);
			setStatus('error');
			return () => undefined;
		}

		if (isSiteStudioDataUrl(imageUrl)) {
			setResolvedUrl(imageUrl);
			setStatus('ready');
			return () => undefined;
		}

		setResolvedUrl(null);
		setStatus('loading');

		void (async () => {
			try {
				const blob = await fetchSiteStudioImageBlob(imageUrl);
				if (!active) return;
				objectUrl = URL.createObjectURL(blob);
				setResolvedUrl(objectUrl);
				setStatus('ready');
			} catch {
				if (!active) return;
				setResolvedUrl(null);
				setStatus('error');
			}
		})();

		return () => {
			active = false;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	}, [imageUrl]);

	return (
		<div
			className={`relative flex h-52 w-full items-center justify-center overflow-hidden rounded-(--desktop-radius) bg-(--desktop-surface-soft) ${className ?? ''}`}
		>
			{resolvedUrl ? (
				<img
					src={resolvedUrl}
					alt={alt}
					loading="lazy"
					className="h-full w-full object-cover"
				/>
			) : status === 'loading' ? (
				<div className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
					<ArrowPathIcon className="h-4 w-4 animate-spin" />
					{t('media.imagePreviewLoading')}
				</div>
			) : (
				<div className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
					<PhotoIcon className="h-4 w-4" />
					{t('media.imagePreviewUnavailable')}
				</div>
			)}
		</div>
	);
};

export default SiteStudioImagePreview;
