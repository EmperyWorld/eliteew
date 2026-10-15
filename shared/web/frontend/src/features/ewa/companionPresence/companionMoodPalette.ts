/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map a companion's `seed_persona_id` and **`companion_character_v1.mood`** (plus optional **`repair_need`** /
 * hidden **trust meter** 0–10 from `ewa_companion_trust_v1`) to CSS variables for the presence canvas: aura tint,
 * glow, backdrop, transcript divider color.
 *
 * Invariants:
 * - Pure (no React, no DOM access) — returns a CSS-variable record consumed via `style={{ ... }}`.
 * - Keeps the public color slots stable (`--companion-aura`, `--companion-glow`, `--companion-bg`,
 *   `--companion-divider`) so the chat panel's CSS can consume them without touching this file.
 *
 * Related:
 * - src/features/ewa/ewaPersonaCatalog.ts
 * - src/features/ewa/companionPresence/CompanionSigil.tsx
 */
import type { EwaPersonaId } from '@/features/ewa/ewaPersonaCatalog';

export type CompanionMoodBlock = {
	/** -1..1, cool→warm */
	valence?: number | null;
	/** 0..1, sleepy→bright */
	energy?: number | null;
	/** 0..1, relaxed→tense */
	tension?: number | null;
	/** 0..1, uncertain→confident */
	confidence?: number | null;
};

type SeedPalette = {
	auraHue: number;
	auraSat: number;
	auraLight: number;
	bgHue: number;
};

/**
 * Anchor palette per `seed_persona_id`. Hue/saturation/lightness in HSL space so we can blend mood deltas without
 * fighting Tailwind's color tokens.
 */
const SEED_PALETTE: Record<EwaPersonaId, SeedPalette> = {
	parent: { auraHue: 268, auraSat: 70, auraLight: 65, bgHue: 270 },
	mela: { auraHue: 340, auraSat: 75, auraLight: 70, bgHue: 330 },
	zera: { auraHue: 205, auraSat: 80, auraLight: 70, bgHue: 210 },
	kora: { auraHue: 158, auraSat: 65, auraLight: 55, bgHue: 165 },
	tala: { auraHue: 35, auraSat: 80, auraLight: 60, bgHue: 32 },
	feni: { auraHue: 220, auraSat: 12, auraLight: 65, bgHue: 220 },
	arlika: { auraHue: 348, auraSat: 82, auraLight: 52, bgHue: 280 },
	arlika_v2: { auraHue: 32, auraSat: 88, auraLight: 58, bgHue: 280 },
};

function clamp(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

export type CompanionPresenceCssVars = Record<
	| '--companion-aura'
	| '--companion-aura-soft'
	| '--companion-glow'
	| '--companion-bg'
	| '--companion-divider'
	| '--companion-text-soft'
	| '--companion-work-intensity',
	string
>;

export type CompanionPresencePaletteOpts = {
	/** Server trust meter **0–10** — drives a **subtle** saturation/light drift only (never labeled in UI). */
	trustMeterScore?: number | null;
	/** `character_state.bond.repair_need` 0..1 — cools/dulls palette when rapport repair is high. */
	repairNeed?: number | null;
};

export function buildCompanionPresencePalette(
	personaId: EwaPersonaId,
	mood?: CompanionMoodBlock | null,
	opts?: CompanionPresencePaletteOpts | null
): CompanionPresenceCssVars {
	const seed = SEED_PALETTE[personaId];
	const valence = clamp(
		typeof mood?.valence === 'number' ? mood.valence : 0,
		-1,
		1
	);
	const energy = clamp(
		typeof mood?.energy === 'number' ? mood.energy : 0.5,
		0,
		1
	);
	const tension = clamp(
		typeof mood?.tension === 'number' ? mood.tension : 0.1,
		0,
		1
	);
	// Warm valence drifts hue toward 30°; cool toward 220° — keeps personality but reflects mood shifts.
	const target = valence >= 0 ? 30 : 220;
	const drift = Math.abs(valence) * 12;
	const hue = Math.round(seed.auraHue + (target - seed.auraHue) * (drift / 60));
	let sat = clamp(seed.auraSat + valence * 8 - tension * 5, 25, 95);
	let light = clamp(seed.auraLight + (energy - 0.5) * 12 - tension * 4, 35, 80);

	const repair = clamp(
		typeof opts?.repairNeed === 'number' && Number.isFinite(opts.repairNeed)
			? opts.repairNeed
			: 0,
		0,
		1
	);
	sat = clamp(sat - repair * 14, 25, 95);
	light = clamp(light - repair * 7, 35, 80);

	const tm = opts?.trustMeterScore;
	if (typeof tm === 'number' && Number.isFinite(tm)) {
		const norm = clamp(tm / 10, 0, 1);
		sat = clamp(sat + norm * 6, 25, 95);
		light = clamp(light + (norm - 0.5) * 5, 35, 80);
	}
	const aura = `hsl(${hue}deg ${sat}% ${light}%)`;
	const auraSoft = `hsl(${hue}deg ${Math.round(sat * 0.6)}% ${Math.min(light + 8, 88)}% / 0.55)`;
	const glow = `hsl(${hue}deg ${sat}% ${light}% / 0.42)`;
	const bg = `hsl(${seed.bgHue}deg ${Math.round(sat * 0.4)}% ${Math.max(light - 28, 12)}% / 0.32)`;
	const divider = `hsl(${hue}deg ${Math.round(sat * 0.5)}% ${Math.min(light + 6, 78)}% / 0.18)`;
	const textSoft = `hsl(${hue}deg ${Math.round(sat * 0.3)}% ${Math.min(light + 14, 82)}% / 0.78)`;
	return {
		'--companion-aura': aura,
		'--companion-aura-soft': auraSoft,
		'--companion-glow': glow,
		'--companion-bg': bg,
		'--companion-divider': divider,
		'--companion-text-soft': textSoft,
		'--companion-work-intensity': '0',
	};
}

type ParsedHsl = {
	h: number;
	s: number;
	l: number;
	alpha: number;
};

function parseHslColor(raw: string): ParsedHsl | null {
	const match = raw.match(
		/hsl\(\s*([\d.]+)deg\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+))?\s*\)/i
	);
	if (!match) return null;
	return {
		h: Number(match[1]),
		s: Number(match[2]),
		l: Number(match[3]),
		alpha: match[4] != null ? Number(match[4]) : 1,
	};
}

function formatHslColor(parsed: ParsedHsl): string {
	const alpha =
		parsed.alpha < 1 ? ` / ${Math.round(parsed.alpha * 100) / 100}` : '';
	return `hsl(${Math.round(parsed.h)}deg ${Math.round(parsed.s)}% ${Math.round(parsed.l)}%${alpha})`;
}

/** Amplify persona palette while chat or durable operations are active (smooth via CSS transition on work-intensity). */
export function applyCompanionWorkIntensityToPalette(
	palette: CompanionPresenceCssVars,
	workIntensity: number
): CompanionPresenceCssVars {
	const t = clamp(workIntensity, 0, 1);
	if (t <= 0) {
		return { ...palette, '--companion-work-intensity': '0' };
	}

	const aura = parseHslColor(palette['--companion-aura']);
	if (!aura) {
		return {
			...palette,
			'--companion-work-intensity': String(Math.round(t * 1000) / 1000),
		};
	}

	const heated: ParsedHsl = {
		h: aura.h,
		s: clamp(aura.s + t * 20, 25, 98),
		l: clamp(aura.l + t * 6, 35, 88),
		alpha: aura.alpha,
	};
	const glowParsed = parseHslColor(palette['--companion-glow']);
	const glowAlpha = glowParsed?.alpha ?? 0.42;
	const heatedGlow: ParsedHsl = {
		...heated,
		alpha: clamp(glowAlpha + t * 0.28, 0.2, 0.92),
	};
	const bgParsed = parseHslColor(palette['--companion-bg']);
	const heatedBg: ParsedHsl = bgParsed
		? {
				...bgParsed,
				s: clamp(bgParsed.s + t * 12, 10, 80),
				l: clamp(bgParsed.l + t * 4, 8, 40),
				alpha: clamp((bgParsed.alpha ?? 0.32) + t * 0.18, 0.12, 0.72),
			}
		: heated;

	return {
		...palette,
		'--companion-aura': formatHslColor(heated),
		'--companion-aura-soft': formatHslColor({
			...heated,
			s: clamp(heated.s * 0.65, 20, 90),
			l: clamp(heated.l + 8, 40, 92),
			alpha: clamp(0.55 + t * 0.2, 0.45, 0.9),
		}),
		'--companion-glow': formatHslColor(heatedGlow),
		'--companion-bg': formatHslColor(heatedBg),
		'--companion-divider': formatHslColor({
			...heated,
			s: clamp(heated.s * 0.55, 18, 85),
			l: clamp(heated.l + 4, 38, 84),
			alpha: clamp(0.18 + t * 0.22, 0.12, 0.55),
		}),
		'--companion-work-intensity': String(Math.round(t * 1000) / 1000),
	};
}
