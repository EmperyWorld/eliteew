/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FAQ open defaults for desktop vs mobile embedded (plan R14).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
	persistAssistantFaqOpen,
	readInitialAssistantFaqOpen,
} from '../readInitialAssistantFaqOpen';
import { ASSISTANT_FAQ_OPEN_STORAGE_KEY } from '../assistantChatConstants';

describe('readInitialAssistantFaqOpen', () => {
	afterEach(() => {
		sessionStorage.removeItem(ASSISTANT_FAQ_OPEN_STORAGE_KEY);
	});

	it('starts collapsed on mobile embedded layout', () => {
		expect(readInitialAssistantFaqOpen(true)).toBe(false);
	});

	it('restores session preference on desktop', () => {
		persistAssistantFaqOpen(false);
		expect(readInitialAssistantFaqOpen(false)).toBe(false);
		persistAssistantFaqOpen(true);
		expect(readInitialAssistantFaqOpen(false)).toBe(true);
	});

	it('defaults to open on desktop when no session value', () => {
		expect(readInitialAssistantFaqOpen(false)).toBe(true);
	});
});
