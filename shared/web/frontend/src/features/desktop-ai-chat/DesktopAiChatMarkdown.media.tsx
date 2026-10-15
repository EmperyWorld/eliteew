/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Link and image security boundary for Desktop AI Chat markdown (trusted hosts, authenticated download).
 *
 * Invariants:
 * - Untrusted internet/cloud buckets must not become <img src>; content download uses apiClient Bearer.
 *
 * Related:
 * - DesktopAiChatMarkdown.tsx (facade)
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { apiClient } from '@/services/api/client';

import {
	CHAT_MARKDOWN_IMG_CLASS,
	chatMarkdownImgFrameClass,
} from './DesktopAiChatMarkdown.prose';

export function safeHref(href: string | undefined): string | undefined {
	if (!href || typeof href !== 'string') return undefined;
	try {
		const u = new URL(href, 'https://example.com');
		if (u.protocol === 'http:' || u.protocol === 'https:') return href;
	} catch {
		return undefined;
	}
	return undefined;
}

/**
 * Превью картинок: same-origin, *.eliteew.ru, R2 / DO Spaces / GCS / Azure blob.
 * AWS S3 (*.amazonaws.com) намеренно не доверяем: чужие бакеты дают 403/hotlink, утечка Referer; свои объекты — через `/api/v1/content/.../download`.
 * Локальные / LAN / docker-хосты не доверяем.
 */
export function isTrustedChatImageUrl(href: string | undefined): boolean {
	if (!href || typeof href !== 'string') return false;
	try {
		const base =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://localhost';
		const u = new URL(href.trim(), base);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

		if (typeof window !== 'undefined' && u.origin === window.location.origin) {
			return true;
		}

		const host = u.hostname.toLowerCase();
		if (host === 'eliteew.ru' || host.endsWith('.eliteew.ru')) {
			return true;
		}
		if (
			host.endsWith('.r2.cloudflarestorage.com') ||
			host.includes('digitaloceanspaces.com') ||
			host.includes('seaweed') ||
			host.includes('storage.googleapis.com') ||
			host.endsWith('.blob.core.windows.net')
		) {
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

const CONTENT_DOWNLOAD_PATH =
	/^\/api\/v1\/content\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/download$/i;

/** Если совпало — грузить через apiClient + blob, иначе обычный img (публичный URL). */
export function parseContentDownloadApiPath(src: string): string | null {
	try {
		const base =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://localhost';
		const u = new URL(src.trim(), base);
		const m = CONTENT_DOWNLOAD_PATH.exec(u.pathname);
		return m ? `/api/v1/content/${m[1]}/download` : null;
	} catch {
		return null;
	}
}

export function AuthenticatedContentDownloadImage({
	apiPath,
	alt,
}: {
	apiPath: string;
	alt: string;
}) {
	const { t } = useTranslation('desktopAiChat');
	const shellTheme = useDesktopShellTheme();
	const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
	const [failed, setFailed] = React.useState(false);
	const urlRef = React.useRef<string | null>(null);

	React.useEffect(() => {
		let cancelled = false;
		setFailed(false);
		setBlobUrl(null);
		if (urlRef.current) {
			URL.revokeObjectURL(urlRef.current);
			urlRef.current = null;
		}

		void (async () => {
			try {
				const { data } = await apiClient.get<Blob>(apiPath, {
					responseType: 'blob',
				});
				if (cancelled) return;
				const u = URL.createObjectURL(data);
				urlRef.current = u;
				setBlobUrl(u);
			} catch {
				if (!cancelled) setFailed(true);
			}
		})();

		return () => {
			cancelled = true;
			if (urlRef.current) {
				URL.revokeObjectURL(urlRef.current);
				urlRef.current = null;
			}
		};
	}, [apiPath]);

	if (failed) {
		return (
			<span className={DESKTOP_TYPOGRAPHY.small}>
				{t('chatImageLoadError')}
			</span>
		);
	}
	if (!blobUrl) {
		return (
			<span
				className={DESKTOP_TYPOGRAPHY.small}
				role="status"
				aria-live="polite"
				aria-busy="true"
			>
				{t('chatImageLoading')}
			</span>
		);
	}

	return (
		<a
			href={blobUrl}
			target="_blank"
			rel="noopener noreferrer"
			className={chatMarkdownImgFrameClass(shellTheme)}
		>
			<img
				src={blobUrl}
				alt={alt}
				className={CHAT_MARKDOWN_IMG_CLASS}
				loading="lazy"
			/>
		</a>
	);
}

export function ChatMarkdownExternalImageLink({
	href,
	alt,
}: {
	href: string;
	alt: string;
}) {
	const shellTheme = useDesktopShellTheme();
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={chatMarkdownImgFrameClass(shellTheme)}
		>
			<img
				src={href}
				alt={alt}
				className={CHAT_MARKDOWN_IMG_CLASS}
				loading="lazy"
			/>
		</a>
	);
}
