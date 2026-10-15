/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Solo / Команда / Дискуссия / Совещание mental-model labels stay distinct.
 *
 * Invariants:
 * - Entry journeys already exist (picker / overflow); this is SoT label isolation, not a mode switcher.
 * - Council «Совещание» ≠ product «Дискуссия».
 *
 * Related:
 * - documentation/product/DESKTOP-LLAMA-CHAT.md §User mental model
 * - desktopAiChat.jargon.test.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const ru = JSON.parse(
	readFileSync(join(dir, '../../../i18n/locales/ru/desktopAiChat.json'), 'utf8')
) as Record<string, string>;
const en = JSON.parse(
	readFileSync(join(dir, '../../../i18n/locales/en/desktopAiChat.json'), 'utf8')
) as Record<string, string>;

describe('desktop AI Chat mental model IA labels', () => {
	it('keeps Соло / Команда / Дискуссия / Совещание as distinct RU product words', () => {
		const blob = JSON.stringify(ru);
		expect(blob).toMatch(/Соло|соло/);
		expect(blob).toMatch(/Команда/);
		expect(blob).toMatch(/Дискусси/);
		expect(blob).toMatch(/Совещани/);
		// Council mode label must not be product Discussion
		expect(String(ru.councilModeDiscussion || '')).not.toMatch(/дискусс/i);
		expect(String(ru.discussionStart || '')).toMatch(/дискусс/i);
	});

	it('keeps Solo / Team / Discussion / Council distinct in EN', () => {
		const blob = JSON.stringify(en);
		expect(blob).toMatch(/\bSolo\b|\bsolo\b/);
		expect(blob).toMatch(/\bTeam\b|\bCouncil\b/);
		expect(blob).toMatch(/\bDiscussion\b/);
		expect(String(en.councilModeDiscussion || '')).not.toMatch(
			/\bdiscussion\b/i
		);
		expect(String(en.discussionStart || '')).toMatch(/Discussion/i);
	});
});
