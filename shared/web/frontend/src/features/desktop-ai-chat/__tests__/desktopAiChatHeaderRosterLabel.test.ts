/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock compact header roster label (truncate +N, no shouty dump).
 *
 * Related:
 * - utils/desktopAiChatHeaderRosterLabel.ts
 */
import { describe, expect, it } from 'vitest';
import {
	compactDesktopAiHeaderRosterLabel,
	DESKTOP_AI_HEADER_ROSTER_NAMES_MAX,
} from '../utils/desktopAiChatHeaderRosterLabel';

describe('compactDesktopAiHeaderRosterLabel', () => {
	it('joins up to maxVisible labels', () => {
		expect(
			compactDesktopAiHeaderRosterLabel({
				heroShortLabels: ['А', 'Б'],
			})
		).toBe('А · Б');
		expect(DESKTOP_AI_HEADER_ROSTER_NAMES_MAX).toBe(2);
	});

	it('truncates with +N when longer than max', () => {
		expect(
			compactDesktopAiHeaderRosterLabel({
				heroShortLabels: [
					'Виктор Львович',
					'Николас Алексеевич',
					'Диана Игоревна',
					'Артур Сергеевич',
				],
			})
		).toBe('Виктор Львович · Николас Алексеевич · +2');
	});

	it('parses fallback subtitle when heroes empty', () => {
		expect(
			compactDesktopAiHeaderRosterLabel({
				heroShortLabels: [],
				fallbackSubtitle: 'Ликий · Соренто · Макс',
			})
		).toBe('Ликий · Соренто · +1');
	});
});
