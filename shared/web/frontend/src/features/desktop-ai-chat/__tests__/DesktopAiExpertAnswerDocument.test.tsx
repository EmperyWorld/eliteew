/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify expert-document detection and the user-visible premium document boundary for Desktop AI Chat replies.
 *
 * Invariants:
 * - Contract metadata does not wrap short conversation.
 * - Navigation and export are observable user actions, not implementation-only assertions.
 *
 * Related:
 * - src/features/desktop-ai-chat/DesktopAiExpertAnswerDocument.tsx
 * - src/features/desktop-ai-chat/utils/desktopAiExpertDocument.ts
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DesktopAiExpertAnswerDocument } from '../DesktopAiExpertAnswerDocument';
import {
	analyzeDesktopAiExpertDocument,
	desktopAiAnswerArtifactFileStem,
	desktopAiDocumentScrollBehavior,
	DESKTOP_EXPERT_REPLY_CONTRACT_VERSION,
} from '../utils/desktopAiExpertDocument';

afterEach(() => {
	vi.unstubAllGlobals();
});

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number; title?: string }) => {
			if (options?.title !== undefined) return `${key}:${options.title}`;
			if (options?.count !== undefined) return `${key}:${options.count}`;
			return key;
		},
	}),
}));

vi.mock('../components/desktopAiChatIconTooltip', () => ({
	DesktopAiChatIconTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('../DesktopAiCollapsibleAssistantMarkdown', () => ({
	DESKTOP_AI_EXPERT_DOC_COLLAPSE_PX: 640,
	DesktopAiCollapsibleAssistantMarkdown: ({
		markdown,
		contentRef,
		expanded,
		presentation,
	}: {
		markdown: string;
		contentRef?: React.Ref<HTMLDivElement | null>;
		expanded?: boolean;
		presentation?: string;
	}) => (
		<div
			ref={contentRef}
			data-testid="expert-markdown"
			data-expanded={expanded}
			data-presentation={presentation}
		>
			{markdown.split('\n').map((line) => {
				const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
				if (!match) return null;
				const title = match[2];
				const id = title.toLowerCase().replace(/\s+/g, '-');
				return React.createElement(
					match[1].length === 3 ? 'h3' : 'h2',
					{ id, key: `${id}-${match[1].length}` },
					title
				);
			})}
		</div>
	),
}));

const structuredMarkdown = [
	'## Executive verdict',
	'The recommendation is evidence-based and immediately actionable.',
	'',
	'| Option | Impact |',
	'| --- | --- |',
	'| A | High |',
	'',
	'```ts',
	'## This is code, not navigation',
	'const ready = true;',
	'```',
	'',
	'```mermaid',
	'flowchart LR',
	'A --> B',
	'```',
	'',
	'## Next steps',
	'1. Validate.',
	'2. Execute.',
].join('\n');

describe('analyzeDesktopAiExpertDocument', () => {
	it('keeps short conversational replies as normal chat even with contract metadata', () => {
		const analysis = analyzeDesktopAiExpertDocument('Спасибо, всё понял.', {
			desktop_expert_reply_contract: DESKTOP_EXPERT_REPLY_CONTRACT_VERSION,
		});

		expect(analysis.contractApplied).toBe(true);
		expect(analysis.isDocument).toBe(false);
	});

	it('detects sections, tables, diagrams and code without indexing fenced headings', () => {
		const analysis = analyzeDesktopAiExpertDocument(
			`${structuredMarkdown}\n\n- [ ] Verify release evidence`,
			undefined,
			{ sourceCount: 2 }
		);

		expect(analysis.isDocument).toBe(true);
		expect(analysis.headings.map((heading) => heading.title)).toEqual([
			'Executive verdict',
			'Next steps',
		]);
		expect(analysis.tableCount).toBe(1);
		expect(analysis.diagramCount).toBe(1);
		expect(analysis.codeBlockCount).toBe(1);
		expect(analysis.checklistCount).toBe(1);
		expect(analysis.sourceCount).toBe(2);
		expect(analysis.artifactKind).toBe('comparison');
	});

	it.each([
		{
			name: 'decision memo',
			markdown:
				'## Verdict\nChoose the safer option.\n\n## Recommendation\nProceed in two controlled phases.',
			options: { sourceCount: 4 },
			kind: 'decision',
		},
		{
			name: 'action plan',
			markdown:
				'## Delivery plan\n- [ ] Confirm owner\n- [ ] Run smoke\n\n## Exit criteria\nAll checks pass.',
			options: {},
			kind: 'action_plan',
		},
		{
			name: 'technical implementation',
			markdown:
				'## API implementation\n```ts\nexport const ready = true;\n```\n\n## Integration\nWire the client.',
			options: {},
			kind: 'technical',
		},
		{
			name: 'grounded research',
			markdown:
				'## Findings\nThe evidence supports the conclusion.\n\n## Limits\nThe sample is narrow.',
			options: { sourceCount: 3 },
			kind: 'research',
		},
	] as const)(
		'classifies $name as a user-facing answer artifact',
		({ markdown, options, kind }) => {
			expect(
				analyzeDesktopAiExpertDocument(markdown, undefined, options)
					.artifactKind
			).toBe(kind);
		}
	);

	it('disables smooth document navigation when reduced motion is requested', () => {
		vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));

		expect(desktopAiDocumentScrollBehavior()).toBe('auto');
	});

	it('exports semantic artifact kinds as filesystem-safe stems', () => {
		expect(desktopAiAnswerArtifactFileStem('action_plan')).toBe('action-plan');
		expect(desktopAiAnswerArtifactFileStem('technical')).toBe('technical');
		expect(
			analyzeDesktopAiExpertDocument('## Analysis\nBody', undefined, {
				sourceCount: Number.NaN,
			}).sourceCount
		).toBe(0);
	});
});

describe('DesktopAiExpertAnswerDocument', () => {
	it('renders expert chrome, format badges and export action', () => {
		const onExport = vi.fn();
		const analysis = analyzeDesktopAiExpertDocument(
			structuredMarkdown,
			undefined,
			{ sourceCount: 1 }
		);

		render(
			<DesktopAiExpertAnswerDocument
				markdown={structuredMarkdown}
				analysis={analysis}
				sources={[
					{
						url: 'https://example.com/evidence',
						title: 'Evidence',
					},
					{
						url: 'javascript:alert(1)',
						title: 'Unsafe',
					},
				]}
				onExportMarkdown={onExport}
			/>
		);

		expect(
			screen.getByRole('article', { name: 'expertAnswerAria' })
		).toBeTruthy();
		expect(screen.getByText('expertAnswerKicker')).toBeTruthy();
		expect(screen.getByText('expertAnswerComparisonTitle')).toBeTruthy();
		expect(screen.getByText('expertAnswerSectionsBadge:2')).toBeTruthy();
		expect(screen.getByText('expertAnswerTablesBadge:1')).toBeTruthy();
		expect(screen.getByText('expertAnswerDiagramsBadge:1')).toBeTruthy();
		expect(screen.getByText('expertAnswerCodeBadge:1')).toBeTruthy();
		expect(screen.getByText('expertAnswerSourcesBadge:1')).toBeTruthy();
		expect(screen.getByTestId('desktop-ai-evidence-ledger')).toBeTruthy();
		expect(screen.getByRole('link', { name: /Evidence/ })).toBeTruthy();
		expect(screen.queryByRole('link', { name: /Unsafe/ })).toBeNull();
		expect(screen.getByTestId('expert-markdown').dataset.presentation).toBe(
			'document'
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'expertAnswerExportAria' })
		);
		expect(onExport).toHaveBeenCalledTimes(1);
	});

	it('expands the document and scrolls from its table of contents', async () => {
		const scrollIntoView = vi.fn();
		HTMLElement.prototype.scrollIntoView = scrollIntoView;
		const analysis = analyzeDesktopAiExpertDocument(structuredMarkdown);

		render(
			<DesktopAiExpertAnswerDocument
				markdown={structuredMarkdown}
				analysis={analysis}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'expertAnswerTocJump:Next steps',
			})
		);

		expect(screen.getByTestId('expert-markdown').dataset.expanded).toBe('true');
		await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
	});

	it('collapses long TOC by default and reveals chips after expand', async () => {
		const scrollIntoView = vi.fn();
		HTMLElement.prototype.scrollIntoView = scrollIntoView;
		const longDoc = [
			'## One',
			'Body.',
			'## Two',
			'Body.',
			'## Three',
			'Body.',
			'## Four',
			'Body.',
			'## Five',
			'Body.',
		].join('\n');
		const analysis = analyzeDesktopAiExpertDocument(longDoc);

		render(
			<DesktopAiExpertAnswerDocument markdown={longDoc} analysis={analysis} />
		);

		expect(screen.getByText('expertAnswerTocSummary:5')).toBeTruthy();
		const details = screen
			.getByTestId('desktop-ai-expert-toc')
			.querySelector('details');
		expect(details).toBeTruthy();
		expect(details?.open).toBe(false);

		fireEvent.click(screen.getByText('expertAnswerTocSummary:5'));
		expect(details?.open).toBe(true);
		const jump = screen.getByRole('button', {
			name: 'expertAnswerTocJump:Five',
		});
		fireEvent.click(jump);
		expect(screen.getByTestId('expert-markdown').dataset.expanded).toBe('true');
		await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
	});
});
