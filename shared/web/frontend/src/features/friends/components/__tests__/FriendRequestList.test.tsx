/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused tests for Social Hub friend request queue rows.
 *
 * Invariants:
 * - Request-card context must come from existing request rows, not extra API calls.
 * - Lifecycle actions stay delegated outside this presentation test.
 *
 * Related:
 * - ../FriendRequestList.tsx
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { FriendRequestList } from '../FriendRequestList';

describe('FriendRequestList', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows relative age context on incoming request rows', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-30T00:00:00.000Z'));

		render(
			<FriendRequestList
				title="Incoming"
				items={[
					{
						id: 'request-1',
						username: 'friend_one',
						full_name: 'Friend One',
						avatar_url: null,
						created_at: '2026-05-29T21:00:00.000Z',
					},
				]}
				actionsForItem={() => []}
				variant="incoming"
			/>
		);

		expect(
			screen.getByText(/получено.*3.*час|received.*3.*hours/i)
		).toBeVisible();
	});
});
