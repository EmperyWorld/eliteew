/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentation tests for extracted GAF Chat message list row chrome.
 *
 * Invariants:
 * - Video-call system rows and standard bubble rows render from props without layout drift.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/components/GafChatMessageListRow.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GafChatMessageListRow } from '../GafChatMessageListRow';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: { defaultValue?: string }) =>
			opts?.defaultValue ?? key,
	}),
}));

vi.mock('@/components/profile/SecureAvatar', () => ({
	SecureAvatar: () => <div data-testid="secure-avatar" />,
}));

vi.mock('../GAFChatAvatar', () => ({
	GAFChatAvatar: () => <div data-testid="partner-avatar" />,
}));

const footer = {
	clock: '12:34',
	absoluteTitle: '1 Jan 2026, 12:34',
};

const baseProps = {
	messageId: 'msg-1',
	isMine: false,
	isReadByPartner: false,
	partner: {
		id: 'user-2',
		username: 'alice',
		avatar_url: null,
		full_name: 'Alice',
		is_muted: false,
		is_blocked: false,
		blocked_by_partner: false,
	},
	footer,
	bubbleOutgoingClass: 'bubble-out',
	bubbleIncomingClass: 'bubble-in',
	lucideStroke: 1.5,
	t: ((key: string) => key) as never,
	videoCallEvent: null,
	legacyPostCallLabel: null,
	showVideoCallRow: false,
	onMessageRowContextMenuCapture: vi.fn(),
	onBubblePointerDown: vi.fn(),
	clearLongPressTimer: vi.fn(),
	replyButton: null,
	copyButton: null,
	overflowMenu: null,
	bubbleBody: <span>Hello thread</span>,
};

describe('GafChatMessageListRow', () => {
	it('renders bubble body for a standard incoming row', () => {
		render(<GafChatMessageListRow {...baseProps} />);

		expect(screen.getByText('Hello thread')).toBeInTheDocument();
		expect(screen.getByTestId('partner-avatar')).toBeInTheDocument();
	});

	it('renders centered video-call system row when showVideoCallRow is true', () => {
		render(
			<GafChatMessageListRow
				{...baseProps}
				showVideoCallRow
				videoCallEvent={{
					event: 'ended',
					durationSeconds: 125,
					missedReason: null,
				}}
			/>
		);

		expect(screen.getByText('videoCallEvent.ended')).toBeInTheDocument();
		expect(screen.queryByText('Hello thread')).not.toBeInTheDocument();
	});
});
