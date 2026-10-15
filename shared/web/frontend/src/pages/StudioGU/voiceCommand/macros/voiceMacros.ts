/**
 * Voice macros: chains of 2–5 commands. Persisted in localStorage.
 */

export interface VoiceMacro {
	id: string;
	name: string;
	commandIds: string[];
}

const STORAGE_KEY = 'voice_command_center_macros';
const MIN_STEPS = 2;
const MAX_STEPS = 5;

export function loadMacros(): VoiceMacro[] {
	try {
		const raw =
			typeof localStorage !== 'undefined'
				? localStorage.getItem(STORAGE_KEY)
				: null;
		if (raw) {
			const parsed = JSON.parse(raw) as unknown;
			if (Array.isArray(parsed)) {
				return parsed.filter(
					(m): m is VoiceMacro =>
						m != null &&
						typeof m === 'object' &&
						typeof (m as VoiceMacro).id === 'string' &&
						typeof (m as VoiceMacro).name === 'string' &&
						Array.isArray((m as VoiceMacro).commandIds)
				);
			}
		}
	} catch {
		// ignore
	}
	return getDefaultMacros();
}

function getDefaultMacros(): VoiceMacro[] {
	return [
		{
			id: 'macro-workplace',
			name: 'Подготовь рабочее место',
			commandIds: ['open_gaf_chat', 'open_content', 'open_presentations'],
		},
	];
}

export function saveMacros(macros: VoiceMacro[]): void {
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
		}
	} catch {
		// ignore
	}
}

export function validateMacro(m: Partial<VoiceMacro>): m is VoiceMacro {
	return (
		typeof m?.id === 'string' &&
		typeof m?.name === 'string' &&
		Array.isArray(m.commandIds) &&
		m.commandIds.length >= MIN_STEPS &&
		m.commandIds.length <= MAX_STEPS
	);
}

/** Normalize phrase for matching: lowercase, trim, collapse spaces. */
function normalizePhrase(text: string): string {
	return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Find a macro whose name matches the transcript (exact or transcript contains macro name).
 * Used so "Подготовь рабочее место" runs the macro instead of sending to AI.
 */
export function findMacroByTranscript(
	transcript: string,
	macros: VoiceMacro[]
): VoiceMacro | null {
	const n = normalizePhrase(transcript);
	if (!n) return null;
	for (const m of macros) {
		const nameNorm = normalizePhrase(m.name);
		if (nameNorm && (n === nameNorm || n.includes(nameNorm))) return m;
	}
	return null;
}

export { MIN_STEPS, MAX_STEPS };
