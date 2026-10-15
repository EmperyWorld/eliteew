/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Assistant shortcuts collapsed-by-default + quiet message-count chip.
 *
 * Related:
 * - useAssistantShortcutsPanel.ts, assistantHeaderStyles.ts
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ASSISTANT_HEADER_MESSAGE_COUNT_CLASS } from '../assistantHeaderStyles';
import { ASSISTANT_SHORTCUTS_PANEL_CLASS } from '../assistantChatPanelStyles';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Assistant shortcuts spoiler + header count chrome', () => {
	it('does not auto-open shortcuts on first desktop visit', () => {
		const src = stripComments(readSrc('../useAssistantShortcutsPanel.ts'));
		expect(src).not.toContain('ASSISTANT_SHORTCUTS_INTRO_STORAGE_KEY');
		expect(src).not.toMatch(/React\.useEffect/);
		expect(src).toContain('openShortcutsPanel');
	});

	it('keeps shortcuts panel chrome quiet when collapsed (no open ring shout)', () => {
		expect(ASSISTANT_SHORTCUTS_PANEL_CLASS).not.toMatch(/open:ring-1/);
		expect(ASSISTANT_SHORTCUTS_PANEL_CLASS).not.toMatch(/open:shadow-sm/);
	});

	it('message count chip stays sentence-case meta (no uppercase)', () => {
		expect(ASSISTANT_HEADER_MESSAGE_COUNT_CLASS).not.toMatch(/\buppercase\b/);
		expect(ASSISTANT_HEADER_MESSAGE_COUNT_CLASS).toMatch(/tracking-normal/);
		expect(ASSISTANT_HEADER_MESSAGE_COUNT_CLASS).toMatch(
			/shellMeta10|text-\[10px\]/
		);
	});
});
