/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Basic state matrix contract for Desktop AI Chat surfaces (list/thread/feature off).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopAiChatApp states contract', () => {
	it('covers feature disabled, list error, messages error, and empty thread states', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const appSrc = readFileSync(
			join(dir, '../app/DesktopAiChatAppView.tsx'),
			'utf8'
		);
		const sidebarSrc = readFileSync(
			join(dir, '../components/DesktopAiChatSidebar.tsx'),
			'utf8'
		);
		const paneSrc = readFileSync(
			join(dir, '../components/messagesPane/DesktopAiChatThreadStates.tsx'),
			'utf8'
		);
		const statePanelSrc = readFileSync(
			join(dir, '../layout/DesktopAiChatStatePanel.tsx'),
			'utf8'
		);

		expect(appSrc).toContain("t('featureDisabledPanel.title')");
		expect(appSrc).toContain('DesktopProductStatusBanner');
		expect(appSrc).toContain('listLoadState');
		expect(appSrc).toContain('messagesLoadState');
		expect(sidebarSrc).toContain('DesktopAiChatStatePanel');
		expect(sidebarSrc).toContain("t('sidebarEmptyTitle')");
		expect(sidebarSrc).toContain("t('workspaceHero.primaryCta')");
		expect(paneSrc).toContain('DesktopAiChatStatePanel');
		expect(paneSrc).toContain('DesktopAiChatWorkspaceHero');
		expect(paneSrc).toContain('DesktopProductNextAction');
		expect(paneSrc).toContain("t('messagesLoadErrorInline')");
		expect(paneSrc).toContain('messagesEmptySoloLead');
		expect(paneSrc).toContain('workspaceHero.pickChat.title');
		expect(paneSrc).toContain('onFocusComposer');
		expect(statePanelSrc).toContain('statePanel.');
	});
});
