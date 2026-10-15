/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Poll GET stream-lock while another participant holds the turn lock (409 / locked peek).
 *
 * Invariants:
 * - Poll interval ~2s; stops when unlocked or chat/sending context changes.
 *
 * Related:
 * - api/desktopChatClient.ts peekDesktopAiChatStreamLock
 */
import * as React from 'react';
import { peekDesktopAiChatStreamLock } from '../api/desktopChatClient';

const POLL_MS = 2000;

export type UseDesktopAiChatStreamLockPollParams = {
	chatId: string | null;
	currentUserId: string | null;
	sending: boolean;
	/** Set true after 409 turn_in_progress to start polling until unlock. */
	forcePoll: boolean;
};

export function useDesktopAiChatStreamLockPoll({
	chatId,
	currentUserId,
	sending,
	forcePoll,
}: UseDesktopAiChatStreamLockPollParams) {
	const [lockedByOther, setLockedByOther] = React.useState(false);
	const [pollActive, setPollActive] = React.useState(false);

	React.useEffect(() => {
		if (forcePoll) {
			setPollActive(true);
		}
	}, [forcePoll]);

	React.useEffect(() => {
		if (!chatId) {
			setLockedByOther(false);
			setPollActive(false);
			return;
		}
		if (sending) {
			setLockedByOther(false);
			return;
		}
		if (!pollActive && !forcePoll) {
			setLockedByOther(false);
			return;
		}

		let cancelled = false;
		const tick = async () => {
			try {
				const peek = await peekDesktopAiChatStreamLock(chatId);
				if (cancelled) return;
				const holder = (peek.holder_user_id ?? '').trim();
				const self = (currentUserId ?? '').trim();
				// Locked without a readable holder still blocks peers (avoid send→409 loops).
				const byOther = peek.locked && (!self || !holder || holder !== self);
				setLockedByOther(byOther);
				if (!peek.locked) {
					setPollActive(false);
				} else if (byOther) {
					setPollActive(true);
				}
			} catch {
				if (!cancelled) {
					setLockedByOther(false);
				}
			}
		};

		void tick();
		const id = window.setInterval(() => void tick(), POLL_MS);
		return () => {
			cancelled = true;
			window.clearInterval(id);
		};
	}, [chatId, currentUserId, sending, pollActive, forcePoll]);

	const armStreamLockPoll = React.useCallback(() => {
		setPollActive(true);
	}, []);

	return { lockedByOther, armStreamLockPoll };
}
