/**
 * Message list with day dividers and spacing rules for ensemble (multi-speaker).
 */
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { DesktopAiMessage } from './api/desktopChatClient';
import { isDesktopDiscussionAnchorMessage } from './discussion/discussionAnchors';

function startOfDayKey(iso: string | null): string | null {
	if (!iso) {
		return null;
	}
	try {
		return format(new Date(iso), 'yyyy-MM-dd', { locale: ru });
	} catch {
		return null;
	}
}

/** Identity for spacing: consecutive assistant bubbles from different heroes must not compact. */
export function assistantSpeakerIdentityKey(msg: DesktopAiMessage): string {
	if (msg.role !== 'assistant') {
		return '';
	}
	const hid = msg.metadata?.desktop_hero_id;
	if (typeof hid === 'string' && hid.trim()) {
		return `h:${hid.trim()}`;
	}
	return 'h:';
}

function shouldCompactAssistantPair(
	prev: DesktopAiMessage,
	curr: DesktopAiMessage
): boolean {
	if (prev.role !== 'assistant' || curr.role !== 'assistant') {
		return false;
	}
	return (
		assistantSpeakerIdentityKey(prev) === assistantSpeakerIdentityKey(curr)
	);
}

export type MessageListEntry =
	| { kind: 'day'; label: string; key: string }
	| { kind: 'msg'; msg: DesktopAiMessage; compactTop: boolean };

export function buildMessageListWithDays(
	messages: DesktopAiMessage[],
	formatDayLabel: (iso: string | null) => string
): MessageListEntry[] {
	const out: MessageListEntry[] = [];
	let prevKey: string | null = null;
	let prevMsg: DesktopAiMessage | null = null;
	for (const m of messages) {
		// Empty Discussion anchors are UI stubs; real Process UI is DiscussionBubble.
		if (isDesktopDiscussionAnchorMessage(m)) {
			continue;
		}
		const dk = startOfDayKey(m.created_at);
		if (dk && dk !== prevKey) {
			out.push({
				kind: 'day',
				label: formatDayLabel(m.created_at),
				key: `day-${dk}`,
			});
			prevKey = dk;
			prevMsg = null;
		} else if (dk) {
			prevKey = dk;
		}
		const compactTop =
			prevMsg !== null &&
			prevMsg.role === m.role &&
			(m.role !== 'assistant' || shouldCompactAssistantPair(prevMsg, m));
		out.push({ kind: 'msg', msg: m, compactTop });
		prevMsg = m;
	}
	return out;
}
