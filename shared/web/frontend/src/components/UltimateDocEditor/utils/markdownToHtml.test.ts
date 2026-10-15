/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Security boundary tests for markdown bootstrap conversion before editor HTML rendering.
 *
 * Invariants:
 * - Raw HTML from markdown import cannot carry scripts, event handlers, or javascript URLs.
 * - Markdown repair helpers reuse the same sanitized conversion path.
 *
 * Related:
 * - src/components/UltimateDocEditor/utils/markdownToHtml.ts
 */
import { describe, expect, it } from 'vitest';
import {
	markdownToEditorHtml,
	repairHtmlIfSingleParagraphMarkdown,
} from './markdownToHtml';

describe('markdownToEditorHtml', () => {
	it('sanitizes raw HTML and unsafe links produced by marked', () => {
		const html = markdownToEditorHtml(
			'# Title\n\n<script>alert(1)</script><img src=x onerror=alert(2)>[x](javascript:alert(3))'
		);
		expect(html).toContain('<h1>Title</h1>');
		expect(html).not.toContain('<script');
		expect(html).not.toContain('onerror');
		expect(html).not.toContain('href="javascript:');
		expect(html).not.toContain('<img');
	});
});

describe('repairHtmlIfSingleParagraphMarkdown', () => {
	it('returns sanitized HTML when repairing one-paragraph markdown', () => {
		const repaired = repairHtmlIfSingleParagraphMarkdown(
			'<p># Title<br><script>alert(1)</script><br>- item</p>'
		);
		expect(repaired).toContain('<h1>Title</h1>');
		expect(repaired).not.toContain('script');
	});
});
