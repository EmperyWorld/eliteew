/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks for Kursorina report Markdown: jammed ATX; MermaidFenceBlock routing
 * (gantt → RoadmapTimeline, flowchart → ProcessFlow via mock that mirrors
 * the shared fence contract).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { normalizeCompanionChatMarkdown } from '@/features/ewa/companionChatMarkdownNormalize';
import { KursorinaReportMarkdown } from '../KursorinaReportMarkdown';

vi.mock(
	'@/features/desktop-ai-chat/DesktopAiChatMarkdown.mermaid',
	async () => {
		const roadmap = await import('@/features/diagrams/roadmap');
		const processFlow = await import('@/features/diagrams/process-flow');
		const sequenceFlow = await import('@/features/diagrams/sequence-flow');
		return {
			inferMermaidDiagramSource: (raw: string) =>
				/^\s*mermaid\s*\n/i.test(raw) ||
				/^\s*gantt\b/im.test(raw) ||
				/^\s*flowchart\b/im.test(raw) ||
				/^\s*sequenceDiagram\b/im.test(raw)
					? raw.replace(/^\s*mermaid\s*\n/i, '').trim() || raw
					: null,
			MermaidFenceBlock: ({
				source,
				presentation,
			}: {
				source: string;
				presentation?: string;
			}) => {
				if (roadmap.isMermaidGanttSource(source)) {
					const parsed = roadmap.parseMermaidGantt(source);
					if (parsed) {
						return <roadmap.RoadmapTimeline data={parsed} />;
					}
				}
				if (processFlow.isMermaidFlowchartSource(source)) {
					const parsed = processFlow.parseMermaidFlowchart(source);
					if (parsed) {
						return <processFlow.ProcessFlow data={parsed} />;
					}
				}
				if (sequenceFlow.isMermaidSequenceSource(source)) {
					const parsed = sequenceFlow.parseMermaidSequence(source);
					if (parsed) {
						return <sequenceFlow.SequenceFlow data={parsed} />;
					}
				}
				return (
					<div
						data-testid="mermaid-fence"
						data-presentation={presentation ?? 'chat'}
					>
						{source.slice(0, 40)}
					</div>
				);
			},
		};
	}
);

describe('Kursorina report markdown visual', () => {
	it('splits jammed ATX so ### is not left mid-paragraph', () => {
		const raw = 'Введение к рынку ### Ключевые игроки и дальше текст';
		const normalized = normalizeCompanionChatMarkdown(raw);
		expect(normalized).toContain('\n\n### Ключевые игроки');
		expect(normalized.startsWith('###')).toBe(false);
	});

	it('renders ATX headings as real heading elements without ### text', () => {
		render(
			<KursorinaReportMarkdown
				content={'## Рынок\n\nАбзац про рынок.\n\n### Игроки\n\nСписок.'}
			/>
		);
		const h2 = screen.getByRole('heading', { level: 2, name: 'Рынок' });
		const h3 = screen.getByRole('heading', { level: 3, name: 'Игроки' });
		expect(h2).toBeTruthy();
		expect(h3).toBeTruthy();
		expect(screen.queryByText(/###/)).toBeNull();
		expect(screen.queryByText(/##/)).toBeNull();
	});

	it('routes flowchart mermaid to process flow, not Mermaid SVG', () => {
		render(
			<KursorinaReportMarkdown
				content={
					'```mermaid\nflowchart TD\n  A[Тема] --> B[Сбор]\n  B --> C[Отчет]\n```'
				}
			/>
		);
		expect(screen.queryByTestId('mermaid-fence')).toBeNull();
		expect(screen.getByLabelText('Схема процесса')).toBeTruthy();
		expect(screen.getByText('Тема')).toBeTruthy();
		expect(screen.getByText('Сбор')).toBeTruthy();
		expect(screen.getByText('Отчет')).toBeTruthy();
	});

	it('renders SWOT table as editorial matrix panel', () => {
		render(
			<KursorinaReportMarkdown
				content={`### Стратегический SWOT-анализ: Demo

| Квадрант | Факторы и характеристики |
|---|---|
| **Strengths (Сильные стороны)** | • Alpha |
| **Weaknesses (Слабые стороны)** | • Beta |
| **Opportunities (Возможности)** | • Gamma |
| **Threats (Угрозы)** | • Delta |
`}
			/>
		);
		expect(screen.getByLabelText(/SWOT/i)).toBeTruthy();
		expect(screen.getByText('Alpha')).toBeTruthy();
		expect(screen.getByText('Сильные стороны')).toBeTruthy();
	});

	it('routes sequenceDiagram mermaid to sequence flow, not Mermaid SVG', () => {
		render(
			<KursorinaReportMarkdown
				content={
					'```mermaid\nsequenceDiagram\n  A->>B: ping\n  B-->>A: pong\n```'
				}
			/>
		);
		expect(screen.queryByTestId('mermaid-fence')).toBeNull();
		expect(screen.getByLabelText('Последовательность')).toBeTruthy();
		expect(screen.getByText('ping')).toBeTruthy();
		expect(screen.getByText('pong')).toBeTruthy();
	});

	it('routes gantt mermaid to roadmap timeline, not Mermaid SVG', () => {
		render(
			<KursorinaReportMarkdown
				content={
					'```mermaid\ngantt\n    title Roadmap\n    dateFormat YYYY-MM-DD\n    section A\n    Task one :a1, 2026-09-15, 45d\n```'
				}
			/>
		);
		expect(screen.queryByTestId('mermaid-fence')).toBeNull();
		expect(screen.getByLabelText('Roadmap')).toBeTruthy();
		expect(screen.getByText('Task one')).toBeTruthy();
		expect(screen.getByText('A')).toBeTruthy();
	});

	it('normalizes LaTeX math symbols and arrows to clean Unicode in report prose', () => {
		const raw =
			'Архитектурный переход: «Запрос $\\rightarrow$ Обработка $\\rightarrow$ Ответ» и порог (цель: $> 0.85$), формула $P \\times I$.';
		render(<KursorinaReportMarkdown content={raw} />);
		expect(screen.getByText(/«Запрос → Обработка → Ответ»/)).toBeTruthy();
		expect(screen.getByText(/цель: > 0.85/)).toBeTruthy();
		expect(screen.getByText(/формула P × I/)).toBeTruthy();
		expect(screen.queryByText(/\$\\rightarrow\$/)).toBeNull();
	});

	it('routes architecture flowchart with subgraphs to editorial ProcessFlow', () => {
		render(
			<KursorinaReportMarkdown
				content={`\`\`\`mermaid
flowchart TD
  User((Пользователь)) --> Interface[Tauri Desktop]
  subgraph Semantic_Core [Core Layer]
    Router{Semantic Router}
  end
\`\`\``}
			/>
		);
		expect(screen.queryByTestId('mermaid-fence')).toBeNull();
		expect(screen.getByLabelText('Схема процесса')).toBeTruthy();
		expect(screen.getByText('Пользователь')).toBeTruthy();
		expect(screen.getByText('Tauri Desktop')).toBeTruthy();
	});

	it('renders GFM table with two-dash separator without breaking into pipe paragraphs', () => {
		const md = `## Матрица брифа

| № | Домен | Вопрос |
|:--|:---|:---|
| 1 | Бизнес | Целевая модель? |
| 2 | Стек | Языки программирования? |
`;
		const { container } = render(<KursorinaReportMarkdown content={md} />);
		const table = container.querySelector('table');
		expect(table).not.toBeNull();
		const ths = container.querySelectorAll('th');
		expect(ths.length).toBe(3);
		expect(screen.getByText('Целевая модель?')).toBeTruthy();
	});
});
