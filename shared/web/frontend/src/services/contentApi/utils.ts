/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared coercion, query, and UX helpers for Unified Content client modules.
 *
 * Invariants:
 * - Download URL builders stay aligned with server ticket and blob routes.
 *
 * Related:
 * - src/services/contentApi/constants.ts
 */
import type { AxiosRequestConfig } from 'axios';
import { CONTENT_API_BASE } from './constants';
import type {
	ContentCollectionStatus,
	ContentDownloadTicketResponse,
	UnknownRecord,
} from './types';
import { normalizeApiError } from '../api/error-handler';

export function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === 'object' && value !== null;
}

export function toStringValue(value: unknown, fallback = ''): string {
	if (typeof value === 'string') {
		return value;
	}
	if (value == null) {
		return fallback;
	}
	return String(value);
}

export function toNullableString(value: unknown): string | null {
	if (value == null) {
		return null;
	}
	return String(value);
}

export function toNumberValue(value: unknown, fallback = 0): number {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : fallback;
	}
	return fallback;
}

export function toBooleanValue(value: unknown, fallback = false): boolean {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		return value === 'true';
	}
	return fallback;
}

export function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((item) => String(item))
		.filter((item) => item.trim().length > 0);
}

export function buildContentRequestConfig(
	config?: AxiosRequestConfig
): AxiosRequestConfig {
	return {
		baseURL: CONTENT_API_BASE,
		...config,
	};
}

export function toBrowserDownloadUrl(pathOrUrl: string): string {
	const raw = pathOrUrl.trim();
	if (!raw) {
		return raw;
	}
	if (typeof window === 'undefined') {
		return raw;
	}
	return new URL(raw, window.location.origin).href;
}

export function toQueryParams(
	values: object
): Record<string, string | number | boolean> {
	return Object.entries(values).reduce<
		Record<string, string | number | boolean>
	>((acc, [key, value]) => {
		if (value == null || value === '') {
			return acc;
		}
		if (Array.isArray(value)) {
			if (value.length === 0) {
				return acc;
			}
			acc[key] = value.join(',');
			return acc;
		}
		if (
			typeof value === 'boolean' ||
			typeof value === 'number' ||
			typeof value === 'string'
		) {
			acc[key] = value;
		}
		return acc;
	}, {});
}

/** Парсинг имени файла из Content-Disposition (в т.ч. RFC 5987 filename*). */
export function parseContentDispositionFilename(
	contentDisposition: string | undefined
): string | undefined {
	if (!contentDisposition) {
		return undefined;
	}
	const star = /filename\*\s*=\s*[^']*''([^;\n]+)/i.exec(contentDisposition);
	if (star?.[1]) {
		try {
			const decoded = decodeURIComponent(star[1].trim());
			if (decoded) {
				return decoded;
			}
		} catch {
			// fall through
		}
	}
	const quoted = /filename\s*=\s*"((?:\\.|[^"\\])*)"/i.exec(contentDisposition);
	if (quoted?.[1]) {
		return quoted[1].replace(/\\"/g, '"');
	}
	const match = /filename\s*=\s*([^;\n]+)/i.exec(contentDisposition);
	if (match?.[1]) {
		const v = match[1].trim().replace(/^["']|["']$/g, '');
		return v || undefined;
	}
	return undefined;
}

export function getContentErrorMessage(
	error: unknown,
	fallback = 'Неизвестная ошибка'
): string {
	const normalized = normalizeApiError(error);
	if (typeof normalized === 'string') {
		return normalized || fallback;
	}
	return normalized.message || fallback;
}

export function getContentCollectionStatus<T>(
	items: readonly T[] | null | undefined,
	loading: boolean,
	error?: string | null
): ContentCollectionStatus {
	if (loading) {
		return 'loading';
	}
	if (error) {
		return 'error';
	}
	if (!items || items.length === 0) {
		return 'empty';
	}
	return 'ready';
}

/**
 * Версия объекта для сброса кэша предпросмотра (после replace-file в редакторе тот же id).
 */
export function buildContentBlobCacheRevision(item: {
	updated_at: string;
	file_size: number | null | undefined;
}): string {
	return `${item.updated_at}|${item.file_size ?? 0}`;
}

export function buildContentDownloadUrl(
	contentId: string,
	revision?: string | null
): string {
	const base = `${CONTENT_API_BASE}/content/${contentId}/download`;
	if (revision == null || revision === '') {
		return base;
	}
	const q = new URLSearchParams();
	q.set('v', revision);
	return `${base}?${q.toString()}`;
}

export function toContentError(error: unknown, fallback: string): string {
	const message = getContentErrorMessage(error, fallback);
	return message || fallback;
}

export function normalizeDownloadTicketResponse(
	payload: unknown
): ContentDownloadTicketResponse {
	const rec = isRecord(payload) ? payload : {};
	return {
		download_url: toStringValue(rec.download_url),
		expires_in_seconds: toNumberValue(rec.expires_in_seconds),
	};
}
