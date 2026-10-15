/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verifies document-editor text/HTML normalization helpers used by save
 * comparison and plain clipboard insertion.
 *
 * Invariants:
 * - Plain clipboard text must preserve visible line breaks.
 * - Plain clipboard text must be escaped before it is inserted as TipTap HTML.
 *
 * Related:
 * - src/components/UltimateDocEditor/components/EditorContextMenu.tsx
 */

import { describe, expect, it } from 'vitest';
import { convertPlainTextToHtml } from './htmlComparableText';

describe('convertPlainTextToHtml', () => {
	it('preserves single newlines as visible editor line breaks', () => {
		expect(convertPlainTextToHtml('one\ntwo\nthree')).toBe(
			'<p>one<br />two<br />three</p>'
		);
	});

	it('keeps blank lines as paragraph boundaries', () => {
		expect(convertPlainTextToHtml('one\n\ntwo')).toBe('<p>one</p><p>two</p>');
	});

	it('escapes clipboard text instead of trusting it as HTML', () => {
		expect(convertPlainTextToHtml('<b>raw</b> & "quoted"')).toBe(
			'<p>&lt;b&gt;raw&lt;/b&gt; &amp; &quot;quoted&quot;</p>'
		);
	});
});
