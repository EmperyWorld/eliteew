/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UI tests for blueprint artifact header actions (save to project).
 *
 * Invariants:
 * - Save affordance lives in artifact header only, not duplicated in bubble toolbar.
 *
 * Related:
 * - src/features/desktop-ai-chat/DesktopAiBlueprintArtifactBubble.tsx
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopAiMessage } from '../api/desktopChatClient';
import {
	BlueprintQualityChip,
	DesktopAiBlueprintArtifactBubble,
} from '../DesktopAiBlueprintArtifactBubble';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

beforeEach(() => {
	const main = document.createElement('div');
	main.id = 'desktop-main';
	main.setAttribute('data-desktop-styled-tooltips', 'false');
	document.body.appendChild(main);
});

afterEach(() => {
	document.getElementById('desktop-main')?.remove();
});

vi.mock('../DesktopAiCollapsibleAssistantMarkdown', () => ({
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
			data-testid="blueprint-markdown"
			data-expanded={expanded}
			data-presentation={presentation}
		>
			{markdown.split('\n').map((line) => {
				const match = /^##\s+(.+?)\s*$/.exec(line);
				if (!match) return null;
				const title = match[1];
				const id = title.toLowerCase().replace(/\s+/g, '-');
				return (
					<h2 key={title} id={id}>
						{title}
					</h2>
				);
			})}
		</div>
	),
}));

const blueprintMessage = (): DesktopAiMessage => ({
	id: 'msg-blueprint-1',
	role: 'assistant',
	content: '## Marketing brief\n\nBody',
	created_at: '2026-06-17T00:00:00Z',
	metadata: {
		desktop_ensemble_blueprint: true,
		plan_template_id: 'marketing_brief_v1',
		plan_template_title: 'Marketing brief',
		quality_status: { status: 'grounded', label: 'Grounded' },
	},
});

describe('DesktopAiBlueprintArtifactBubble UI', () => {
	it('shows header save button when showSaveToProject is true', () => {
		render(
			<DesktopAiBlueprintArtifactBubble
				message={blueprintMessage()}
				markdown="## Marketing brief"
				maxCollapsedPx={400}
				showSaveToProject
				onSaveToProject={vi.fn()}
			/>
		);

		expect(
			screen.getByRole('button', { name: 'saveBlueprintToProjectAria' })
		).toBeTruthy();
		expect(screen.getByText('saveBlueprintToProjectShort')).toBeTruthy();
		expect(screen.getByTestId('blueprint-markdown').dataset.presentation).toBe(
			'document'
		);
	});

	it('hides header save button when showSaveToProject is false', () => {
		render(
			<DesktopAiBlueprintArtifactBubble
				message={blueprintMessage()}
				markdown="## Marketing brief"
				maxCollapsedPx={400}
			/>
		);

		expect(
			screen.queryByRole('button', { name: 'saveBlueprintToProjectAria' })
		).toBeNull();
	});

	it('calls onSaveToProject when header save is clicked', () => {
		const onSave = vi.fn();
		render(
			<DesktopAiBlueprintArtifactBubble
				message={blueprintMessage()}
				markdown="## Marketing brief"
				maxCollapsedPx={400}
				showSaveToProject
				onSaveToProject={onSave}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'saveBlueprintToProjectAria' })
		);
		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it('disables header save while busy', () => {
		render(
			<DesktopAiBlueprintArtifactBubble
				message={blueprintMessage()}
				markdown="## Marketing brief"
				maxCollapsedPx={400}
				showSaveToProject
				saveToProjectBusy
				onSaveToProject={vi.fn()}
			/>
		);

		expect(
			screen.getByRole('button', { name: 'saveBlueprintToProjectAria' })
		).toBeDisabled();
	});

	it('shows hypothesis-only callout and chip tooltip', () => {
		render(
			<DesktopAiBlueprintArtifactBubble
				message={{
					...blueprintMessage(),
					metadata: {
						...blueprintMessage().metadata,
						quality_status: {
							status: 'hypothesis_only',
							label: 'Hypothesis',
						},
					},
				}}
				markdown="## Marketing brief"
				maxCollapsedPx={400}
			/>
		);

		expect(screen.getByRole('note')).toBeTruthy();
		expect(screen.getByText('blueprintHypothesisCallout')).toBeTruthy();
		expect(screen.getByTitle('blueprintQualityHypothesisTooltip')).toBeTruthy();
	});

	it('opens checks tab by default for hypothesis_only with required context', () => {
		render(
			<DesktopAiBlueprintArtifactBubble
				message={{
					...blueprintMessage(),
					metadata: {
						...blueprintMessage().metadata,
						quality_status: {
							status: 'hypothesis_only',
							label: 'Hypothesis',
							required_context: ['Audience profile'],
						},
					},
				}}
				markdown="## Marketing brief"
				maxCollapsedPx={400}
			/>
		);

		expect(screen.getByText('blueprintChecksTitle')).toBeTruthy();
		expect(screen.queryByTestId('blueprint-markdown')).toBeNull();
	});

	it('renders export button and calls onExportMarkdown', () => {
		const onExport = vi.fn();
		render(
			<DesktopAiBlueprintArtifactBubble
				message={blueprintMessage()}
				markdown="## Marketing brief"
				maxCollapsedPx={400}
				onExportMarkdown={onExport}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'blueprintExportMdAria' })
		);
		expect(onExport).toHaveBeenCalledTimes(1);
	});

	it('expands document and scrolls when TOC entry is clicked', async () => {
		const scrollIntoView = vi.fn();
		HTMLElement.prototype.scrollIntoView = scrollIntoView;

		render(
			<DesktopAiBlueprintArtifactBubble
				message={blueprintMessage()}
				markdown={'## Intro\n\nBody\n\n## Next steps'}
				maxCollapsedPx={400}
			/>
		);

		const introToc = screen.getAllByText('Intro')[0];
		expect(introToc).toBeTruthy();
		fireEvent.click(introToc);

		expect(screen.getByTestId('blueprint-markdown').dataset.expanded).toBe(
			'true'
		);
		await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
	});

	it('shows web and project materials together in the dedicated evidence tab', () => {
		render(
			<DesktopAiBlueprintArtifactBubble
				message={{
					...blueprintMessage(),
					metadata: {
						...blueprintMessage().metadata,
						context_sources: [
							{
								citation_id: 'P1',
								kind: 'project_document',
								authority: 'project_material',
								title: 'Project research',
							},
						],
					},
				}}
				markdown="## Marketing brief"
				maxCollapsedPx={400}
				sources={[{ url: 'https://example.com/evidence', title: 'Evidence' }]}
			/>
		);

		expect(screen.queryByRole('link', { name: /Evidence/ })).toBeNull();
		fireEvent.click(
			screen.getByRole('button', { name: 'blueprintTabEvidence' })
		);
		expect(screen.getByText('【P1】')).toBeTruthy();
		expect(screen.getByText('Project research')).toBeTruthy();
		expect(screen.getByRole('link', { name: /Evidence/ })).toBeTruthy();
		expect(screen.getAllByTestId('desktop-ai-evidence-ledger')).toHaveLength(1);
	});

	it('lazy-unmounts inactive tab bodies (desktop-ai-chat-002)', () => {
		render(
			<DesktopAiBlueprintArtifactBubble
				message={blueprintMessage()}
				markdown="## Marketing brief\n\nBody"
				maxCollapsedPx={400}
				sources={[{ url: 'https://example.com/evidence', title: 'Evidence' }]}
			/>
		);

		expect(screen.getByTestId('blueprint-markdown')).toBeTruthy();
		expect(screen.queryByText('blueprintNoPlan')).toBeNull();
		expect(screen.queryByTestId('desktop-ai-evidence-ledger')).toBeNull();
		expect(screen.queryByText('blueprintChecksTitle')).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'blueprintTabPlan' }));
		expect(screen.queryByTestId('blueprint-markdown')).toBeNull();
		expect(screen.getByText('blueprintNoPlan')).toBeTruthy();
		expect(screen.queryByTestId('desktop-ai-evidence-ledger')).toBeNull();
		expect(screen.queryByText('blueprintChecksTitle')).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'blueprintTabChecks' }));
		expect(screen.getByText('blueprintChecksTitle')).toBeTruthy();
		expect(screen.queryByTestId('blueprint-markdown')).toBeNull();
		expect(screen.queryByTestId('desktop-ai-evidence-ledger')).toBeNull();
		expect(screen.queryByText('blueprintNoPlan')).toBeNull();
	});
});

describe('DesktopAiBlueprintArtifactBubble interview CTA', () => {
	const interviewMarkdown = `## Тема интервью

Стратегический вектор EliteEW.

## Цель интервью

Синхронизировать видение основателя.
`;

	it('shows Take interview when the card has topic/goal headings', () => {
		const onStart = vi.fn();
		render(
			<DesktopAiBlueprintArtifactBubble
				message={{
					...blueprintMessage(),
					content: interviewMarkdown,
					metadata: {
						...blueprintMessage().metadata,
						plan_template_id: 'research_plan_v1',
					},
				}}
				markdown={interviewMarkdown}
				maxCollapsedPx={400}
				onStartInterview={onStart}
			/>
		);
		expect(
			screen.getByRole('button', { name: 'interviewTakeAria' })
		).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'interviewTakeAria' }));
		expect(onStart).toHaveBeenCalledTimes(1);
	});

	it('hides Take interview on a marketing brief without interview headings', () => {
		render(
			<DesktopAiBlueprintArtifactBubble
				message={blueprintMessage()}
				markdown="## Marketing brief\n\nBody"
				maxCollapsedPx={400}
				onStartInterview={vi.fn()}
			/>
		);
		expect(
			screen.queryByRole('button', { name: 'interviewTakeAria' })
		).toBeNull();
	});

	it('hides Take interview for a local streaming message id', () => {
		render(
			<DesktopAiBlueprintArtifactBubble
				message={{
					...blueprintMessage(),
					id: 'local-stream-1',
					content: interviewMarkdown,
				}}
				markdown={interviewMarkdown}
				maxCollapsedPx={400}
				onStartInterview={vi.fn()}
			/>
		);
		expect(
			screen.queryByRole('button', { name: 'interviewTakeAria' })
		).toBeNull();
	});
});

describe('BlueprintQualityChip', () => {
	it('renders hypothesis tooltip on warn status', () => {
		render(
			<BlueprintQualityChip status="hypothesis_only" label="Hypothesis" />
		);
		expect(screen.getByTitle('blueprintQualityHypothesisTooltip')).toBeTruthy();
	});
});
