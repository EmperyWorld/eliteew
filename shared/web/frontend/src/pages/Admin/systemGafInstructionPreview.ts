/**
 * Plaintext preview for system GAF instruction — keep in sync with
 * `api/gaf_chat/system_gaf_instruction.py` `build_instruction_body_and_metadata`.
 */
export type InstructionStepForPreview = {
	title: string;
	body: string;
	open_app_component: string | null;
	button_label: string | null;
};

export function buildInstructionPlaintextPreview(
	welcomeText: string,
	thanksText: string,
	steps: InstructionStepForPreview[]
): string {
	const lines: string[] = [];
	const w = (welcomeText || '').trim();
	const t = (thanksText || '').trim();
	if (w) {
		lines.push(w);
	}
	if (t) {
		if (lines.length) {
			lines.push('');
		}
		lines.push(t);
	}

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		const title = (step.title || '').trim();
		const body = (step.body || '').trim();
		const n = i + 1;
		if (lines.length) {
			lines.push('');
		}
		if (title) {
			lines.push(`${n}. ${title}`);
		} else if (body) {
			lines.push(`${n}.`);
		}
		if (body) {
			lines.push(body);
		}
	}

	return lines.join('\n').trim();
}

/** Accepts standard UUID hex strings (server validates strictly). */
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseBulkUserIdsDetailed(raw: string): {
	valid: string[];
	invalidTokens: string[];
} {
	const seen = new Set<string>();
	const valid: string[] = [];
	const invalidTokens: string[] = [];
	for (const part of raw.split(/[\s,;]+/)) {
		const p = part.trim();
		if (!p) {
			continue;
		}
		if (UUID_RE.test(p)) {
			const lower = p.toLowerCase();
			if (!seen.has(lower)) {
				seen.add(lower);
				valid.push(p);
			}
		} else {
			invalidTokens.push(p);
		}
	}
	return { valid, invalidTokens };
}

export function parseBulkUserIds(raw: string): string[] {
	return parseBulkUserIdsDetailed(raw).valid;
}

/** Max chunk size for POST /system-gaf/send (avoid huge JSON bodies). */
export const BULK_SEND_CHUNK_SIZE = 40;
