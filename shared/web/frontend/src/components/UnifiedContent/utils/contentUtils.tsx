/**
 * Content utility functions
 */

import * as React from 'react';
import {
	CircleStackIcon,
	DocumentIcon,
	DocumentTextIcon,
	MusicalNoteIcon,
	PhotoIcon,
	PresentationChartBarIcon,
	TableCellsIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';

export const contentTypeLabels: Record<string, string> = {
	document: 'Документы',
	image: 'Изображения',
	video: 'Видео',
	audio: 'Аудио',
	ai_result: 'Результаты ИИ',
	presentation: 'Презентации',
	spreadsheet: 'Таблицы',
	other: 'Другое',
};

export const visibilityLabels: Record<string, string> = {
	private: 'Приватные',
	shared: 'Общие',
	public: 'Публичные',
	friends: 'Друзья',
	from_friends: 'От друзей',
};

/**
 * Get icon for content type
 */
export const getFileIcon = (
	contentType: string,
	className?: string
): React.ReactElement => {
	const iconClass = className || 'w-4 h-4';
	switch (contentType) {
		case 'document':
			return <DocumentTextIcon className={iconClass} />;
		case 'image':
			return <PhotoIcon className={iconClass} />;
		case 'video':
			return <VideoCameraIcon className={iconClass} />;
		case 'audio':
			return <MusicalNoteIcon className={iconClass} />;
		case 'presentation':
			return <PresentationChartBarIcon className={iconClass} />;
		case 'spreadsheet':
			return <TableCellsIcon className={iconClass} />;
		case 'ai_result':
			return <CircleStackIcon className={iconClass} />;
		default:
			return <DocumentIcon className={iconClass} />;
	}
};

const BYTE_UNITS_RU = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] as const;
const BYTE_UNITS_EN = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Typographic dash for missing / invalid metadata in CM lists */
export const META_EM_DASH = '\u2014';

const isValidTime = (t: number): boolean => Number.isFinite(t);

/** Coerce legacy `null`/`undefined` to 0; return null only for non-finite / NaN. */
function normalizeBytesInput(bytes: number | null | undefined): number | null {
	if (bytes == null) return 0;
	if (
		typeof bytes !== 'number' ||
		Number.isNaN(bytes) ||
		!Number.isFinite(bytes)
	) {
		return null;
	}
	return bytes;
}

/** Russian labels when locale is omitted (legacy default); English for other UI languages */
function getByteUnitLabels(locale?: string): readonly string[] {
	const l = locale?.trim().toLowerCase() ?? '';
	if (l === '' || l.startsWith('ru')) return BYTE_UNITS_RU;
	return BYTE_UNITS_EN;
}

/**
 * Format bytes for display (1024-based). Russian units when locale is empty or `ru*`;
 * English labels for other languages (fallback for non-RU UIs).
 * `null`/`undefined` are shown as zero (legacy). NaN, non-finite, or negative -> {@link META_EM_DASH}.
 */
export const formatBytes = (
	bytes: number | null | undefined,
	locale?: string
): string => {
	const n = normalizeBytesInput(bytes);
	const sizes = getByteUnitLabels(locale);
	const intlLocale = resolveIntlDateLocale(locale);

	if (n == null) return META_EM_DASH;
	if (n < 0) return META_EM_DASH;

	if (n === 0) {
		const nf = new Intl.NumberFormat(intlLocale, {
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		});
		return `${nf.format(0)} ${sizes[0]}`;
	}

	const k = 1024;
	const rawIdx = Math.floor(Math.log(n) / Math.log(k));
	const idx = Math.min(Math.max(0, rawIdx), sizes.length - 1);
	const value = n / k ** idx;
	const nf = new Intl.NumberFormat(intlLocale, {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	});
	return `${nf.format(value)} ${sizes[idx]}`;
};

/**
 * Resolve i18n language (e.g. `en`) to BCP 47 for Date / Intl formatting.
 * Unknown short tags are passed through; empty -> ru-RU (legacy default).
 */
export function resolveIntlDateLocale(locale?: string): string {
	const raw = locale?.trim();
	if (!raw) return 'ru-RU';
	const lower = raw.toLowerCase();
	if (lower.startsWith('en')) return 'en-US';
	if (lower.startsWith('ru')) return 'ru-RU';
	if (lower.startsWith('de')) return 'de-DE';
	if (lower.startsWith('fr')) return 'fr-FR';
	if (lower.startsWith('es')) return 'es-ES';
	if (lower.startsWith('it')) return 'it-IT';
	if (lower.startsWith('pt')) return 'pt-BR';
	if (lower.startsWith('pl')) return 'pl-PL';
	if (lower.startsWith('uk') || lower.startsWith('ua')) return 'uk-UA';
	if (lower.startsWith('zh'))
		return lower.includes('tw') || lower.includes('hk') ? 'zh-TW' : 'zh-CN';
	if (lower.startsWith('ja')) return 'ja-JP';
	if (lower.startsWith('ko')) return 'ko-KR';
	if (/^[a-z]{2}-[a-z0-9]+$/i.test(raw)) return raw;
	return lower.length === 2 ? raw : 'en-US';
}

/** True if the value parses to a finite instant (CM filters, tooltips) */
export function isValidContentDateString(
	value: string | null | undefined
): boolean {
	if (value == null || value === '') return false;
	return isValidTime(new Date(value).getTime());
}

function formatDateCore(
	dateString: string | null | undefined,
	locale: string | undefined,
	options: Intl.DateTimeFormatOptions
): string {
	if (dateString == null || dateString.trim() === '') return META_EM_DASH;
	const date = new Date(dateString);
	if (!isValidTime(date.getTime())) return META_EM_DASH;
	return date.toLocaleDateString(resolveIntlDateLocale(locale), options);
}

/**
 * Format date to readable format.
 * @param locale optional i18n language; defaults to ru-RU for backward compatibility
 */
export const formatDate = (
	dateString: string | null | undefined,
	locale?: string
): string => {
	return formatDateCore(dateString, locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};

/** Date only (no time), for list rows and compact metadata */
export const formatDateShort = (
	dateString: string | null | undefined,
	locale?: string
): string => {
	return formatDateCore(dateString, locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
};

/**
 * Get visibility color class
 */
export const getVisibilityColor = (visibility: string): string => {
	switch (visibility) {
		case 'public':
			return 'green';
		case 'friends':
			return 'green';
		case 'from_friends':
			return 'violet';
		case 'shared':
			return 'blue';
		default:
			return 'gray';
	}
};

/**
 * Get content type label
 */
export const getContentTypeLabel = (contentType: string): string => {
	return contentTypeLabels[contentType] || contentType;
};

/**
 * Get visibility label
 */
export const getVisibilityLabel = (visibility: string): string => {
	return visibilityLabels[visibility] || visibility;
};
