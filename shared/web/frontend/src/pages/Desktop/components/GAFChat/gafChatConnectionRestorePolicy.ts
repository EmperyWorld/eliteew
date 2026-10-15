/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Decide whether GAF chats cache must refetch after a socket `connection-restored`
 * event. First connect after cold `#desktop` must not wipe shell-bootstrap seed.
 *
 * Invariants:
 * - Payload `{ initial: true }` (EmperyworldSocketService first connect) → no chats refetch.
 * - Reconnect after drop (`initial: false`) or unknown payload → refetch.
 *
 * Related:
 * - services/communication/EmperyworldSocketService.ts (emits connection-restored)
 * - context/GAFChatProvider.tsx
 * - services/desktopShellBootstrap.ts
 */

/**
 * @returns true when callers should invalidate/refetch `gafChatQueryKeys.chats`.
 */
export function shouldRefetchGafChatsOnConnectionRestored(
	payload: unknown
): boolean {
	if (payload !== null && typeof payload === 'object' && 'initial' in payload) {
		return (payload as { initial?: unknown }).initial !== true;
	}
	// window `online` / legacy callers without `initial` — treat as real restore.
	return true;
}
