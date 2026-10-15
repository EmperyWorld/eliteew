/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse Socket.IO `presence_superseded` payloads for desktop realtime recovery.
 *
 * Invariants:
 * - `single_browser_realtime` means lease busy (often stale sid), not permanent tab loss.
 *
 * Related:
 * - services/communication/EmperyworldSocketService.ts
 * - pages/Desktop/context/GAFChatProvider.tsx
 */

export function presenceSupersededReason(data: unknown): string {
	if (
		data &&
		typeof data === 'object' &&
		data !== null &&
		typeof (data as { reason?: unknown }).reason === 'string'
	) {
		return String((data as { reason: string }).reason).trim();
	}
	return '';
}

export function shouldRetrySocketAfterPresenceSuperseded(
	data: unknown
): boolean {
	return presenceSupersededReason(data) === 'single_browser_realtime';
}
