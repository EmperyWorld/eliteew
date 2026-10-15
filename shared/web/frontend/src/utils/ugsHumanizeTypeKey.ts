const HUMANIZE_CACHE = new Map<string, string>();

/** Подписи типов генерации UGS для тостов и UI (как раньше в UGSHub). */
export function humanizeUgsTypeKey(typeKey: string): string {
	if (!typeKey) {
		return 'Без названия';
	}
	const cached = HUMANIZE_CACHE.get(typeKey);
	if (cached !== undefined) {
		return cached;
	}
	const cleaned = typeKey
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
	const result = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
	HUMANIZE_CACHE.set(typeKey, result);
	return result;
}
