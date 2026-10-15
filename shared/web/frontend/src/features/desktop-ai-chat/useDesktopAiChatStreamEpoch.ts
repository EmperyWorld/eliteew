import * as React from 'react';

/**
 * Stream ownership for Desktop AI Chat: epoch bumps on chat switch / unmount;
 * callbacks compare (chatId, epoch) via `streamStale`.
 */
export function useDesktopAiChatStreamEpoch(activeId: string | null) {
	const streamEpochRef = React.useRef(0);
	const activeIdRef = React.useRef(activeId);
	activeIdRef.current = activeId;

	const streamStale = React.useCallback((chatId: string, epoch: number) => {
		return activeIdRef.current !== chatId || streamEpochRef.current !== epoch;
	}, []);

	return { streamEpochRef, activeIdRef, streamStale };
}
