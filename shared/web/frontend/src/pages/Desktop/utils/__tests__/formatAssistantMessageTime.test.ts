/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest для formatAssistantMessageTime.
 *
 * Related:
 * - pages/Desktop/utils/formatAssistantMessageTime.ts
 */
import { describe, expect, it } from 'vitest';
import { formatAssistantMessageTime } from '../formatAssistantMessageTime';

describe('formatAssistantMessageTime', () => {
	it('returns empty string for invalid iso', () => {
		expect(formatAssistantMessageTime('not-a-date', 'ru-RU')).toBe('');
	});

	it('shows time only for same calendar day', () => {
		const now = new Date(2026, 4, 27, 15, 30, 0);
		const iso = new Date(2026, 4, 27, 10, 15, 0).toISOString();
		const out = formatAssistantMessageTime(iso, 'ru-RU', now);
		expect(out.length).toBeGreaterThan(0);
		expect(out).not.toMatch(/2026/);
	});

	it('includes month for previous day', () => {
		const now = new Date(2026, 4, 27, 15, 30, 0);
		const iso = new Date(2026, 4, 26, 10, 15, 0).toISOString();
		const out = formatAssistantMessageTime(iso, 'ru-RU', now);
		expect(out.length).toBeGreaterThan(0);
	});
});
