/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Chat thread scroll stickiness, fade edges, and scroll-to-bottom for Assistant.
 *
 * Invariants:
 * - Auto-scroll runs only when stickToBottomRef is true.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantChatThreadPanel.tsx
 * - pages/Desktop/components/AssistantApp.tsx
 */
import * as React from 'react';

export function useAssistantChatScroll() {
	const bottomRef = React.useRef<HTMLDivElement | null>(null);
	const chatScrollRef = React.useRef<HTMLDivElement | null>(null);
	const stickToBottomRef = React.useRef(true);
	const [nearBottom, setNearBottom] = React.useState(true);
	const [chatScrollFade, setChatScrollFade] = React.useState({
		top: false,
		bottom: false,
	});

	const updateStickToBottom = React.useCallback(() => {
		const el = chatScrollRef.current;
		if (!el) return;
		const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
		const isNear = gap < 120;
		stickToBottomRef.current = isNear;
		setNearBottom(isNear);
		setChatScrollFade({
			top: el.scrollTop > 12,
			bottom: gap > 12,
		});
	}, []);

	const scrollChatToBottom = React.useCallback(() => {
		stickToBottomRef.current = true;
		setNearBottom(true);
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	return {
		bottomRef,
		chatScrollRef,
		stickToBottomRef,
		nearBottom,
		setNearBottom,
		chatScrollFade,
		updateStickToBottom,
		scrollChatToBottom,
	};
}

export type UseAssistantChatAutoScrollInput = {
	bottomRef: React.RefObject<HTMLDivElement | null>;
	stickToBottomRef: React.MutableRefObject<boolean>;
	updateStickToBottom: () => void;
	sending: boolean;
	streamingRaw: string;
	displayMessagesLength: number;
	streamingMarkdownLength: number;
	pendingUserText: string | null;
};

export function useAssistantChatAutoScroll({
	bottomRef,
	stickToBottomRef,
	updateStickToBottom,
	sending,
	streamingRaw,
	displayMessagesLength,
	streamingMarkdownLength,
	pendingUserText,
}: UseAssistantChatAutoScrollInput): void {
	const chatScrollKey = `${displayMessagesLength}:${streamingMarkdownLength}:${pendingUserText ?? ''}:${sending}`;
	React.useEffect(() => {
		void chatScrollKey;
		updateStickToBottom();
		if (!stickToBottomRef.current) return;
		bottomRef.current?.scrollIntoView({
			behavior: sending || streamingRaw ? 'auto' : 'smooth',
		});
	}, [
		chatScrollKey,
		sending,
		streamingRaw,
		updateStickToBottom,
		bottomRef,
		stickToBottomRef,
	]);
}
