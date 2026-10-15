/** Ниже этого размера `data:` в `img.src` обычно ок; выше — риск `net::ERR_INVALID_URL` в Chromium. */
const DATA_URL_TO_BLOB_MIN_LEN = 32_768;

/**
 * Огромные `data:` URL ломают вставку/сеть — подменяем на короткий `blob:`.
 * Генерация UGS обычно отдаёт уже **URL на сервере** (`/api/...` или https) — тогда эта функция просто возвращает строку как есть.
 */
export function shortenDataUrlForImageInsert(url: string): string {
	if (!url.startsWith('data:') || url.length < DATA_URL_TO_BLOB_MIN_LEN) {
		return url;
	}
	const comma = url.indexOf(',');
	if (comma === -1) {
		return url;
	}
	const header = url.slice(0, comma);
	const mimeMatch = /data:([^;]+)/.exec(header);
	const mime = mimeMatch?.[1]?.trim() || 'image/png';
	const b64 = url.slice(comma + 1).replace(/\s/g, '');
	try {
		const binary = atob(b64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return URL.createObjectURL(new Blob([bytes], { type: mime }));
	} catch {
		return url;
	}
}
