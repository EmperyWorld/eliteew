/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse/detect downloadable desktop-client seat packages (desktop-client-014).
 *
 * Invariants:
 * - kind must be eliteew_desktop_seat; v=1.
 * - F-04: never accept/store plaintext wg_conf — channel material is Capsule/Rust-only.
 * - Cloud may lack entitlement when signing unset.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 * - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md §desktop-client-014
 */

export const SEAT_KIND = 'eliteew_desktop_seat' as const;
export const SEAT_SCHEMA_VERSION = 1;

export type SeatMode = 'offline' | 'cloud' | 'both';

export type SeatPackage = {
	v: number;
	kind: typeof SEAT_KIND;
	mode: SeatMode;
	mode_label_ru?: string;
	mode_hint_ru?: string;
	allow_offline?: boolean;
	allow_online?: boolean;
	allow_fofline?: boolean;
	allowed_email?: string | null;
	issued_at?: string;
	label?: string | null;
	license_id?: string;
	license_key?: string;
	edition?: string;
	profile_id?: string | null;
	apps?: string[];
	entitlement?: unknown;
	peer?: { slug?: string; assigned_ip?: string } | null;
	notes_ru?: string;
};

export type ParseSeatResult =
	| { ok: true; package: SeatPackage }
	| { ok: false; error: string };

export function looksLikeSeatPackageJson(text: string): boolean {
	const t = text.trim();
	if (!t.startsWith('{')) return false;
	try {
		const o = JSON.parse(t) as Record<string, unknown>;
		return o.kind === SEAT_KIND;
	} catch {
		return false;
	}
}

export function parseSeatPackageJson(text: string): ParseSeatResult {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: 'Файл не похож на JSON пакета места' };
	}
	if (!raw || typeof raw !== 'object') {
		return { ok: false, error: 'Пакет места должен быть объектом JSON' };
	}
	const o = raw as Record<string, unknown>;
	if (o.kind !== SEAT_KIND) {
		return {
			ok: false,
			error: 'Это не пакет места EliteEW (ожидается kind=eliteew_desktop_seat)',
		};
	}
	const v = Number(o.v);
	if (!Number.isFinite(v) || v !== SEAT_SCHEMA_VERSION) {
		return { ok: false, error: `Неподдерживаемая версия пакета (v=${String(o.v)})` };
	}
	const mode = o.mode;
	if (mode !== 'offline' && mode !== 'cloud' && mode !== 'both') {
		return {
			ok: false,
			error: 'В пакете должен быть mode=offline, cloud или both',
		};
	}
	const licenseKey =
		typeof o.license_key === 'string' ? o.license_key.trim() : '';
	const hasEntitlement =
		o.entitlement !== null &&
		typeof o.entitlement === 'object' &&
		!Array.isArray(o.entitlement);
	if (!licenseKey && !hasEntitlement) {
		return {
			ok: false,
			error: 'В пакете нет ни ключа лицензии, ни локального пакета доступа',
		};
	}
	if (typeof o.wg_conf === 'string' && o.wg_conf.trim()) {
		return {
			ok: false,
			error:
				'Пакет содержит конфиг канала в открытом виде. Импортируйте Capsule (.ecap) — канал подключается только внутри приложения.',
		};
	}
	return {
		ok: true,
		package: {
			v,
			kind: SEAT_KIND,
			mode,
			mode_label_ru:
				typeof o.mode_label_ru === 'string' ? o.mode_label_ru : undefined,
			mode_hint_ru:
				typeof o.mode_hint_ru === 'string' ? o.mode_hint_ru : undefined,
			allow_offline:
				typeof o.allow_offline === 'boolean' ? o.allow_offline : undefined,
			allow_online:
				typeof o.allow_online === 'boolean' ? o.allow_online : undefined,
			allow_fofline:
				typeof o.allow_fofline === 'boolean' ? o.allow_fofline : undefined,
			allowed_email:
				typeof o.allowed_email === 'string' ? o.allowed_email : null,
			issued_at: typeof o.issued_at === 'string' ? o.issued_at : undefined,
			label: typeof o.label === 'string' ? o.label : null,
			license_id: typeof o.license_id === 'string' ? o.license_id : undefined,
			license_key: licenseKey || undefined,
			edition: typeof o.edition === 'string' ? o.edition : undefined,
			profile_id: typeof o.profile_id === 'string' ? o.profile_id : null,
			apps: Array.isArray(o.apps)
				? o.apps.filter((x): x is string => typeof x === 'string')
				: undefined,
			entitlement: hasEntitlement ? o.entitlement : undefined,
			peer:
				o.peer && typeof o.peer === 'object'
					? (o.peer as SeatPackage['peer'])
					: null,
			notes_ru: typeof o.notes_ru === 'string' ? o.notes_ru : undefined,
		},
	};
}
