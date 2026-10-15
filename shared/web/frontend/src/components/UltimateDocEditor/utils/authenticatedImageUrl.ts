/**
 * `<img src>` не передаёт Bearer — URL вида `/api/.../doc-editor/ai/image/view` дают 401 и битое превью.
 * Загружаем через authFetch и подставляем blob: / data:.
 */

import { authFetch } from '@/services/api/httpUtils';
import { log } from '@/utils/logger';

function toAbsoluteUrl(url: string): string {
	const u = url.trim();
	if (!u) {
		return u;
	}
	if (u.startsWith('http://') || u.startsWith('https://')) {
		return u;
	}
	if (typeof window !== 'undefined' && u.startsWith('/')) {
		return `${window.location.origin}${u}`;
	}
	return u;
}

/** Нужна загрузка с Authorization (тот же session bearer, что и apiClient). */
export function needsAuthenticatedImageFetch(url: string): boolean {
	const u = url.trim();
	if (!u || u.startsWith('data:') || u.startsWith('blob:')) {
		return false;
	}
	try {
		const path = u.startsWith('/')
			? u
			: new URL(u, 'https://placeholder.local').pathname;
		return path.startsWith('/api/');
	} catch {
		return false;
	}
}

export async function fetchApiImageBlob(url: string): Promise<Blob> {
	const abs = toAbsoluteUrl(url);
	const r = await authFetch(abs);
	let path = abs;
	try {
		path = new URL(abs).pathname;
	} catch {
		/* ignore */
	}
	log.debug('authenticatedImageUrl', '[agent-debug]', {
		sessionId: 'ddc74d',
		hypothesisId: 'H-auth-img',
		location: 'authenticatedImageUrl.fetchApiImageBlob',
		data: { ok: r.ok, status: r.status, path: path.slice(0, 96) },
		timestamp: Date.now(),
	});
	if (!r.ok) {
		throw new Error(`Image ${r.status}`);
	}
	return r.blob();
}

export async function fetchApiImageAsBlobUrl(url: string): Promise<string> {
	const blob = await fetchApiImageBlob(url);
	return URL.createObjectURL(blob);
}

export async function fetchApiImageAsDataUrl(url: string): Promise<string> {
	const blob = await fetchApiImageBlob(url);
	return new Promise((resolve, reject) => {
		const fr = new FileReader();
		fr.onload = (): void => {
			if (typeof fr.result === 'string') {
				resolve(fr.result);
			} else {
				reject(new Error('readAsDataURL failed'));
			}
		};
		fr.onerror = (): void => {
			reject(fr.error ?? new Error('FileReader error'));
		};
		fr.readAsDataURL(blob);
	});
}
