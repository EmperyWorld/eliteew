/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Surface load-state types and helpers for Desktop AI Chat thread and list panes.
 *
 * Invariants:
 * - Error state is distinct from empty; empty only when loadState is ready and count is zero.
 *
 * Related:
 * - hooks/useDesktopAiChatMessages.ts, hooks/useDesktopAiChatList.ts
 * - layout/DesktopAiChatStatePanel.tsx
 */

export type DesktopAiChatLoadState = 'idle' | 'loading' | 'ready' | 'error';

export type DesktopAiChatThreadSurfaceState =
	| 'idle'
	| 'loading'
	| 'ready'
	| 'empty'
	| 'error';

export function resolveThreadSurfaceState(opts: {
	loadState: DesktopAiChatLoadState;
	messageCount: number;
	sending: boolean;
}): DesktopAiChatThreadSurfaceState {
	if (opts.loadState === 'idle') {
		return 'idle';
	}
	if (opts.loadState === 'loading' && !opts.sending) {
		return 'loading';
	}
	if (opts.loadState === 'error') {
		return 'error';
	}
	if (opts.messageCount === 0 && !opts.sending) {
		return 'empty';
	}
	return 'ready';
}

export type DesktopAiChatListSurfaceState =
	| 'loading'
	| 'ready'
	| 'empty'
	| 'error';

export function resolveListSurfaceState(opts: {
	loadState: DesktopAiChatLoadState;
	chatCount: number;
	filterActive: boolean;
}): DesktopAiChatListSurfaceState {
	if (opts.loadState === 'loading') {
		return 'loading';
	}
	if (opts.loadState === 'error') {
		return 'error';
	}
	if (opts.chatCount === 0) {
		return opts.filterActive ? 'ready' : 'empty';
	}
	return 'ready';
}
