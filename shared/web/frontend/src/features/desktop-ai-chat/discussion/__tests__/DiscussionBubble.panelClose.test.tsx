/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Discussion bubble panel-close control (UI dismiss ≠ process cancel).
 *
 * Invariants:
 * - discussion-panel-close must call onClosePanel without finish/cancel.
 *
 * Related:
 * - DiscussionBubble.tsx
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DiscussionBubble } from '../DiscussionBubble';
import type { DiscussionSession } from '../types';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'ru' },
	}),
}));

const session: DiscussionSession = {
	id: 'disc-1',
	chat_id: 'chat-1',
	owner_user_id: 'u1',
	preset_id: 'brainstorm',
	topic: 'Тема',
	goal: '',
	roster: ['h1', 'h2'],
	intensity: 'calm',
	status: 'paused_checkpoint',
	version: 1,
	total_ai_turns: 1,
	checkpoint_ai_turns: 1,
	segment_index: 0,
	pause_requested: false,
	document_markdown: null,
	document_stale: false,
	participant_display_name: 'User',
	participant_role_title: 'инкогнито',
	turns: [],
};

describe('DiscussionBubble panel close', () => {
	it('closes the panel via header control without finish/cancel', async () => {
		const user = userEvent.setup();
		const onClosePanel = vi.fn();
		const onFinish = vi.fn();
		const onCancel = vi.fn();
		render(
			<DiscussionBubble
				session={session}
				controls={{
					raiseHand: false,
					continue: true,
					finish: true,
					cancel: true,
					generateDocument: true,
					composerEnabled: false,
				}}
				busy={false}
				onClosePanel={onClosePanel}
				onRaiseHand={vi.fn()}
				onContinue={vi.fn()}
				onFinish={onFinish}
				onCancel={onCancel}
				onGenerateDocument={vi.fn()}
			/>
		);
		await user.click(screen.getByTestId('discussion-panel-close'));
		expect(onClosePanel).toHaveBeenCalledTimes(1);
		expect(onFinish).not.toHaveBeenCalled();
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('shows an honest delayed-status caption when live transport is degraded', () => {
		render(
			<DiscussionBubble
				session={{ ...session, status: 'running' }}
				controls={{
					raiseHand: true,
					continue: false,
					finish: true,
					cancel: true,
					generateDocument: false,
					composerEnabled: false,
				}}
				busy={false}
				liveDegraded
				onClosePanel={vi.fn()}
				onRaiseHand={vi.fn()}
				onContinue={vi.fn()}
				onFinish={vi.fn()}
				onCancel={vi.fn()}
				onGenerateDocument={vi.fn()}
			/>
		);
		expect(screen.getByTestId('discussion-live-degraded')).toHaveTextContent(
			'discussionLiveDegraded'
		);
	});
});
