/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest для sessionStorage persist локальных FAQ-пар Справочника.
 *
 * Invariants:
 * - Без network; sessionStorage only.
 *
 * Related:
 * - pages/Desktop/utils/assistantLocalFaqStorage.ts
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AssistantChatMessage } from '../../services/productDesktopApi';
import {
	formatAssistantConversationForCopy,
	readAssistantLocalFaqMessages,
	writeAssistantLocalFaqMessages,
} from '../assistantLocalFaqStorage';

const samplePair: AssistantChatMessage[] = [
	{
		id: 'faq-local-u-1',
		role: 'user',
		content: 'Как открыть магазин?',
		created_at: '2026-05-27T12:00:00.000Z',
	},
	{
		id: 'faq-local-a-1',
		role: 'assistant',
		content: 'Через меню «Пуск».',
		created_at: '2026-05-27T12:00:00.000Z',
	},
];

describe('assistantLocalFaqStorage', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	afterEach(() => {
		sessionStorage.clear();
	});

	it('round-trips valid FAQ messages via sessionStorage', () => {
		writeAssistantLocalFaqMessages(samplePair);
		expect(readAssistantLocalFaqMessages()).toEqual(samplePair);
	});

	it('clears storage when writing empty array', () => {
		writeAssistantLocalFaqMessages(samplePair);
		writeAssistantLocalFaqMessages([]);
		expect(sessionStorage.getItem('eliteew.assistant.localFaq.v1')).toBeNull();
		expect(readAssistantLocalFaqMessages()).toEqual([]);
	});

	it('filters malformed entries on read', () => {
		sessionStorage.setItem(
			'eliteew.assistant.localFaq.v1',
			JSON.stringify([
				samplePair[0],
				{ id: 'bad', role: 'system', content: 'x', created_at: 't' },
				'not-an-object',
			])
		);
		expect(readAssistantLocalFaqMessages()).toEqual([samplePair[0]]);
	});

	it('formats conversation for clipboard', () => {
		const text = formatAssistantConversationForCopy(samplePair);
		expect(text).toContain('Вы:\nКак открыть магазин?');
		expect(text).toContain('Ассистент:\nЧерез меню «Пуск».');
		expect(text).toContain('---');
	});
});
