/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract test for Desktop AI Chat keyboard journey landmarks (sidebar → thread → composer).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

const JOURNEY_LANDMARKS = [
	'data-ai-chat-guide="sidebar"',
	'data-ai-chat-guide="thread"',
	'data-ai-chat-guide="composer"',
];

describe('DesktopAiChatApp a11y journey landmarks', () => {
	it('orders primary journey regions via stable guide anchors', () => {
		const appSrc = readFileSync(
			join(dir, '../app/DesktopAiChatAppView.tsx'),
			'utf8'
		);
		const sidebarSrc = readFileSync(
			join(dir, '../components/DesktopAiChatSidebar.tsx'),
			'utf8'
		);
		const messagesSrc = readFileSync(
			join(dir, '../components/messagesPane/DesktopAiChatMessagesPaneView.tsx'),
			'utf8'
		);
		const composerSrc = readFileSync(
			join(dir, '../components/DesktopAiChatComposer.tsx'),
			'utf8'
		);

		expect(sidebarSrc).toContain(JOURNEY_LANDMARKS[0]);
		expect(messagesSrc).toContain(JOURNEY_LANDMARKS[1]);
		expect(composerSrc).toContain(JOURNEY_LANDMARKS[2]);

		const sidebarIdx = appSrc.indexOf('DesktopAiChatSidebar');
		const messagesIdx = appSrc.indexOf('DesktopAiChatMessagesPane');
		const composerIdx = appSrc.indexOf('DesktopAiChatComposer');
		expect(sidebarIdx).toBeGreaterThan(-1);
		expect(messagesIdx).toBeGreaterThan(sidebarIdx);
		expect(composerIdx).toBeGreaterThan(messagesIdx);
	});

	it('exposes composer textarea id for focus management', () => {
		const domIdsSrc = readFileSync(
			join(dir, '../desktopAiChatDomIds.ts'),
			'utf8'
		);
		const hookSrc = readFileSync(
			join(dir, '../hooks/useDesktopAiChatMessages.ts'),
			'utf8'
		);
		expect(domIdsSrc).toContain('desktop-ai-chat-composer');
		expect(domIdsSrc).toContain('desktop-ai-chat-composer-textarea');
		expect(hookSrc).toContain('DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID');
	});
});
