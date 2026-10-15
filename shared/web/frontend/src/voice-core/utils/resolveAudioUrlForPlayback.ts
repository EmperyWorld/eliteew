/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Подготовка URL для `<audio>` / `Audio()`: тяжёлые inline `data:` часто дают ошибку декодирования; `blob:` надёжнее.
 * Invariants:
 * - После `URL.createObjectURL` вызывайте `revoke` в `ended` / `error` / `stop`, чтобы не лить память.
 * - Для `data:` не отдаём исходный URL наружу, если нормализация в blob не удалась (строгий CSP без `data:` в media-src иначе даёт ложные ошибки в консоли).
 * Related:
 * - voice-core/hooks/useAudioPlayback.ts, LiveVoiceWidget
 */

/**
 * Decode `data:...;base64,...` without `fetch` (large payloads are more reliable).
 */
function _blobFromDataUrl(src: string): Blob | null {
	const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(src);
	if (!m) {
		return null;
	}
	const mime = (m[1] || 'audio/wav').trim() || 'application/octet-stream';
	const isBase64 = Boolean(m[2]);
	const payload = m[3] ?? '';
	if (!isBase64) {
		try {
			return new Blob([decodeURIComponent(payload)], { type: mime });
		} catch {
			return null;
		}
	}
	const b64 = payload.replace(/\s/g, '');
	try {
		const binary = atob(b64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return new Blob([bytes], { type: mime });
	} catch {
		return null;
	}
}

/**
 * Returns a URL safe for `new Audio(url)` and a revoke callback for blob URLs.
 * Non-data URLs pass through unchanged (revoke is no-op).
 */
export async function resolveAudioUrlForPlayback(
	src: string
): Promise<{ playUrl: string; revoke: () => void }> {
	if (!src.startsWith('data:')) {
		return { playUrl: src, revoke: () => undefined };
	}

	const direct = _blobFromDataUrl(src);
	if (direct && direct.size > 0) {
		const playUrl = URL.createObjectURL(direct);
		return {
			playUrl,
			revoke: () => {
				URL.revokeObjectURL(playUrl);
			},
		};
	}

	try {
		const res = await fetch(src);
		if (!res.ok) {
			throw new Error(`fetch inline audio failed: HTTP ${res.status}`);
		}
		const blob = await res.blob();
		if (!blob || blob.size === 0) {
			throw new Error('empty audio blob from data URL');
		}
		const playUrl = URL.createObjectURL(blob);
		return {
			playUrl,
			revoke: () => {
				URL.revokeObjectURL(playUrl);
			},
		};
	} catch (cause: unknown) {
		const detail = cause instanceof Error ? cause.message : String(cause);
		throw new Error(
			`resolveAudioUrlForPlayback: cannot normalize inline audio for playback (${detail})`,
			{ cause: cause instanceof Error ? cause : undefined }
		);
	}
}
