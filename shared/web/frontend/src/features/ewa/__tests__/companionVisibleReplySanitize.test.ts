/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import { sanitizeCompanionVisibleReplyText } from '@/features/ewa/companionVisibleReplySanitize';

describe('sanitizeCompanionVisibleReplyText', () => {
	it('unwraps valid JSON envelope', () => {
		const raw = '{"visible_reply":"Привет!","memory":[]}';
		expect(sanitizeCompanionVisibleReplyText(raw)).toBe('Привет!');
	});

	it('unwraps broken JSON with inner quotes', () => {
		const raw =
			'{"visible_reply":"Иди, поиграй в "уровень" с кем-нибудь.","memory":[]}';
		expect(sanitizeCompanionVisibleReplyText(raw)).toBe(
			'Иди, поиграй в "уровень" с кем-нибудь.'
		);
	});

	it('passes through normal prose', () => {
		expect(sanitizeCompanionVisibleReplyText('Обычный ответ.')).toBe(
			'Обычный ответ.'
		);
	});

	it('strips Gemma 4 channel thought prefill leak', () => {
		const raw =
			'<|channel>thought\n<channel|>Да по-разному: то в потоке, то в раздумьях.';
		expect(sanitizeCompanionVisibleReplyText(raw)).toBe(
			'Да по-разному: то в потоке, то в раздумьях.'
		);
	});
});
