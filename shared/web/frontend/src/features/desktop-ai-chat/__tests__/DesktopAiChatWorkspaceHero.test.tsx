/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract test for Desktop AI Chat workspace hero premium surface.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopAiChatWorkspaceHero contract', () => {
	it('uses desktop layout tokens and accepts primary action slot', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const heroSrc = readFileSync(
			join(dir, '../layout/DesktopAiChatWorkspaceHero.tsx'),
			'utf8'
		);
		const tokensSrc = readFileSync(
			join(dir, '../layout/desktopAiChatLayoutTokens.ts'),
			'utf8'
		);

		expect(tokensSrc).toContain('DESKTOP_AI_CHAT_WORKSPACE_HERO_CLASS');
		expect(tokensSrc).toContain('--desktop-accent-rgb');
		expect(heroSrc).toContain('DESKTOP_AI_CHAT_WORKSPACE_HERO_CLASS');
		expect(heroSrc).toContain('primaryAction');
		expect(heroSrc).toContain('text-(--desktop-text-primary)');
	});
});
