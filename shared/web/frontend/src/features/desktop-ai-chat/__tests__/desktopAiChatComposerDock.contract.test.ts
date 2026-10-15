/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock composer dock + separate textarea focus id (no duplicate DOM ids).
 * Lock attach via native `<label htmlFor>` + visually-hidden (`sr-only`) file input
 * (not `display:none`, not JS `.click()`).
 *
 * Related:
 * - desktopAiChatDomIds.ts, components/DesktopAiChatComposer.tsx
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

describe('Desktop AI Chat composer dock / focus ids', () => {
	it('keeps dock id and separate textarea id for focus', () => {
		const domIds = readFileSync(join(dir, '../desktopAiChatDomIds.ts'), 'utf8');
		const shellActions = readFileSync(
			join(dir, '../app/useDesktopAiChatAppShellActions.ts'),
			'utf8'
		);
		const messages = readFileSync(
			join(dir, '../hooks/useDesktopAiChatMessages.ts'),
			'utf8'
		);
		const composer = readFileSync(
			join(dir, '../components/DesktopAiChatComposer.tsx'),
			'utf8'
		);
		const styles = readFileSync(
			join(dir, '../hooks/useDesktopAiChatShellStyles.ts'),
			'utf8'
		);

		expect(domIds).toContain('DESKTOP_AI_CHAT_COMPOSER_ID');
		expect(domIds).toContain('DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID');
		expect(domIds).toContain('desktop-ai-chat-composer-textarea');
		expect(shellActions).toContain('DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID');
		expect(messages).toContain('DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID');
		expect(composer).toContain('shellComposerDockClass');
		expect(styles).toContain('shellComposerDockClass');
		expect(styles).toContain('getDesktopShellToolbarClusterClassName');
	});

	it('opens attach via native label htmlFor on sr-only file input', () => {
		const composer = readFileSync(
			join(dir, '../components/DesktopAiChatComposer.tsx'),
			'utf8'
		);
		const domIds = readFileSync(join(dir, '../desktopAiChatDomIds.ts'), 'utf8');
		expect(domIds).toContain('DESKTOP_AI_CHAT_COMPOSER_ATTACH_INPUT_ID');
		expect(composer).toContain('DESKTOP_AI_CHAT_COMPOSER_ATTACH_INPUT_ID');
		expect(composer).toContain('htmlFor=');
		expect(composer).toMatch(/<label[\s\S]*?htmlFor=\{/);
		expect(composer).not.toMatch(/attachRef\.current\?\.click\(\)/);
		const attachInputBlock = composer.match(
			/<input[\s\S]*?type="file"[\s\S]*?onChange=\{onAttach\}[\s\S]*?\/>/
		)?.[0];
		expect(attachInputBlock).toBeTruthy();
		expect(attachInputBlock).toContain('className="sr-only"');
		expect(attachInputBlock).toContain('tabIndex={-1}');
		expect(attachInputBlock).not.toMatch(/className="hidden"/);
	});
});
