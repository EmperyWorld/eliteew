/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read dropped access / entitlement / tunnel files (text or opaque Capsule v3).
 *
 * Invariants:
 * - Rejects empty / oversized payloads; returns honest Russian errors.
 * - Capsule v3 binary (EECAP3) is wrapped as JSON transport for Rust import.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md
 */

const MAX_BYTES = 256 * 1024;
const CAPSULE_V3_MAGIC_ASCII = 'EECAP3';

export async function readDroppedTextFile(
	file: File | null | undefined
): Promise<
	{ ok: true; text: string; name: string } | { ok: false; error: string }
> {
	if (!file) {
		return { ok: false, error: 'Файл не выбран' };
	}
	if (file.size <= 0) {
		return { ok: false, error: 'Файл пустой' };
	}
	if (file.size > MAX_BYTES) {
		return { ok: false, error: 'Файл слишком большой (лимит 256 КБ)' };
	}
	try {
		const text = await file.text();
		if (!text.trim()) {
			return { ok: false, error: 'В файле нет текста' };
		}
		return { ok: true, text, name: file.name };
	} catch {
		return { ok: false, error: 'Не удалось прочитать файл' };
	}
}

/** Dropped access file: Capsule v3 binary → ecap_v3 JSON transport; else UTF-8 text. */
export async function readDroppedAccessFile(
	file: File | null | undefined
): Promise<
	{ ok: true; text: string; name: string } | { ok: false; error: string }
> {
	if (!file) {
		return { ok: false, error: 'Файл не выбран' };
	}
	if (file.size <= 0) {
		return { ok: false, error: 'Файл пустой' };
	}
	if (file.size > MAX_BYTES) {
		return { ok: false, error: 'Файл слишком большой (лимит 256 КБ)' };
	}
	try {
		const buf = await file.arrayBuffer();
		const bytes = new Uint8Array(buf);
		const magicOk =
			bytes.length >= 6 &&
			String.fromCharCode(...bytes.slice(0, 6)) === CAPSULE_V3_MAGIC_ASCII;
		if (magicOk) {
			let binary = '';
			const chunk = 0x8000;
			for (let i = 0; i < bytes.length; i += chunk) {
				binary += String.fromCharCode(
					...bytes.subarray(i, Math.min(i + chunk, bytes.length))
				);
			}
			const package_b64 = btoa(binary);
			const text = JSON.stringify({
				encoding: 'ecap_v3',
				package_b64,
			});
			return { ok: true, text, name: file.name };
		}
		const text = new TextDecoder('utf-8').decode(bytes);
		if (!text.trim()) {
			return { ok: false, error: 'В файле нет текста' };
		}
		return { ok: true, text, name: file.name };
	} catch {
		return { ok: false, error: 'Не удалось прочитать файл' };
	}
}

export function looksLikeWireGuardConf(text: string): boolean {
	return /\[Interface\]/i.test(text) && /PrivateKey\s*=/i.test(text);
}

export function looksLikeEntitlementJson(text: string): boolean {
	const t = text.trim();
	if (!t.startsWith('{')) return false;
	try {
		const obj = JSON.parse(t) as Record<string, unknown>;
		if (obj.kind === 'eliteew_desktop_seat') {
			return false;
		}
		if (obj.kind === 'eliteew_desktop_capsule') {
			return false;
		}
		if (obj.encoding === 'ecap_v3') {
			return false;
		}
		return (
			typeof obj === 'object' &&
			obj !== null &&
			('sig' in obj ||
				(typeof obj.payload === 'object' && obj.payload !== null) ||
				('license_id' in obj && 'apps' in obj))
		);
	} catch {
		return false;
	}
}
