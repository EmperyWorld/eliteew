/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified secure avatar: strict-origin URL guard, authenticated blob fetch for API paths,
 * bundled placeholder for missing/untrusted sources.
 *
 * Invariants:
 * - External http(s) avatar URLs (Gravatar, foreign CDN) never become `<img src>`.
 * - `/api/*` and unified-content paths load via profileService blob helper (Bearer).
 *
 * Related:
 * - src/utils/avatarUrlGuard.ts
 * - src/services/profileService.ts
 */

import { useEffect, useState } from 'react';
import profileService from '../../services/profileService';
import {
	isInternalOrTrustedAvatarUrl,
	resolveAvatarApiDownloadPath,
	resolveAvatarDirectSrc,
} from '../../utils/avatarUrlGuard';
import { DEFAULT_AVATAR_PLACEHOLDER_SRC } from './defaultAvatarPlaceholder';

export interface SecureAvatarProps {
	/** When true, fetches avatar via profileService.getAvatar() (for profile header). */
	useProfileApi?: boolean;
	/** Direct avatar URL from profile (used when useProfileApi is false). */
	avatarUrl?: string | null;
	/** Content ID for /api/v1/content/{id}/download (from getAvatar() or when known). */
	contentId?: string | null;
	className?: string;
	alt?: string;
}

function sanitizeAvatarUrl(url: string | null | undefined): string | null {
	if (url == null || typeof url !== 'string') return null;
	const trimmed = url.trim();
	if (!trimmed) return null;
	return isInternalOrTrustedAvatarUrl(trimmed) ? trimmed : null;
}

/**
 * Renders avatar from trusted internal URL or content ID via API blob; bundled placeholder otherwise.
 */
export function SecureAvatar({
	useProfileApi = false,
	avatarUrl = null,
	contentId = null,
	className = '',
	alt = 'Avatar',
}: SecureAvatarProps): JSX.Element {
	const [objectUrl, setObjectUrl] = useState<string | null>(null);
	const [profileApiInfo, setProfileApiInfo] = useState<{
		avatar_url: string | null;
		content_id: string | null;
	} | null>(null);

	useEffect(() => {
		if (!useProfileApi) return;
		let cancelled = false;
		profileService
			.getAvatar()
			.then((info) => {
				if (cancelled) return;
				setProfileApiInfo({
					avatar_url: sanitizeAvatarUrl(info.avatar_url ?? null),
					content_id: info.content_id ?? null,
				});
			})
			.catch(() => {
				if (!cancelled) setProfileApiInfo(null);
			});
		return () => {
			cancelled = true;
		};
	}, [useProfileApi]);

	const effectiveUrlRaw = useProfileApi
		? (profileApiInfo?.avatar_url ?? null)
		: sanitizeAvatarUrl(avatarUrl);
	const effectiveUrl =
		typeof effectiveUrlRaw === 'string' ? effectiveUrlRaw : null;
	const effectiveContentId = useProfileApi
		? (profileApiInfo?.content_id ?? null)
		: contentId;

	useEffect(() => {
		const url = effectiveUrl;
		const cid = effectiveContentId;
		if (!url && !cid) {
			setObjectUrl(null);
			return;
		}
		let cancelled = false;
		const downloadUrl = cid
			? `/api/v1/content/${cid}/download`
			: resolveAvatarApiDownloadPath(url);

		if (!downloadUrl) {
			setObjectUrl(null);
			return;
		}

		profileService
			.getAvatarDownloadObjectUrl(downloadUrl)
			.then((resolved) => {
				if (cancelled) return;
				setObjectUrl(resolved);
			})
			.catch(() => {
				if (!cancelled) setObjectUrl(null);
			});

		return () => {
			cancelled = true;
		};
	}, [effectiveUrl, effectiveContentId]);

	const directSrc = resolveAvatarDirectSrc(effectiveUrl);

	if (objectUrl) {
		return <img src={objectUrl} alt={alt} className={className} />;
	}

	if (directSrc) {
		return <img src={directSrc} alt={alt} className={className} />;
	}

	return (
		<img
			src={DEFAULT_AVATAR_PLACEHOLDER_SRC}
			alt={alt}
			className={className}
			aria-hidden={alt === ''}
		/>
	);
}
