/**
 * Unified API error message extraction for UI.
 * Use when displaying 4xx/5xx errors so backend detail is shown consistently.
 */

/** Message shown when a long-running request times out (use with AbortController timeout). */
export const LONG_REQUEST_TIMEOUT_MESSAGE =
	'Операция заняла слишком много времени. Попробуйте повторить.';

function formatValidationIssueList(items: unknown[]): string {
	const parts: string[] = [];
	for (const item of items) {
		if (item == null || typeof item !== 'object') continue;
		const loc = (item as { loc?: unknown }).loc;
		const msg = (item as { msg?: string }).msg;
		const path =
			Array.isArray(loc) && loc.length > 0
				? loc
						.map((x) =>
							typeof x === 'string' || typeof x === 'number' ? String(x) : ''
						)
						.filter(Boolean)
						.join('.')
				: '';
		if (typeof msg === 'string' && msg.length > 0) {
			parts.push(path ? `${path}: ${msg}` : msg);
		}
	}
	return parts.length > 0 ? parts.join('; ') : '';
}

export function getApiErrorMessage(error: unknown): string {
	if (typeof error === 'string') return error;
	const err = error as {
		response?: {
			data?: { detail?: unknown; error?: unknown; details?: unknown };
			status?: number;
		};
		message?: string;
	};
	const data = err?.response?.data;
	if (!data) {
		if (err?.message) return err.message;
		return 'Ошибка запроса';
	}

	const detail = data.detail;
	if (typeof detail === 'string') return detail;
	if (
		detail &&
		typeof detail === 'object' &&
		!Array.isArray(detail) &&
		typeof (detail as { message?: unknown }).message === 'string' &&
		(detail as { message: string }).message.trim().length > 0
	) {
		return (detail as { message: string }).message.trim();
	}
	if (Array.isArray(detail) && detail.length > 0) {
		const formatted = formatValidationIssueList(detail);
		if (formatted) return formatted;
	}

	// main.py RequestValidationError до правки: только `details`
	const details = data.details;
	if (Array.isArray(details) && details.length > 0) {
		const formatted = formatValidationIssueList(details);
		if (formatted) return formatted;
	}

	// main.py HTTPException: часто только `error` (строка или объект)
	const errorField = data.error;
	if (typeof errorField === 'string') return errorField;
	if (
		errorField &&
		typeof errorField === 'object' &&
		!Array.isArray(errorField)
	) {
		const o = errorField as Record<string, unknown>;
		if (o.code === 'lyrics_validation_failed' && Array.isArray(o.errors)) {
			const first = (o.errors as { message?: string }[])[0];
			if (
				first &&
				typeof first.message === 'string' &&
				first.message.length > 0
			) {
				return first.message;
			}
			return 'Текст песни не прошёл проверку. Исправьте замечания или используйте принудительную генерацию.';
		}
		if (o.code === 'xl_base_lyrics_invalid' && Array.isArray(o.errors)) {
			const first = (o.errors as { message?: string }[])[0];
			if (
				first &&
				typeof first.message === 'string' &&
				first.message.length > 0
			) {
				return first.message;
			}
			return 'XL Base: текст не готов — допишите куплеты или перегенерируйте lyrics.';
		}
		if (typeof o.message === 'string') return o.message;
		if (typeof o.detail === 'string') return o.detail;
	}

	if (err?.message) return err.message;
	return 'Ошибка запроса';
}
