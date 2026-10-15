/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for companion chat markdown table boundary repair and ATX heading splits.
 *
 * Related:
 * - src/features/ewa/companionChatMarkdownNormalize.ts
 */

import { describe, expect, it } from 'vitest';

import {
	countCompanionGfmTableColumns,
	isCompanionGfmTableRowLine,
	isCompanionGfmTableSeparatorLine,
	normalizeCompanionChatMarkdown,
	repairCompanionGfmTableBoundaries,
} from '@/features/ewa/companionChatMarkdownNormalize';

describe('companionChatMarkdownNormalize', () => {
	it('detects GFM table rows and separators', () => {
		expect(isCompanionGfmTableRowLine('| A | B |')).toBe(true);
		expect(isCompanionGfmTableSeparatorLine('| --- | --- |')).toBe(true);
		expect(isCompanionGfmTableSeparatorLine('|:--|:---|')).toBe(true);
		expect(isCompanionGfmTableSeparatorLine('|:-:|--:|')).toBe(true);
		expect(countCompanionGfmTableColumns('| a | b | c |')).toBe(3);
		expect(isCompanionGfmTableRowLine('plain paragraph')).toBe(false);
	});

	it('closes table before prose lines without pipes', () => {
		const input = [
			'| Параметр | Текст-хаос | Текст-архитектура |',
			'| --- | --- | --- |',
			'| row | a | b |',
			'### Следующий раздел',
			'Абзац после таблицы.',
		].join('\n');

		const out = repairCompanionGfmTableBoundaries(input);
		expect(out).toContain('| row | a | b |');
		expect(out).toContain('\n\n### Следующий раздел');
		expect(out).toContain('Абзац после таблицы.');
	});

	it('closes table when a row has wrong column count (extra pipes in cell)', () => {
		const input = [
			'| A | B | C |',
			'| --- | --- | --- |',
			'| ok | ok | ok |',
			'| bad | pipe | inside | extra |',
			'After table line.',
		].join('\n');

		const out = repairCompanionGfmTableBoundaries(input);
		expect(out).toMatch(/\| ok \| ok \| ok \|\n\n\| bad \|/);
		expect(out).toContain('After table line.');
	});

	it('does not modify fenced code blocks', () => {
		const input = ['```md', '| not | a | table |', 'plain line', '```'].join(
			'\n'
		);
		expect(repairCompanionGfmTableBoundaries(input)).toBe(input);
	});

	it('splits jammed ATX headings outside fences', () => {
		const input = 'Вступление # Заголовок';
		expect(normalizeCompanionChatMarkdown(input)).toBe(
			'Вступление\n\n# Заголовок'
		);
	});
});
