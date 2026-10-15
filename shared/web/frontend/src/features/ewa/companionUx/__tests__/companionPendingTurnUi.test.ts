/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion pending turn UI helpers (U8.1 extract).
 */

import { describe, expect, it } from 'vitest';

import {
	companionTranscriptDisplayMessages,
	pendingUserTurnLabel,
	shouldClearPendingTurnEcho,
} from '@/features/ewa/companionUx/companionPendingTurnUi';
import type { CompanionChatMessageRow } from '@/services/ewa/ewaCompanionChatApi';

describe('companionPendingTurnUi', () => {
	it('builds pending user label with image hint', () => {
		expect(pendingUserTurnLabel('hi', true, 'image attached')).toBe(
			'hi\nimage attached'
		);
	});

	it('detects echo match for clearing pending turn', () => {
		const pending: CompanionChatMessageRow[] = [
			{ role: 'user', content: 'hello' },
			{ role: 'assistant', content: 'world' },
		];
		const messages: CompanionChatMessageRow[] = [
			{ role: 'user', content: 'older' },
			{ role: 'assistant', content: 'reply' },
			{ role: 'user', content: 'hello' },
			{ role: 'assistant', content: 'world' },
		];
		expect(shouldClearPendingTurnEcho(messages, pending)).toBe(true);
	});

	it('shows assistant line from pending turn in transcript display', () => {
		const pending: CompanionChatMessageRow[] = [
			{ role: 'user', content: 'q' },
			{ role: 'assistant', content: 'answer' },
		];
		expect(
			companionTranscriptDisplayMessages(
				[{ role: 'assistant', content: 'old' }],
				pending
			)
		).toEqual([{ role: 'assistant', content: 'answer' }]);
	});
});
