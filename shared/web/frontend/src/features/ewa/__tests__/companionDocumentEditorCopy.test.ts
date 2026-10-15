/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression test for embedded companion document-editor copy to keep wording companion-centric.
 *
 * Invariants:
 * - Document editor hint micro-copy must not mention explicit "AI"/"АИ".
 * - RU/EN hints should still clearly reference companion behavior.
 * - User-facing document surface strings must not leak operator jargon (DocEditor, EwaFile, Markdown label).
 *
 * Related:
 * - src/i18n/locales/en/marketing.json
 * - src/i18n/locales/ru/marketing.json
 */
import { describe, expect, it } from 'vitest';

import enMarketing from '@/i18n/locales/en/marketing.json';
import ruMarketing from '@/i18n/locales/ru/marketing.json';

const editorHintKeys = [
	'documentSurfacePlaceholder',
	'documentSurfaceSelection',
	'documentSurfaceNoSelection',
] as const;

const operatorJargonFreeKeys = [
	'documentSurfaceMarkdownLabel',
	'documentSurfacePolicyBlocked',
	'documentSurfacePolicyWarnings',
	'fileListSurfaceTitle',
] as const;

const bannedOperatorTerms = [
	/doceditor/i,
	/ewafile/i,
	/\bmarkdown document\b/i,
	/\bmarkdown-документ\b/u,
];

describe('companion document editor i18n copy regression', () => {
	it('keeps EN hints companion-centric without explicit AI wording', () => {
		for (const key of editorHintKeys) {
			const text = enMarketing.ewaCompanion[key];
			expect(typeof text).toBe('string');
			expect(text).toMatch(/companion/i);
			expect(text).not.toMatch(/\bAI\b/i);
		}
	});

	it('keeps RU hints companion-centric without explicit АИ wording', () => {
		for (const key of editorHintKeys) {
			const text = ruMarketing.ewaCompanion[key];
			expect(typeof text).toBe('string');
			expect(text).toMatch(/компань/i);
			expect(text).not.toMatch(/\bАИ\b/u);
			expect(text).not.toMatch(/\bAI\b/i);
		}
	});

	it('avoids operator jargon in EN user-facing document surface keys', () => {
		for (const key of operatorJargonFreeKeys) {
			const text = enMarketing.ewaCompanion[key];
			expect(typeof text).toBe('string');
			for (const pattern of bannedOperatorTerms) {
				expect(text).not.toMatch(pattern);
			}
		}
	});

	it('avoids operator jargon in RU user-facing document surface keys', () => {
		for (const key of operatorJargonFreeKeys) {
			const text = ruMarketing.ewaCompanion[key];
			expect(typeof text).toBe('string');
			for (const pattern of bannedOperatorTerms) {
				expect(text).not.toMatch(pattern);
			}
		}
	});
});
