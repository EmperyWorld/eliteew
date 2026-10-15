/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared helpers for Marketing Cabinet pages (errors, CSV export, desktop bridge).
 *
 * Invariants:
 * - CSV escaping uses `utils/csvEscapeField` (Rolldown-safe, no nested quote regex in templates).
 *
 * Related:
 * - `pages/MarketingCabinet/*`
 */

import { escapeCsvField } from '../../utils/csvEscapeField';

/** Сужение типа после проверки enabled/guard; в рантайме не должно срабатывать при корректных query/mutation. */
export function requireDefined<T>(
	value: T | null | undefined,
	label: string
): T {
	if (value == null) {
		throw new Error(`MarketingCabinet: expected ${label}`);
	}
	return value;
}

/** Частые англоязычные detail от FastAPI → короткий текст для UI (без полного i18n). */
const MARKETING_API_DETAIL_RU: Record<string, string> = {
	'Not authenticated': 'Требуется вход в систему.',
	'Could not validate credentials': 'Не удалось проверить учётные данные.',
	'Not enough permissions': 'Недостаточно прав.',
	Forbidden: 'Доступ запрещён.',
	'Not Found': 'Не найдено.',
	'Internal Server Error': 'Внутренняя ошибка сервера.',
};

function localizeMarketingApiDetail(text: string): string {
	return (
		MARKETING_API_DETAIL_RU[text] ??
		MARKETING_API_DETAIL_RU[text.trim()] ??
		text
	);
}

/** Извлекает читаемое сообщение об ошибке из ответа API (Axios, FastAPI detail). */
export function extractApiErrorMessage(
	error: unknown,
	fallback: string
): string {
	if (error instanceof Error) {
		const err = error as Error & {
			response?: { data?: { detail?: string | string[] | object[] } };
		};
		const detail = err.response?.data?.detail;
		if (typeof detail === 'string') return localizeMarketingApiDetail(detail);
		if (Array.isArray(detail) && detail.length > 0) {
			const first = detail[0];
			if (typeof first === 'object' && first !== null && 'msg' in first) {
				return localizeMarketingApiDetail(
					String((first as { msg: string }).msg)
				);
			}
			return localizeMarketingApiDetail(String(first));
		}
		if (err.message) return err.message;
	}
	return fallback;
}

export function parseMultilineList(value: string): string[] {
	return value
		.split(/\n|,/)
		.map((item) => item.trim())
		.filter(Boolean);
}

export function parseOptionalNumber(value: string): number | null {
	const normalized = value.trim();
	if (!normalized) return null;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

export function getReadinessTone(score: number): string {
	if (score >= 80) {
		return 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) text-(--desktop-text-primary)';
	}
	if (score >= 50) {
		return 'border-(--mc-border-accent-soft) bg-(--mc-accent-10) text-(--desktop-text-secondary)';
	}
	return 'border-red-500/30 bg-red-950/30 text-red-200/90';
}

export function openDesktopApp(
	appComponent: string,
	extra?: Record<string, unknown>
) {
	window.dispatchEvent(
		new CustomEvent('desktop-open-app', {
			detail: { appComponent, ...(extra ?? {}) },
		})
	);
}

/** Проверяет, является ли строка валидным URL (http/https или домен). */
export function isValidUrl(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return true;
	try {
		const withProtocol =
			trimmed.startsWith('http://') || trimmed.startsWith('https://')
				? trimmed
				: `https://${trimmed}`;
		new URL(withProtocol);
		return true;
	} catch {
		return false;
	}
}

/** Копирует текст в буфер обмена. Возвращает true при успехе. */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/** Скачивает данные как CSV-файл. */
export function downloadCsv(rows: string[][], filename: string): void {
	const csv = rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
	const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
