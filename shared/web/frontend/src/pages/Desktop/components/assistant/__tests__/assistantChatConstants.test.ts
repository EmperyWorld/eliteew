/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Assistant chat/composer shared constants.
 *
 * Invariants:
 * - Counter thresholds stay below message max length.
 *
 * Related:
 * - pages/Desktop/components/assistant/assistantChatConstants.ts
 */
import { describe, expect, it } from 'vitest';
import {
	ASSISTANT_CHAT_COUNTER_THRESHOLD,
	ASSISTANT_CHAT_COUNTER_WARN_CHARS,
	ASSISTANT_CHAT_MESSAGE_MAX_CHARS,
	ASSISTANT_CHAT_VISIBLE_COUNT,
	ASSISTANT_SHORTCUTS_PANEL_ITEMS,
} from '../assistantChatConstants';

describe('assistantChatConstants', () => {
	it('keeps counter thresholds ordered below message max length', () => {
		expect(ASSISTANT_CHAT_COUNTER_THRESHOLD).toBeLessThan(
			ASSISTANT_CHAT_COUNTER_WARN_CHARS
		);
		expect(ASSISTANT_CHAT_COUNTER_WARN_CHARS).toBeLessThan(
			ASSISTANT_CHAT_MESSAGE_MAX_CHARS
		);
	});

	it('exposes a positive visible history window', () => {
		expect(ASSISTANT_CHAT_VISIBLE_COUNT).toBeGreaterThan(0);
	});

	it('lists keyboard shortcut panel entries with stable ids', () => {
		const ids = ASSISTANT_SHORTCUTS_PANEL_ITEMS.map((item) => item.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain('send');
		expect(ids).toContain('focus');
	});
});
