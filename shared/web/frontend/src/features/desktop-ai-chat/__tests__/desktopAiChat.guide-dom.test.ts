/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract test for Desktop AI Chat guided tour DOM anchors.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

const GUIDE_ANCHORS = [
	'data-ai-chat-guide="sidebar"',
	'data-ai-chat-guide="thread"',
	'data-ai-chat-guide="header-bar"',
	'data-ai-chat-guide="settings-panel"',
	'data-ai-chat-guide="composer"',
	'data-ai-chat-guide="voice-settings"',
];

const COMPONENT_PATHS = [
	'../components/DesktopAiChatSidebar.tsx',
	'../components/messagesPane/DesktopAiChatMessagesPaneView.tsx',
	'../components/DesktopAiChatMainHeader.tsx',
	'../components/DesktopAiChatSettingsRail.tsx',
	'../components/DesktopAiChatComposer.tsx',
];

describe('desktopAiChat guide DOM anchors', () => {
	it('maps tour steps to stable data-ai-chat-guide selectors', () => {
		const guideSrc = readFileSync(
			join(dir, '../DesktopAiChatGuideModal.tsx'),
			'utf8'
		);
		const stepsSrc = readFileSync(
			join(dir, '../guide/desktopAiChatGuideSteps.tsx'),
			'utf8'
		);
		expect(guideSrc).toContain('voiceEnabled');
		expect(guideSrc).toContain('tour.step.composer.bodyVoiceOff');
		expect(stepsSrc).toContain('data-ai-chat-guide');
		const stepAnchors = [
			'data-ai-chat-guide="sidebar"',
			'data-ai-chat-guide="thread"',
			'data-ai-chat-guide="header-bar"',
			'data-ai-chat-guide="settings-panel"',
			'data-ai-chat-guide="composer"',
		];
		for (const anchor of stepAnchors) {
			expect(stepsSrc).toContain(anchor);
		}
		for (const anchor of GUIDE_ANCHORS) {
			const matched = COMPONENT_PATHS.some((rel) =>
				readFileSync(join(dir, rel), 'utf8').includes(anchor)
			);
			expect(matched).toBe(true);
		}
	});

	it('renders guide anchors in layout components', () => {
		for (const rel of COMPONENT_PATHS) {
			const src = readFileSync(join(dir, rel), 'utf8');
			expect(src).toMatch(/data-ai-chat-guide=/);
		}
	});
});
