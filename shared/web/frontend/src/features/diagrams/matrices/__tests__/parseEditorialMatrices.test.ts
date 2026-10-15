/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks for SWOT / risk GFM → editorial matrix parsers.
 */

import { describe, expect, it } from 'vitest';
import { splitKursorinaReportParts } from '../parseEditorialMatrices';

describe('splitKursorinaReportParts', () => {
	it('extracts SWOT table into editorial part', () => {
		const md = `## Стратегический SWOT-анализ: Demo

| Квадрант | Факторы и характеристики |
|---|---|
| **Strengths (Сильные стороны)** | • Быстрый цикл<br>• Локальный контур |
| **Weaknesses (Слабые стороны)** | • Узкий рынок |
| **Opportunities (Возможности)** | • Госзаказы |
| **Threats (Угрозы)** | • Крупные экосистемы |

Дальше текст.`;
		const parts = splitKursorinaReportParts(md);
		expect(parts.some((p) => p.type === 'swot')).toBe(true);
		const swot = parts.find((p) => p.type === 'swot');
		expect(swot?.type === 'swot' && swot.data.title).toContain('SWOT');
		expect(swot?.type === 'swot' && swot.data.quadrants.strengths).toEqual([
			'Быстрый цикл',
			'Локальный контур',
		]);
	});

	it('extracts risk table into ranked cards model', () => {
		const md = `### Матрица оценки рисков: Demo

| Категория | Риск | Вер. (1-5) | Вл. (1-5) | Индекс (P×I) | Уровень | Стратегия митигации |
|---|---|:---:|:---:|:---:|---|---|
| Регуляторный | Несоответствие 152-ФЗ | 3 | 5 | **15** | Высокий 🟠 | Аудит |

Итого.`;
		const parts = splitKursorinaReportParts(md);
		const risk = parts.find((p) => p.type === 'risk');
		expect(risk?.type).toBe('risk');
		if (risk?.type !== 'risk') return;
		expect(risk.data.rows).toHaveLength(1);
		expect(risk.data.rows[0]?.score).toBe(15);
		expect(risk.data.rows[0]?.level).toBe('high');
		expect(risk.data.rows[0]?.mitigation).toContain('Аудит');
	});

	it('leaves ordinary tables as markdown', () => {
		const md = `| A | B |
|---|---|
| 1 | 2 |`;
		const parts = splitKursorinaReportParts(md);
		expect(parts).toHaveLength(1);
		expect(parts[0]?.type).toBe('markdown');
	});
});
