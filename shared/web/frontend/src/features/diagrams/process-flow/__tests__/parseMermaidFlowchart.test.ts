/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks for Mermaid flowchart → ProcessFlow parser (Kursorina heuristic + LLM).
 */

import { describe, expect, it } from 'vitest';
import {
	isMermaidFlowchartSource,
	parseMermaidFlowchart,
} from '../parseMermaidFlowchart';

describe('parseMermaidFlowchart', () => {
	it('detects flowchart/graph headers', () => {
		expect(isMermaidFlowchartSource('flowchart TD\nA-->B')).toBe(true);
		expect(isMermaidFlowchartSource('graph LR\nA-->B')).toBe(true);
		expect(isMermaidFlowchartSource('gantt\ntitle x')).toBe(false);
		expect(isMermaidFlowchartSource('sequenceDiagram\nA->>B: hi')).toBe(false);
	});

	it('parses Kursorina heuristic linear chain', () => {
		const src = `flowchart TD
  A[Тема] --> B[Сбор данных]
  B --> C[Анализ и синтез]
  C --> D[Результирующий отчет]`;
		const parsed = parseMermaidFlowchart(src);
		expect(parsed).not.toBeNull();
		expect(parsed?.direction).toBe('TD');
		expect(parsed?.steps.map((s) => s.label)).toEqual([
			'Тема',
			'Сбор данных',
			'Анализ и синтез',
			'Результирующий отчет',
		]);
		expect(parsed?.steps[1]?.from).toEqual(['A']);
	});

	it('keeps edge labels and branch parents', () => {
		const src = `flowchart LR
  A[Start] -->|ok| B[Path B]
  A -->|alt| C[Path C]
  B --> D[Join]
  C --> D`;
		const parsed = parseMermaidFlowchart(src);
		expect(parsed).not.toBeNull();
		const join = parsed?.steps.find((s) => s.id === 'D');
		expect([...(join?.from ?? [])].sort()).toEqual(['B', 'C']);
		const pathB = parsed?.steps.find((s) => s.id === 'B');
		expect(pathB?.via).toBe('ok');
	});

	it('returns null for empty flowchart', () => {
		expect(parseMermaidFlowchart('flowchart TD')).toBeNull();
	});

	it('ignores style/classDef noise', () => {
		const src = `flowchart TD
  classDef foo fill:#f00
  A[One] --> B[Two]
  style A fill:#0f0`;
		const parsed = parseMermaidFlowchart(src);
		expect(parsed?.steps.map((s) => s.label)).toEqual(['One', 'Two']);
	});

	it('parses flowcharts with subgraphs into ProcessFlow topological steps', () => {
		const src = `flowchart TD
    User((Пользователь)) -->|Input: Text/Voice| Interface[Tauri Desktop Shell]
    Interface -->|Raw Request| Router{Semantic Router}
    
    subgraph Semantic_Core [Semantic Core Layer]
        Router -->|Intent: Creative| CreativeDomain[Creative Agent: LangGraph]
        Router -->|Intent: Analytical| AnalyticalDomain[Analytical Agent: LangGraph]
        Router -->|Intent: Social| SocialDomain[Social Agent: LangGraph]
    end

    subgraph Memory_Layer [Hybrid Memory System]
        CreativeDomain <--> Qdrant[(Qdrant: Long-term Semantic Memory)]
        AnalyticalDomain <--> Qdrant
    end`;
		const parsed = parseMermaidFlowchart(src);
		expect(parsed).not.toBeNull();
		expect(parsed?.steps.length).toBeGreaterThanOrEqual(6);
		const labels = parsed?.steps.map((s) => s.label) ?? [];
		expect(labels).toContain('Пользователь');
		expect(labels).toContain('Tauri Desktop Shell');
		expect(labels).toContain('Qdrant: Long-term Semantic Memory');
	});
});
