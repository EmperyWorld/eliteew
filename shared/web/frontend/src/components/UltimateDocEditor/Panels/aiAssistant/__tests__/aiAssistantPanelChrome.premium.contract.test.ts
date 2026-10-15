/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Ultimate Doc Editor AI Assistant panel chrome: desktop accent (no purple), no emoji quick actions.
 *
 * Related:
 * - aiAssistantPanelChrome.ts, AIAssistantHeader.tsx, useAIAssistantCompose.ts
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOC_EDITOR_AI_HEADER_ICON_CLASS } from '../aiAssistantPanelChrome';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Doc Editor AI Assistant panel premium chrome', () => {
	it('uses desktop accent mix for header icon (no purple wash)', () => {
		expect(DOC_EDITOR_AI_HEADER_ICON_CLASS).toMatch(/desktop-accent-rgb/);
		expect(DOC_EDITOR_AI_HEADER_ICON_CLASS).not.toMatch(/\bpurple-/);
	});

	it('wires chrome tokens and Heroicon quick actions (no emoji)', () => {
		const header = stripComments(readSrc('../AIAssistantHeader.tsx'));
		const compose = stripComments(readSrc('../useAIAssistantCompose.ts'));
		const toolbar = stripComments(readSrc('../AIAssistantToolbar.tsx'));
		const chat = stripComments(readSrc('../AIAssistantChatRegion.tsx'));

		expect(header).toContain('DOC_EDITOR_AI_HEADER_ICON_CLASS');
		expect(header).not.toMatch(/\bpurple-/);
		expect(toolbar).toContain('DOC_EDITOR_AI_QUICK_ACTION_CLASS');
		expect(chat).toContain('DOC_EDITOR_AI_EMPTY_ICON_CLASS');
		expect(chat).not.toMatch(/\bpurple-/);

		expect(compose).toContain('DocumentTextIcon');
		expect(compose).toContain('LanguageIcon');
		expect(compose).not.toMatch(/['"]📝['"]/);
		expect(compose).not.toMatch(/['"]✨['"]/);
		expect(compose).not.toMatch(/['"]✅['"]/);
		expect(compose).not.toMatch(/['"]🌐['"]/);
		expect(compose).not.toMatch(/['"]📖['"]/);
		expect(compose).not.toMatch(/['"]💡['"]/);

		const saved = stripComments(readSrc('../AIAssistantSavedPrompts.tsx'));
		expect(saved).not.toMatch(/\bpurple-/);
	});
});
