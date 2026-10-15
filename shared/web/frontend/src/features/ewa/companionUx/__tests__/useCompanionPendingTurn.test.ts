/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionPendingTurn echo clearing (U8.1 extract).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCompanionPendingTurn } from '@/features/ewa/companionUx/useCompanionPendingTurn';
import type { CompanionChatMessageRow } from '@/services/ewa/ewaCompanionChatApi';

describe('useCompanionPendingTurn', () => {
	it('clears pending turn when transcript tail echoes optimistic pair', () => {
		const initialMessages: CompanionChatMessageRow[] = [
			{ role: 'user', content: 'older' },
			{ role: 'assistant', content: 'prev' },
		];
		const { result, rerender } = renderHook(
			({ messages }) => useCompanionPendingTurn(messages),
			{ initialProps: { messages: initialMessages } }
		);

		act(() => {
			result.current.setPendingTurn([
				{ role: 'user', content: 'hello' },
				{ role: 'assistant', content: 'world' },
			]);
		});
		expect(result.current.pendingTurn).toHaveLength(2);

		rerender({
			messages: [
				...initialMessages,
				{ role: 'user', content: 'hello' },
				{ role: 'assistant', content: 'world' },
			],
		});
		expect(result.current.pendingTurn).toBeNull();
	});
});
