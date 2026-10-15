/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP draft editor helpers: textarea ↔ bullets[] (mirrors backend `normalize_ewrp_slide_bullets`).
 *
 * Invariants:
 * - Live typing must round-trip exact textarea text (no trim/collapse) so the controlled
 *   caret does not jump; persist/save still cleans via normalize + save mapper.
 * - Line split rules for live edit: one textarea line = one draft bullet string (may be empty).
 *
 * Related:
 * - `useEwrpDraftEditor.ts`, `useEwrpDraftEditorSave.ts`, `api/services/ewrp_slide_bullets.py`
 */

/** Slide dict may store bullets under `bullets`, `content`, or `body` (legacy / LLM paths). */
export type EwrpSlideBulletsSource = {
	bullets?: unknown;
	content?: unknown;
	body?: unknown;
};

/** Normalize slide bullet lines (same rules as API `normalize_ewrp_slide_bullets`). */
export function normalizeEwrpSlideBullets(
	slide: EwrpSlideBulletsSource | null | undefined
): string[] {
	const out: string[] = [];
	const append = (raw: string) => {
		const trimmed = raw.trim();
		if (trimmed) out.push(trimmed);
	};
	const fromList = (items: unknown[]) => {
		for (const item of items) {
			if (item == null) continue;
			append(String(item));
		}
	};

	const rawBullets = slide?.bullets;
	if (typeof rawBullets === 'string') {
		for (const line of rawBullets.split('\n')) append(line);
	} else if (Array.isArray(rawBullets)) {
		fromList(rawBullets);
	}

	if (out.length === 0) {
		const content = slide?.content;
		if (typeof content === 'string') {
			for (const line of content.split('\n')) append(line);
		} else if (Array.isArray(content)) {
			fromList(content);
		}
	}

	if (out.length === 0) {
		const body = slide?.body;
		if (typeof body === 'string') {
			for (const line of body.split('\n')) append(line);
		}
	}

	return out;
}

/**
 * Textarea value for a slide row (newline-separated bullet lines).
 * Prefer raw `bullets[]` so live draft keeps trailing spaces / empty lines while typing.
 */
export function ewrpBulletsToTextareaValue(
	slide: EwrpSlideBulletsSource | null | undefined
): string {
	const raw = slide?.bullets;
	if (Array.isArray(raw)) {
		return raw.map((b) => (b == null ? '' : String(b))).join('\n');
	}
	if (typeof raw === 'string') {
		return raw;
	}
	return normalizeEwrpSlideBullets(slide).join('\n');
}

/**
 * Live editor: split textarea into draft lines without trim/collapse.
 * Persist cleaning happens on save (`useEwrpDraftEditorSave`) and via
 * {@link normalizeEwrpSlideBullets} when entering the editor.
 */
export function ewrpBulletLinesFromTextarea(value: string): string[] {
	return value.split('\n');
}

/** True when textarea text already matches draft bullets (skip redundant state updates). */
export function ewrpDraftBulletsUnchanged(
	prevSlide: EwrpSlideBulletsSource | undefined,
	textareaValue: string
): boolean {
	return ewrpBulletsToTextareaValue(prevSlide) === textareaValue;
}

/** Count non-empty bullets for compact slide summary. */
export function ewrpNonEmptyBulletCount(
	bullets: string[] | null | undefined
): number {
	return (bullets ?? []).filter((b) => b.trim().length > 0).length;
}
