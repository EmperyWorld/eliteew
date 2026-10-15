/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect/open Sealed Capsule files (v3 opaque or v2 JSON); retail rejects plaintext seat unless ops debug.
 *
 * Invariants:
 * - Retail sealed: capsule imports via Rust-only capsule_import_channel.
 * - Ops debug may accept plaintext eliteew_desktop_seat for local tooling.
 * - Capsule v3 transport: encoding=ecap_v3 + package_b64 (or binary wrap via fileDrop).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §Sealed Capsule
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md
 */

import { isRetailSealedUi } from './retailSealed';
import { SEAT_KIND, looksLikeSeatPackageJson } from './seatPackage';
import {
	capsuleImportChannel,
	capsuleImportPickFile,
	type CapsuleImportView,
} from '../tauri-bridge/commands';

export const CAPSULE_KIND = 'eliteew_desktop_capsule' as const;
export const CAPSULE_ENCODING_V3 = 'ecap_v3' as const;

export function looksLikeCapsuleV3(text: string): boolean {
	const t = text.trim();
	if (!t.startsWith('{')) return false;
	try {
		const o = JSON.parse(t) as Record<string, unknown>;
		return (
			o.encoding === CAPSULE_ENCODING_V3 &&
			typeof o.package_b64 === 'string' &&
			o.package_b64.length > 0
		);
	} catch {
		return false;
	}
}

export function looksLikeCapsuleJson(text: string): boolean {
	if (looksLikeCapsuleV3(text)) return true;
	const t = text.trim();
	if (!t.startsWith('{')) return false;
	try {
		const o = JSON.parse(t) as Record<string, unknown>;
		return o.kind === CAPSULE_KIND;
	} catch {
		return false;
	}
}

export type ResolveImportResult =
	| { ok: true; kind: 'capsule'; import: CapsuleImportView }
	| { ok: true; kind: 'seat'; seatJson: string }
	| { ok: false; error: string; code?: string };

/** Native `.ecap` picker (rfd) — GTK/WebKit HTML accept is unreliable on Linux. */
export async function resolveCapsuleNativePick(): Promise<ResolveImportResult> {
	try {
		const imported = await capsuleImportPickFile();
		if (imported.code === 'capsule_pick_cancelled') {
			return { ok: false, error: '' };
		}
		if (!imported.ok) {
			return {
				ok: false,
				error: imported.message || 'Файл недействителен',
				code: imported.code,
			};
		}
		return { ok: true, kind: 'capsule', import: imported };
	} catch {
		return { ok: false, error: 'Не удалось открыть файл доступа' };
	}
}

/**
 * Resolve dropped/imported text: capsules stay Rust-only; plaintext seat is ops-only.
 */
export async function resolveSeatOrCapsuleImport(
	raw: string
): Promise<ResolveImportResult> {
	const text = raw.trim();
	if (looksLikeCapsuleV3(text) || looksLikeCapsuleJson(text)) {
		try {
			const imported = await capsuleImportChannel(text);
			if (!imported.ok) {
				return {
					ok: false,
					error: imported.message || 'Файл недействителен',
					code: imported.code,
				};
			}
			return { ok: true, kind: 'capsule', import: imported };
		} catch {
			return { ok: false, error: 'Файл недействителен' };
		}
	}
	if (looksLikeSeatPackageJson(text)) {
		if (isRetailSealedUi()) {
			return {
				ok: false,
				error:
					'Нужен файл доступа от администратора. Открытый пакет места в обычном режиме не принимается.',
			};
		}
		return { ok: true, kind: 'seat', seatJson: text };
	}
	return {
		ok: false,
		error: `Ожидается файл доступа EliteEW (kind=${CAPSULE_KIND}, encoding=${CAPSULE_ENCODING_V3} или ${SEAT_KIND} в режиме поддержки)`,
	};
}
