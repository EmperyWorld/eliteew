/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated blob previews for unified content image/audio in UGS Hub.
 *
 * Invariants:
 * - Downloads use apiClient with timeout: 0 (no short client cutoff).
 * - Audio preview accepts optional Hub placeholder captions (`captionsSrc`).
 *
 * Related:
 * - ugsHubResultParsing.ts, UgsHubResultContent.tsx, ugsHubResultConstants.ts
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthenticatedAudioPreview } from '@/components/Audio/AuthenticatedAudioPreview';
import { apiClient } from '../../../../services/api/client';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';
import {
	ugsHubPreviewErrorClasses,
	ugsHubPreviewLoadingClasses,
} from '../ugsHubSharedUi';

/** Unified content /download requires OAuth Bearer; load blob like Content Manager, not raw img src */
export const UgsUnifiedContentImagePreview: React.FC<{
	contentId: string;
	alt: string;
	className?: string;
}> = ({ contentId, alt, className }) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [loadError, setLoadError] = useState(false);
	useEffect(() => {
		let cancelled = false;
		let objectUrl: string | null = null;
		void (async () => {
			try {
				const { data } = await apiClient.get<Blob>(
					`/api/v1/content/${encodeURIComponent(contentId)}/download`,
					{ responseType: 'blob', timeout: 0 }
				);
				if (cancelled) return;
				objectUrl = URL.createObjectURL(data);
				setBlobUrl(objectUrl);
			} catch {
				if (!cancelled) setLoadError(true);
			}
		})();
		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [contentId]);
	if (loadError) {
		return (
			<p className={ugsHubPreviewErrorClasses(theme)}>
				{t('loading.imageError')}
			</p>
		);
	}
	if (!blobUrl) {
		return (
			<div className={ugsHubPreviewLoadingClasses(theme)}>
				{t('loading.preview')}
			</div>
		);
	}
	return (
		<img
			src={blobUrl}
			alt={alt}
			className={className}
			onError={(e) => {
				(e.currentTarget as HTMLImageElement).style.display = 'none';
			}}
		/>
	);
};

export const UgsUnifiedContentAudioPreview: React.FC<{
	contentId: string;
	mime: string;
	captionsSrc?: string | null;
	captionsSrcLang?: string;
	captionsLabel?: string;
}> = ({ contentId, mime, captionsSrc, captionsSrcLang, captionsLabel }) => {
	return (
		<AuthenticatedAudioPreview
			contentId={contentId}
			mimeType={mime || 'audio/mpeg'}
			sourceSurface="ugs-hub"
			showPlayInMusicPlayer
			captionsSrc={captionsSrc}
			captionsSrcLang={captionsSrcLang}
			captionsLabel={captionsLabel}
			className="w-full"
		/>
	);
};
