/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Discussion setup sheet + chat-switch confirm overlay; chat-scoped nav guard hook.
 *
 * Invariants:
 * - Sheet only when open for the active chat; switch confirm closes then navigates.
 * - requestSetActiveId wraps React setState so every chat switch path is gated.
 * - Switch confirm mounts via DesktopPortaledConfirmShell (Shell portal; no body createPortal).
 *
 * Related:
 * - discussionChatNavGuard.ts
 * - DesktopAiChatAppView.tsx
 * - pages/Desktop/shell/shellPortal.tsx
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopPortaledConfirmShell,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import { DiscussionSetupSheet } from './DiscussionSetupSheet';
import { shouldBlockChatSwitchForDiscussionSetup } from './discussionChatNavGuard';
import type {
	DiscussionIntensity,
	DiscussionPreset,
	DiscussionSession,
} from './types';

const CONFIRM_PANEL =
	'rounded-2xl border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_92%,rgb(6,7,12)_8%)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]';

function DiscussionSetupSwitchConfirm({
	open,
	onClose,
	onConfirm,
}: {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
}) {
	const { t } = useTranslation('desktopAiChat');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	if (!open || typeof document === 'undefined') return null;

	return (
		<DesktopPortaledConfirmShell
			onDismiss={onClose}
			zIndex={embeddedModalZ.content + 20}
			dismissAriaLabel={t('discussionSetupSwitchChatCancel')}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="discussion-setup-switch-title"
				data-discussion-setup-switch-confirm="1"
				className={cn(
					'relative w-full max-w-md p-5 outline-none',
					CONFIRM_PANEL
				)}
			>
				<h2
					id="discussion-setup-switch-title"
					className="text-sm font-semibold text-(--desktop-text-primary) antialiased"
				>
					{t('discussionSetupSwitchChatTitle')}
				</h2>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.body,
						'mt-2 text-(--desktop-text-secondary) antialiased'
					)}
				>
					{t('discussionSetupSwitchChatBody')}
				</p>
				<div className="mt-4 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className={cn(
							'rounded-md border border-(--desktop-border-subtle) px-3 py-2 text-sm text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)',
							DESKTOP_INTERACTIVE.btnRounded,
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
					>
						{t('discussionSetupSwitchChatCancel')}
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className={cn(
							'rounded-md bg-[rgb(var(--desktop-accent-rgb))] px-4 py-2 text-sm font-medium text-white',
							DESKTOP_INTERACTIVE.btnRounded,
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
					>
						{t('discussionSetupSwitchChatConfirm')}
					</button>
				</div>
			</div>
		</DesktopPortaledConfirmShell>
	);
}

export function DiscussionSetupHost({
	openForActiveChat,
	onClose,
	presets,
	rosterOptions,
	busy,
	displayNameHint,
	initialRoleTitle,
	errorMessage,
	onStart,
	switchConfirmOpen,
	onSwitchConfirmClose,
	onSwitchConfirm,
}: {
	openForActiveChat: boolean;
	onClose: () => void;
	presets: DiscussionPreset[];
	rosterOptions: string[];
	busy: boolean;
	displayNameHint?: string;
	initialRoleTitle?: string;
	errorMessage?: string | null;
	onStart: (input: {
		preset_id: string;
		topic: string;
		goal: string;
		roster: string[];
		intensity: DiscussionIntensity;
		role_title: string;
	}) => Promise<DiscussionSession | null | undefined>;
	switchConfirmOpen: boolean;
	onSwitchConfirmClose: () => void;
	onSwitchConfirm: () => void;
}) {
	return (
		<>
			<DiscussionSetupSheet
				open={openForActiveChat}
				onClose={onClose}
				presets={presets}
				rosterOptions={rosterOptions}
				busy={busy}
				displayNameHint={displayNameHint}
				initialRoleTitle={initialRoleTitle}
				errorMessage={errorMessage}
				onStart={onStart}
			/>
			<DiscussionSetupSwitchConfirm
				open={switchConfirmOpen}
				onClose={onSwitchConfirmClose}
				onConfirm={onSwitchConfirm}
			/>
		</>
	);
}

export function useDiscussionSetupChatNav({
	activeId,
	setActiveId,
}: {
	activeId: string | null;
	setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
	const [discussionSetupOpen, setDiscussionSetupOpen] = React.useState(false);
	const [discussionSetupChatId, setDiscussionSetupChatId] = React.useState<
		string | null
	>(null);
	const [discussionSwitchConfirmOpen, setDiscussionSwitchConfirmOpen] =
		React.useState(false);
	const [pendingDiscussionSwitchChatId, setPendingDiscussionSwitchChatId] =
		React.useState<string | null>(null);

	const setupOpenRef = React.useRef(false);
	const setupChatIdRef = React.useRef<string | null>(null);
	const switchConfirmOpenRef = React.useRef(false);
	setupOpenRef.current = discussionSetupOpen;
	setupChatIdRef.current = discussionSetupChatId;
	switchConfirmOpenRef.current = discussionSwitchConfirmOpen;

	const closeDiscussionSetup = React.useCallback(() => {
		setDiscussionSetupOpen(false);
		setDiscussionSetupChatId(null);
		setDiscussionSwitchConfirmOpen(false);
		setPendingDiscussionSwitchChatId(null);
	}, []);

	const openDiscussionSetup = React.useCallback(() => {
		if (!activeId) return;
		setDiscussionSetupChatId(activeId);
		setDiscussionSetupOpen(true);
	}, [activeId]);

	const requestSetActiveId = React.useCallback<
		React.Dispatch<React.SetStateAction<string | null>>
	>(
		(update) => {
			setActiveId((prev) => {
				const next = typeof update === 'function' ? update(prev) : update;
				if (next == null || next === prev) return next;

				if (switchConfirmOpenRef.current) {
					setPendingDiscussionSwitchChatId(next);
					return prev;
				}

				if (
					shouldBlockChatSwitchForDiscussionSetup({
						discussionSetupOpen: setupOpenRef.current,
						discussionSetupChatId: setupChatIdRef.current,
						targetChatId: next,
					})
				) {
					setPendingDiscussionSwitchChatId(next);
					setDiscussionSwitchConfirmOpen(true);
					return prev;
				}
				return next;
			});
		},
		[setActiveId]
	);

	const confirmDiscussionSwitchChat = React.useCallback(() => {
		const nextId = pendingDiscussionSwitchChatId;
		closeDiscussionSetup();
		if (nextId) setActiveId(nextId);
	}, [closeDiscussionSetup, pendingDiscussionSwitchChatId, setActiveId]);

	const openForActiveChat =
		discussionSetupOpen &&
		Boolean(discussionSetupChatId) &&
		discussionSetupChatId === activeId;

	const onSwitchConfirmClose = React.useCallback(() => {
		setDiscussionSwitchConfirmOpen(false);
		setPendingDiscussionSwitchChatId(null);
	}, []);

	return {
		closeDiscussionSetup,
		openDiscussionSetup,
		requestSetActiveId,
		confirmDiscussionSwitchChat,
		openForActiveChat,
		discussionSwitchConfirmOpen,
		onSwitchConfirmClose,
		discussionSetupOpen,
	};
}
