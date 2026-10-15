/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source-contract lock: Desktop AI Chat message columns stay horizontally centered.
 *
 * Related:
 * - ../components/messagesPane/DesktopAiChatMessageRow.tsx
 * - ../layout/desktopAiChatLayoutTokens.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('DesktopAiChatMessagesPane bubble column layout', () => {
	it('centers message columns via THREAD_COLUMN_CLASS (not side-pinned ml/mr-auto)', () => {
		const src = readFileSync(
			join(dir, '../components/messagesPane/DesktopAiChatMessageRow.tsx'),
			'utf8'
		);
		expect(src).toContain("'flex flex-col w-full min-w-0 gap-1'");
		expect(src).toContain('DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS');
		expect(src).not.toMatch(/\? 'mr-auto items-start'/);
		expect(src).not.toMatch(/: 'ml-auto items-end'/);
	});
});
