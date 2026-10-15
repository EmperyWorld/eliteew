/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest для клиентского футера RAG-источников (контракт с Python helpers).
 *
 * Related:
 * - pages/Desktop/utils/assistantRagSourcesFooter.ts
 */
import { describe, expect, it } from 'vitest';
import {
	collectRagSourceLabels,
	formatAssistantRagSourcesFooter,
	maybeAppendRagSourcesFooter,
} from '../assistantRagSourcesFooter';

describe('assistantRagSourcesFooter', () => {
	it('deduplicates labels case-insensitively', () => {
		expect(
			collectRagSourceLabels(['Doc A', 'doc a', '', null, 'Doc B'])
		).toEqual(['Doc A', 'Doc B']);
	});

	it('formats footer with up to five titles', () => {
		const footer = formatAssistantRagSourcesFooter(['kb-one.md', 'kb-two.md']);
		expect(footer).toContain('*Источники справочника:*');
		expect(footer).toContain('«kb-one.md»');
		expect(footer).toContain('«kb-two.md»');
	});

	it('appends footer when reply has no source mention', () => {
		const out = maybeAppendRagSourcesFooter('Ответ.', ['kb-magazin.md']);
		expect(out).toContain('Ответ.');
		expect(out).toContain('kb-magazin.md');
	});

	it('skips append when reply already cites sources', () => {
		const text = 'См. источники справочника выше.';
		expect(maybeAppendRagSourcesFooter(text, ['kb-doc.md'])).toBe(text);
	});
});
