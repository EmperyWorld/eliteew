/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion TTS plain-text sanitizer.
 *
 * Related:
 * - src/features/ewa/companionTtsPlainText.ts
 */
import { describe, expect, it } from 'vitest';
import { companionReplyToTtsPlainText } from '../companionTtsPlainText';

describe('companionTtsPlainText', () => {
	it('strips common markdown markers', () => {
		const out = companionReplyToTtsPlainText(
			'## Title\n**Bold** and [link](https://x.test) ok.'
		);
		expect(out).toBe('Title Bold and link ok.');
	});

	it('returns empty for whitespace-only input', () => {
		expect(companionReplyToTtsPlainText('   \n')).toBe('');
	});

	it('includes all sentences up to char cap', () => {
		const out = companionReplyToTtsPlainText(
			'Первое предложение. Второе предложение. Третье предложение тоже должно попасть в озвучку.'
		);
		expect(out).toBe(
			'Первое предложение. Второе предложение. Третье предложение тоже должно попасть в озвучку.'
		);
	});
});
