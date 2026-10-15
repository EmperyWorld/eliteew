/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave F2 lock — Process/Совещание tab renders council turns from metadata
 * and appears on blueprint chrome when transcript is present.
 *
 * Invariants:
 * - Reload path uses persisted metadata only (no ephemeral composer state).
 *
 * Related:
 * - DesktopAiCouncilProcessPanel.tsx
 * - DesktopAiBlueprintArtifactBubble.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DesktopAiMessage } from '../api/desktopChatClient';
import { DesktopAiBlueprintArtifactBubble } from '../DesktopAiBlueprintArtifactBubble';
import { DesktopAiCouncilProcessPanel } from '../components/DesktopAiCouncilProcessPanel';
import { DesktopAiCouncilTabsShell } from '../components/DesktopAiCouncilTabsShell';
import type { DesktopCouncilTranscript } from '../ensemble/types';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../DesktopAiCollapsibleAssistantMarkdown', () => ({
	DesktopAiCollapsibleAssistantMarkdown: ({
		markdown,
	}: {
		markdown: string;
	}) => <div data-testid="blueprint-markdown">{markdown}</div>,
}));

vi.mock('../desktopAiHeroes', () => ({
	getDesktopAiHero: (id?: string) =>
		id === 'tech'
			? { shortLabel: 'Tech', avatarPublicPath: '/avatars/tech.png' }
			: id
				? { shortLabel: id }
				: undefined,
	heroAvatarPublicPath: (id?: string | null) =>
		id === 'tech' ? '/avatars/tech.png' : null,
}));

vi.mock('../DesktopAiChatMarkdown', () => ({
	DesktopAiChatMarkdown: ({ markdown }: { markdown: string }) => (
		<div data-testid="council-turn-md">{markdown}</div>
	),
}));

const sampleTranscript = (): DesktopCouncilTranscript => ({
	version: 1,
	mode: 'joint_document',
	roster: ['tech', 'product'],
	turns: [
		{
			kind: 'orchestrator_brief',
			text: 'Open brief for the roster',
			at_ms: 1,
			label: 'Lead',
		},
		{
			kind: 'speaker_reply',
			text: 'Tech reply body about goals',
			at_ms: 2,
			hero_id: 'tech',
			index: 0,
		},
		{
			kind: 'closing',
			text: 'Quorum reached — assemble the document',
			at_ms: 3,
			label: 'Lead',
		},
	],
	closing: { decision: 'ok' },
});

describe('DesktopAiCouncilProcessPanel', () => {
	it('renders speaker and closing turns; hides orchestrator brief', () => {
		render(<DesktopAiCouncilProcessPanel transcript={sampleTranscript()} />);
		expect(screen.queryByText('Open brief for the roster')).toBeNull();
		expect(screen.getByText('Tech reply body about goals')).toBeTruthy();
		expect(
			screen.getByText('Quorum reached — assemble the document')
		).toBeTruthy();
		expect(screen.getByText('councilProcessTitle')).toBeTruthy();
		expect(screen.getByText('councilClosingOk')).toBeTruthy();
		expect(screen.getByLabelText('councilProcessAria')).toBeTruthy();
	});

	it('shows ephemeral thinking row while live speaker has no reply yet', () => {
		render(
			<DesktopAiCouncilProcessPanel
				transcript={{
					version: 1,
					mode: 'joint_document',
					roster: ['tech'],
					turns: [],
				}}
				live
				activeSpeakerId="tech"
			/>
		);
		expect(screen.getByText('councilSpeakerThinking')).toBeTruthy();
	});

	it('labels separate-delivery council as councilModeDiscussion, not product Discussion', () => {
		render(
			<DesktopAiCouncilProcessPanel
				transcript={{
					version: 1,
					mode: 'discussion',
					roster: ['tech'],
					turns: [],
				}}
			/>
		);
		expect(screen.getByText('councilProcessTitle')).toBeTruthy();
		expect(
			screen.getByText(
				(_content, node) =>
					node?.tagName === 'P' &&
					Boolean(node.textContent?.includes('councilModeDiscussion'))
			)
		).toBeTruthy();
		expect(screen.queryByText('discussionModeLabel')).toBeNull();
	});
});

describe('DesktopAiCouncilTabsShell', () => {
	it('flips Document ↔ Совещание and defaults to council while live', () => {
		render(
			<DesktopAiCouncilTabsShell
				transcript={sampleTranscript()}
				live
				documentPane={<div>DOC_BODY</div>}
			/>
		);
		expect(screen.queryByText('Open brief for the roster')).toBeNull();
		expect(screen.queryByText('DOC_BODY')).toBeNull();
		fireEvent.click(
			screen.getByRole('button', { name: 'blueprintTabDocument' })
		);
		expect(screen.getByText('DOC_BODY')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'councilTabProcess' }));
		expect(screen.getByText('Tech reply body about goals')).toBeTruthy();
	});
});

describe('DesktopAiBlueprintArtifactBubble council tab', () => {
	it('shows Совещание tab when metadata has council_transcript', () => {
		const message: DesktopAiMessage = {
			id: 'bp-1',
			role: 'assistant',
			content: '## Goals\n\nBody',
			created_at: '2026-08-06T00:00:00Z',
			metadata: {
				desktop_ensemble_blueprint: true,
				plan_template_id: 'audit_v1',
				plan_template_title: 'Audit',
				quality_status: { status: 'grounded' },
				council_transcript: sampleTranscript(),
			},
		};
		render(
			<DesktopAiBlueprintArtifactBubble
				message={message}
				markdown="## Goals\n\nBody"
				maxCollapsedPx={400}
			/>
		);
		const councilBtn = screen.getByRole('button', {
			name: 'councilTabProcess',
		});
		expect(councilBtn).toBeTruthy();
		fireEvent.click(councilBtn);
		expect(screen.queryByText('Open brief for the roster')).toBeNull();
		expect(screen.getByText('Tech reply body about goals')).toBeTruthy();
	});

	it('hides Совещание tab without council_transcript', () => {
		const message: DesktopAiMessage = {
			id: 'bp-2',
			role: 'assistant',
			content: '## Goals\n\nBody',
			created_at: '2026-08-06T00:00:00Z',
			metadata: {
				desktop_ensemble_blueprint: true,
				plan_template_id: 'audit_v1',
				plan_template_title: 'Audit',
				quality_status: { status: 'grounded' },
			},
		};
		render(
			<DesktopAiBlueprintArtifactBubble
				message={message}
				markdown="## Goals\n\nBody"
				maxCollapsedPx={400}
			/>
		);
		expect(
			screen.queryByRole('button', { name: 'councilTabProcess' })
		).toBeNull();
	});
});
