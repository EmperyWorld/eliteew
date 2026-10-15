/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock thread column width: near-full messages pane, no 42rem/60rem squeeze.
 *
 * Related:
 * - layout/desktopAiChatLayoutTokens.ts
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */

import { describe, expect, it } from 'vitest';
import { DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS } from '../layout/desktopAiChatLayoutTokens';

describe('DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS', () => {
	it('uses calc gutters instead of hard 42rem/60rem caps', () => {
		expect(DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS).toContain('calc(100%-');
		expect(DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS).toContain(
			'lg:max-w-[min(100%,calc(100%-8rem))]'
		);
		expect(DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS).not.toContain('42rem');
		expect(DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS).not.toContain('60rem');
	});
});
