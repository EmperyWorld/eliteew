/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Desktop AI Chat sidebar list premium chrome: sentence-case meta, quiet team cards.
 *
 * Related:
 * - layout/desktopAiChatLayoutTokens.ts
 * - components/DesktopAiChatSidebar.tsx
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DESKTOP_AI_CHAT_SIDEBAR_PENDING_LABEL_CLASS,
	DESKTOP_AI_CHAT_SIDEBAR_SHARED_CHIP_CLASS,
	DESKTOP_AI_CHAT_SIDEBAR_TEAM_CARD_IDLE_CLASS,
} from '../layout/desktopAiChatLayoutTokens';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

/** Drop comments so prose about the ban does not trip locks. */
function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Desktop AI Chat sidebar list premium chrome', () => {
	it('keeps pending + shared meta sentence-case (no uppercase shout)', () => {
		expect(DESKTOP_AI_CHAT_SIDEBAR_PENDING_LABEL_CLASS).not.toMatch(
			/\buppercase\b/
		);
		expect(DESKTOP_AI_CHAT_SIDEBAR_PENDING_LABEL_CLASS).toMatch(
			/tracking-normal/
		);
		expect(DESKTOP_AI_CHAT_SIDEBAR_SHARED_CHIP_CLASS).not.toMatch(
			/\buppercase\b/
		);
		expect(DESKTOP_AI_CHAT_SIDEBAR_SHARED_CHIP_CLASS).toMatch(
			/tracking-normal/
		);
	});

	it('keeps idle team cards quiet (no accent wash on every row)', () => {
		expect(DESKTOP_AI_CHAT_SIDEBAR_TEAM_CARD_IDLE_CLASS).toMatch(
			/border-subtle/
		);
		expect(DESKTOP_AI_CHAT_SIDEBAR_TEAM_CARD_IDLE_CLASS).not.toMatch(
			/accent-rgb\/0\.22/
		);
	});

	it('Sidebar wires tokens and drops uppercase class strings', () => {
		const src = stripComments(
			readSrc('../components/DesktopAiChatSidebar.tsx')
		);
		expect(src).toContain('DESKTOP_AI_CHAT_SIDEBAR_LIST_CLASS');
		expect(src).toContain('DESKTOP_AI_CHAT_SIDEBAR_TEAM_CARD_IDLE_CLASS');
		expect(src).toContain('DESKTOP_AI_CHAT_SIDEBAR_SHARED_CHIP_CLASS');
		expect(src).not.toMatch(/\buppercase\b/);
	});
});
