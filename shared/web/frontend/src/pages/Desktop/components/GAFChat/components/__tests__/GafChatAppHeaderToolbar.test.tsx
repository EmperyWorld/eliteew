/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentation tests for extracted GAF Chat app header toolbar.
 *
 * Invariants:
 * - Unread badge and connection status render from props without duplicating logic.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/components/GafChatAppHeaderToolbar.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GafChatAppHeaderToolbar } from '../GafChatAppHeaderToolbar';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'en' },
		t: (key: string) => key,
	}),
}));

vi.mock('@/features/friends/components/FriendAvatar', () => ({
	getFriendDisplayName: (
		username?: string | null,
		fullName?: string | null,
		fallback = '—'
	) => username?.trim() || fullName?.trim() || fallback,
	FriendAvatar: () => null,
}));

vi.mock('../../../DesktopAppChrome', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../../DesktopAppChrome')>();
	return {
		...actual,
		DESKTOP_APP_STYLE_CONTRACT: {
			...actual.DESKTOP_APP_STYLE_CONTRACT,
			counterBadge: 'counter-badge',
			sectionLabel: 'section-label',
		},
	};
});

vi.mock('../../../DesktopAppChrome', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../../DesktopAppChrome')>();
	return {
		...actual,
		DesktopAppButton: ({
			children,
			onClick,
			'aria-label': ariaLabel,
		}: {
			children: React.ReactNode;
			onClick?: () => void;
			'aria-label'?: string;
		}) => (
			<button type="button" onClick={onClick} aria-label={ariaLabel}>
				{children}
			</button>
		),
		DesktopAppToolbar: ({
			children,
			...rest
		}: {
			children: React.ReactNode;
		}) => <div {...rest}>{children}</div>,
	};
});

vi.mock('../../../DesktopChromeTooltip', () => ({
	DesktopChromeTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('../../GAFChatEncryptionIconButton', () => ({
	GAFChatEncryptionIconButton: () => <div data-testid="e2ee-btn" />,
}));

vi.mock('../../GAFChatChatActionsMenu', () => ({
	GAFChatChatActionsMenu: () => <div data-testid="chat-actions-menu" />,
}));

vi.mock('../GAFChatAvatar', () => ({
	GAFChatAvatar: () => <div data-testid="avatar" />,
}));

vi.mock('../../gafChatDesktopIconTooltip', () => ({
	GafChatDesktopIconTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('../../GafChatPartnerFriendStrip', () => ({
	GafChatPartnerFriendStrip: () => null,
}));

vi.mock('../GAFChatErrorBar', () => ({
	GAFChatErrorBar: ({ message }: { message: string }) => (
		<div role="alert">{message}</div>
	),
}));

const partner = {
	id: 'user-2',
	username: 'alice',
	avatar_url: null,
	full_name: 'Alice',
	is_muted: false,
	is_blocked: false,
	blocked_by_partner: false,
};

const baseProps = {
	shellAppToolbarClass: 'toolbar-class',
	unreadTotal: 3,
	socketConnected: true,
	onOpenNewChat: vi.fn(),
	partner,
	chatsError: false,
	chatsErrorCode: undefined,
	chatsErrorDismissed: false,
	onRefetchChats: vi.fn(),
	onDismissChatsError: vi.fn(),
	onCopyPartnerUsername: vi.fn(),
	selectedChatId: 'chat-1',
	partnerIsSystemAccount: false,
	e2eeStatus: undefined,
	myUserId: 'user-1',
	e2eeConsentBusy: false,
	onSetupE2eeKeys: vi.fn(),
	onStartVideoCall: vi.fn(),
	onStartGroupVideoCall: vi.fn(),
	startVideoCallPending: false,
	startGroupVideoCallPending: false,
	chatBlocked: false,
	soundEnabled: true,
	onToggleSound: vi.fn(),
	onClearHistory: vi.fn(),
	onArchiveChat: vi.fn(),
	onDeleteForEveryone: vi.fn(),
};

describe('GafChatAppHeaderToolbar', () => {
	it('renders title, unread badge, and online status', () => {
		render(<GafChatAppHeaderToolbar {...baseProps} />);

		expect(screen.getByText('appTitle')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText('serverOnlineShort')).toBeInTheDocument();
	});

	it('shows chats error bar when load failed and not dismissed', () => {
		render(
			<GafChatAppHeaderToolbar {...baseProps} chatsError chatsErrorCode={404} />
		);

		expect(screen.getByText('chatsLoadError404')).toBeInTheDocument();
	});

	it('calls onOpenNewChat from new chat button', () => {
		const onOpenNewChat = vi.fn();
		render(
			<GafChatAppHeaderToolbar {...baseProps} onOpenNewChat={onOpenNewChat} />
		);

		fireEvent.click(screen.getByText('newChat'));
		expect(onOpenNewChat).toHaveBeenCalledTimes(1);
	});
});
