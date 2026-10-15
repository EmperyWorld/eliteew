/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Turn structured learning exercise payloads into readable copy for Professional Worlds courses UI.
 *
 * Invariants:
 * - Returns a primary text line when a known field exists; otherwise callers fall back to support JSON.
 *
 * Related:
 * - components/ProfessionalLearningCoursesPanel.tsx
 */

const EXERCISE_TEXT_KEYS = [
	'prompt',
	'text',
	'instructions',
	'task',
	'description',
] as const;

export function formatLearningExercise(value: unknown): {
	primary: string | null;
	raw: Record<string, unknown> | null;
} {
	if (value == null) {
		return { primary: null, raw: null };
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed
			? { primary: trimmed, raw: null }
			: { primary: null, raw: null };
	}
	if (typeof value !== 'object' || Array.isArray(value)) {
		return { primary: null, raw: null };
	}

	const record = value as Record<string, unknown>;
	for (const key of EXERCISE_TEXT_KEYS) {
		const candidate = record[key];
		if (typeof candidate === 'string' && candidate.trim()) {
			return { primary: candidate.trim(), raw: record };
		}
	}

	const steps = record.steps;
	if (Array.isArray(steps)) {
		const lines = steps
			.filter((step): step is string => typeof step === 'string')
			.map((step) => step.trim())
			.filter(Boolean);
		if (lines.length > 0) {
			return { primary: lines.join('\n'), raw: record };
		}
	}

	return { primary: null, raw: record };
}
