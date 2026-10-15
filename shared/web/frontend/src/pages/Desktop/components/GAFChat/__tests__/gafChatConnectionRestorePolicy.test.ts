/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: first socket connect must not force GAF chats refetch after shell-bootstrap seed.
 *
 * Related:
 * - gafChatConnectionRestorePolicy.ts
 */

import { describe, expect, it } from 'vitest';
import { shouldRefetchGafChatsOnConnectionRestored } from '../gafChatConnectionRestorePolicy';

describe('shouldRefetchGafChatsOnConnectionRestored', () => {
	it('skips refetch on first connect (initial: true)', () => {
		expect(
			shouldRefetchGafChatsOnConnectionRestored({
				session_id: 's1',
				initial: true,
			})
		).toBe(false);
	});

	it('refetches after reconnect (initial: false)', () => {
		expect(
			shouldRefetchGafChatsOnConnectionRestored({
				session_id: 's1',
				initial: false,
			})
		).toBe(true);
	});

	it('refetches when payload has no initial flag (window online)', () => {
		expect(shouldRefetchGafChatsOnConnectionRestored(undefined)).toBe(true);
		expect(shouldRefetchGafChatsOnConnectionRestored(null)).toBe(true);
		expect(shouldRefetchGafChatsOnConnectionRestored({})).toBe(true);
	});
});
