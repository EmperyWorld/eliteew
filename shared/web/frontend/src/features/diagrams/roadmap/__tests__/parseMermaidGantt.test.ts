/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for Mermaid gantt → structured roadmap parse.
 */

import { describe, expect, it } from 'vitest';
import {
	formatGanttDuration,
	formatGanttWhen,
	isMermaidGanttSource,
	parseMermaidGantt,
} from '../parseMermaidGantt';

const SAMPLE = `gantt
    title Дорожная карта внедрения
    dateFormat YYYY-MM-DD
    section Исследование
    Аудит и архитектура :a1, 2026-09-15, 45d
    section MVP
    Разработка ядра и UI :a2, after a1, 60d
    section Пилот
    Пилотная эксплуатация :a3, after a2, 60d
`;

describe('parseMermaidGantt', () => {
	it('detects gantt sources', () => {
		expect(isMermaidGanttSource(SAMPLE)).toBe(true);
		expect(isMermaidGanttSource('flowchart LR\nA-->B')).toBe(false);
	});

	it('parses Kursorina roadmap gantt shape', () => {
		const parsed = parseMermaidGantt(SAMPLE);
		expect(parsed).not.toBeNull();
		expect(parsed?.title).toBe('Дорожная карта внедрения');
		expect(parsed?.tasks).toHaveLength(3);
		expect(parsed?.tasks[0]).toMatchObject({
			section: 'Исследование',
			name: 'Аудит и архитектура',
			id: 'a1',
			when: '2026-09-15',
			duration: '45d',
		});
		expect(parsed?.tasks[1].when).toBe('after a1');
	});

	it('formats duration and when for RU chrome', () => {
		expect(formatGanttDuration('45d')).toBe('45 дн.');
		expect(formatGanttWhen('after a1')).toBe('после предыдущего этапа');
		expect(formatGanttWhen('2026-09-15')).toBe('15.09.2026');
	});
});
