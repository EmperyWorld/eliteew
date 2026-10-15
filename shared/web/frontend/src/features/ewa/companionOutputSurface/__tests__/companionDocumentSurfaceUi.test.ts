/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for pure embedded document surface helpers.
 *
 * Invariants:
 * - No DOM, network or AI calls; this suite guards text-range and payload coercion boundaries.
 *
 * Related:
 * - ../companionDocumentSurfaceUi
 */

import { describe, expect, it } from 'vitest';

import { applyDocumentStructureSelection } from '../CompanionDocumentStructurePanel';
import {
	applyDocumentSurfaceReplacement,
	coerceCompanionDocumentSurfacePayload,
	selectedTextRange,
} from '../companionDocumentSurfaceUi';

describe('companionDocumentSurfaceUi', () => {
	it('coerces server and action payload aliases', () => {
		expect(
			coerceCompanionDocumentSurfacePayload({
				unified_content_id: ' uc-1 ',
				title: ' Plan ',
				content_markdown: ' # Hello\n\nWorld ',
				source_format: 'markdown',
				parse_warnings: [' markdown_glue_normalized ', null],
				source: 'companion_action',
			})
		).toEqual({
			documentId: 'uc-1',
			title: 'Plan',
			initialMarkdown: '# Hello\n\nWorld',
			sourceFormat: 'markdown',
			parseWarnings: ['markdown_glue_normalized'],
			source: 'companion_action',
		});
	});

	it('extracts bounded textarea selection', () => {
		expect(selectedTextRange('abcdef', 2, 4)).toEqual({
			start: 2,
			end: 4,
			text: 'cd',
		});
		expect(selectedTextRange('abcdef', 4, 2)).toEqual({
			start: 2,
			end: 4,
			text: 'cd',
		});
		expect(selectedTextRange('abcdef', 3, 3)).toBeNull();
	});

	it('applies AI replacement to selection or appends when selection is absent', () => {
		expect(
			applyDocumentSurfaceReplacement(
				'hello old world',
				{
					start: 6,
					end: 9,
					text: 'old',
				},
				'new'
			)
		).toBe('hello new world');
		expect(applyDocumentSurfaceReplacement('hello', null, 'next')).toBe('next');
	});

	it('uses explicit backend markdown instead of converting initial html', () => {
		expect(
			coerceCompanionDocumentSurfacePayload({
				initialHtml: '<h2>Title</h2><p>A<br>B</p>',
				content_markdown: '## Backend title',
			}).initialMarkdown
		).toBe('## Backend title');
	});

	it('applies server structure offsets to textarea selection', () => {
		const textarea = document.createElement('textarea');
		textarea.value = '# Seed';
		document.body.appendChild(textarea);
		applyDocumentStructureSelection(textarea, { charStart: 2, charEnd: 6 });
		expect(textarea.selectionStart).toBe(2);
		expect(textarea.selectionEnd).toBe(6);
		textarea.remove();
	});

	it('falls back to plain text when only initial html is provided', () => {
		expect(
			coerceCompanionDocumentSurfacePayload({
				initialHtml: '<h2>Title</h2><p>A<br>B</p>',
			})
		).toEqual({
			documentId: null,
			title: 'Document',
			initialMarkdown: 'Title\nA\nB',
			sourceFormat: 'html',
			parseWarnings: ['initial_html_plaintext_fallback'],
			source: 'output_surface',
		});
	});
});
