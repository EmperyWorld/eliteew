/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for optimistic companion pending turn echo sync (U8.1 extract).
 *
 * Invariants:
 * - Pending turn clears only when persisted transcript tail matches the optimistic pair.
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionPendingTurn.ts
 */

import type { CompanionChatMessageRow } from '@/services/ewa/ewaCompanionChatApi';

export function pendingUserTurnLabel(
	text: string,
	hasImage: boolean,
	imageHint: string
): string {
	const trimmed = text.trim();
	if (hasImage && !trimmed) return imageHint;
	if (hasImage && trimmed) return `${trimmed}\n${imageHint}`;
	return trimmed;
}

export function shouldClearPendingTurnEcho(
	messages: CompanionChatMessageRow[],
	pendingTurn: CompanionChatMessageRow[] | null
): boolean {
	if (!pendingTurn || pendingTurn.length < 2) return false;
	if (messages.length < 2) return false;
	const tailUser = messages[messages.length - 2];
	const tailAssistant = messages[messages.length - 1];
	const [echoUser, echoAssistant] = pendingTurn;
	return (
		tailUser.role === echoUser.role &&
		tailUser.content === echoUser.content &&
		tailAssistant.role === echoAssistant.role &&
		tailAssistant.content === echoAssistant.content
	);
}

export function companionTranscriptDisplayMessages(
	latestVisibleReply: CompanionChatMessageRow[],
	pendingTurn: CompanionChatMessageRow[] | null
): CompanionChatMessageRow[] {
	if (pendingTurn?.length) {
		const assistant = [...pendingTurn]
			.reverse()
			.find((row) => row.role === 'assistant' && row.content.trim());
		return assistant ? [assistant] : [];
	}
	return latestVisibleReply;
}
