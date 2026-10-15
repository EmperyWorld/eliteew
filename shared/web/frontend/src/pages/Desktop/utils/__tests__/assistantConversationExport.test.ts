/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest для downloadAssistantConversationMarkdown.
 *
 * Related:
 * - pages/Desktop/utils/assistantConversationExport.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantChatMessage } from '../../services/productDesktopApi';
import { downloadAssistantConversationMarkdown } from '../assistantConversationExport';

const sample: AssistantChatMessage[] = [
	{
		id: '1',
		role: 'user',
		content: 'Q',
		created_at: '2026-05-27T12:00:00.000Z',
	},
];

describe('downloadAssistantConversationMarkdown', () => {
	beforeEach(() => {
		URL.createObjectURL = vi.fn(() => 'blob:mock');
		URL.revokeObjectURL = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns false for empty messages', () => {
		expect(downloadAssistantConversationMarkdown([])).toBe(false);
	});

	it('creates anchor and triggers download', () => {
		const click = vi.fn();
		const remove = vi.fn();
		const anchor = {
			href: '',
			download: '',
			rel: '',
			click,
			remove,
		} as unknown as HTMLAnchorElement;
		const create = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
		const append = vi
			.spyOn(document.body, 'appendChild')
			.mockImplementation(() => anchor);

		expect(downloadAssistantConversationMarkdown(sample)).toBe(true);
		expect(create).toHaveBeenCalledWith('a');
		expect(append).toHaveBeenCalledWith(anchor);
		expect(click).toHaveBeenCalled();
		expect(remove).toHaveBeenCalled();
		expect(anchor.download).toMatch(/^spravochnik-chat-\d{4}-\d{2}-\d{2}\.md$/);
	});
});
