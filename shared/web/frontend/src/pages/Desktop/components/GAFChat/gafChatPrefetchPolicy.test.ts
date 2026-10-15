/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for bounded GAF Chat message prefetch bookkeeping.
 *
 * Invariants:
 * - Duplicate hover prefetches are ignored.
 * - Old chat ids are evicted once the cap is exceeded.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/gafChatPrefetchPolicy.ts
 */
import { describe, expect, it } from 'vitest';
import { rememberGafMessagePrefetch } from './gafChatPrefetchPolicy';

describe('rememberGafMessagePrefetch', () => {
	it('ignores duplicate chat ids', () => {
		expect(rememberGafMessagePrefetch(['a', 'b'], 'b', 3)).toEqual({
			next: ['a', 'b'],
			evicted: [],
			shouldPrefetch: false,
		});
	});

	it('evicts oldest ids when the cap is exceeded', () => {
		expect(rememberGafMessagePrefetch(['a', 'b', 'c'], 'd', 3)).toEqual({
			next: ['b', 'c', 'd'],
			evicted: ['a'],
			shouldPrefetch: true,
		});
	});
});
