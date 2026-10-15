/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Device affinity for GAF video_call.accepted: only the client that started
 * the outgoing ring should open Meet (avoids desktop+mobile dual join).
 *
 * Invariants:
 * - Non-owning devices may clear ringing UI but must not open VideoCallApp.
 *
 * Related:
 * - GAFChatProvider.tsx, documentation/product/INTERNAL-VIDEO-CALLS.md
 */

/** True when this browser session owns the outgoing ring for callId. */
export function shouldOpenDesktopMeetOnVideoCallAccepted(
	localOutgoingCallIds: ReadonlySet<string>,
	callId: string
): boolean {
	const id = callId.trim();
	if (!id) return false;
	return localOutgoingCallIds.has(id);
}
