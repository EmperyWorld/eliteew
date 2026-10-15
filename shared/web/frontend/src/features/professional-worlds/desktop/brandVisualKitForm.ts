/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side guards for Realtor brand-visual kit payloads before `PUT /me/brand-visual-kit`.
 *
 * Invariants:
 * - Invalid hex colours block submit (no silent fix); watermark padding clamps to 0–120 if present.
 *
 * Related:
 * - shared/web/frontend/src/features/professional-worlds/desktop/api.ts (`putBrandVisualKit`)
 */

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export interface BrandKitDraftShape {
	readonly primary_hex?: string;
	readonly accent_hex?: string;
	readonly typography_note?: string;
	readonly logo_asset_hint?: string;
	readonly watermark_corner?: '' | 'tr' | 'tl' | 'br' | 'bl' | 'none';
	readonly watermark_padding_px?: number | string;
}

export interface BrandKitValidationResult {
	readonly ok: boolean;
	readonly cleaned: BrandKitDraftShape;
	readonly messages: readonly string[];
}

function normHex(raw: unknown): string | undefined {
	if (typeof raw !== 'string') return undefined;
	const t = raw.trim();
	if (!t) return undefined;
	const v = t.startsWith('#') ? t : `#${t}`;
	return v.slice(0, 10).toUpperCase();
}

export function validateProfessionalBrandKitDraft(
	input: BrandKitDraftShape
): BrandKitValidationResult {
	const messages: string[] = [];
	const primary = normHex(input.primary_hex);
	const accent = normHex(input.accent_hex);
	if (input.primary_hex?.trim() && primary && !HEX_COLOR.test(primary)) {
		messages.push('brandKit.invalidPrimary');
	}
	if (input.accent_hex?.trim() && accent && !HEX_COLOR.test(accent)) {
		messages.push('brandKit.invalidAccent');
	}

	let wmPadRaw = input.watermark_padding_px;
	if (typeof wmPadRaw === 'string') {
		const parse = wmPadRaw.trim();
		wmPadRaw = parse ? Number(parse) : undefined;
	}
	let wmPad: number | undefined;
	if (typeof wmPadRaw === 'number' && Number.isFinite(wmPadRaw)) {
		wmPad = wmPadRaw;
		if (wmPad < 0 || wmPad > 120) {
			messages.push('brandKit.invalidWatermarkPadding');
		}
	}
	const typo =
		typeof input.typography_note === 'string'
			? input.typography_note.slice(0, 2000)
			: undefined;
	const logoHint =
		typeof input.logo_asset_hint === 'string'
			? input.logo_asset_hint.slice(0, 500)
			: undefined;
	const wc = input.watermark_corner || 'none';
	const watermark_corner =
		wc === 'tr' || wc === 'tl' || wc === 'br' || wc === 'bl' || wc === 'none'
			? wc
			: 'none';
	const cleaned: BrandKitDraftShape = {
		primary_hex: primary,
		accent_hex: accent,
		typography_note: typo,
		logo_asset_hint: logoHint,
		watermark_corner,
		watermark_padding_px: wmPad,
	};
	return { ok: messages.length === 0, cleaned, messages };
}
