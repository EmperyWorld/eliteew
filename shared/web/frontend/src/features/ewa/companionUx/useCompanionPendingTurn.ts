/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Optimistic pending turn state for companion chat transcript (U8.1 extract).
 *
 * Invariants:
 * - Clears pending turn when server profile reload echoes the same user+assistant pair.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import { useEffect, useState } from 'react';

import { shouldClearPendingTurnEcho } from '@/features/ewa/companionUx/companionPendingTurnUi';
import type { CompanionChatMessageRow } from '@/services/ewa/ewaCompanionChatApi';

export function useCompanionPendingTurn(messages: CompanionChatMessageRow[]) {
	const [pendingTurn, setPendingTurn] = useState<
		CompanionChatMessageRow[] | null
	>(null);

	useEffect(() => {
		if (!shouldClearPendingTurnEcho(messages, pendingTurn)) return;
		setPendingTurn(null);
	}, [messages, pendingTurn]);

	return { pendingTurn, setPendingTurn };
}
