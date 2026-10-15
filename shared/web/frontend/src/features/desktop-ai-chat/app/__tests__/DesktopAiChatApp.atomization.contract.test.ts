/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — DesktopAiChatApp stable path stays a thin facade;
 * implementation children under app/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤50 LOC; re-exports named DesktopAiChatApp and default.
 * - Each app/ child ≤800 LOC.
 * - lazyImports still references features/desktop-ai-chat/DesktopAiChatApp path.
 *
 * Related:
 * - ../../DesktopAiChatApp.tsx (stable path)
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DesktopAiChatApp } from '@/features/desktop-ai-chat/DesktopAiChatApp';
import DesktopAiChatAppDefault from '@/features/desktop-ai-chat/DesktopAiChatApp';

describe('DesktopAiChatApp atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const moduleDir = join(testDir, '..');
	const featureDir = join(moduleDir, '..');
	const facadePath = join(featureDir, 'DesktopAiChatApp.tsx');

	it('re-exports named and default component from the stable facade path', () => {
		expect(typeof DesktopAiChatApp).toBe('function');
		expect(typeof DesktopAiChatAppDefault).toBe('function');
		expect(DesktopAiChatAppDefault).toBe(DesktopAiChatApp);
	});

	it('facade stays ≤50 LOC and only re-exports app implementation', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(50);
		expect(src).toContain("from './app/DesktopAiChatApp'");
		expect(src).toContain('DesktopAiChatApp');
		expect(src).toContain('DesktopAiChatAppProps');
		expect(src).toContain('default');
		expect(src).not.toMatch(/export const\s+DesktopAiChatApp\s*:/);
		expect(src).not.toMatch(/useDesktopAiChatAppCompose\s*\(/);
		expect(src).not.toMatch(/useDesktopAiChatStream\s*\(/);
	});

	it('preserves desktop lazy import path', () => {
		const lazyPath = join(
			featureDir,
			'../../pages/Desktop/components/desktopWindowAppContent/lazyImports.ts'
		);
		const lazySrc = readFileSync(lazyPath, 'utf8');
		expect(lazySrc).toContain(
			"import('../../../../features/desktop-ai-chat/DesktopAiChatApp')"
		);
		expect(lazySrc).toContain('default: m.DesktopAiChatApp');
	});

	it('inner compose delegates to useDesktopAiChatAppCompose and view', () => {
		const innerPath = join(moduleDir, 'DesktopAiChatApp.tsx');
		const src = readFileSync(innerPath, 'utf8');
		expect(src).toContain("from './useDesktopAiChatAppCompose'");
		expect(src).toContain('useDesktopAiChatAppCompose(');
		expect(src).toContain('<DesktopAiChatAppView');
		expect(src).not.toMatch(/useDesktopAiChatStream\s*\(/);
	});

	it('useDesktopAiChatAppCompose wires existing hooks and handlers', () => {
		const composeSrc = readFileSync(
			join(moduleDir, 'useDesktopAiChatAppCompose.ts'),
			'utf8'
		);
		const actionsSrc = readFileSync(
			join(moduleDir, 'useDesktopAiChatAppShellActions.ts'),
			'utf8'
		);
		expect(composeSrc).toContain('useDesktopAiChatList');
		expect(composeSrc).toContain('useDesktopAiChatStream');
		expect(composeSrc).toContain('useDesktopAiChatMessages');
		expect(composeSrc).toContain('useDesktopAiChatAppShellActions');
		expect(composeSrc).toContain('useDesktopAiChatAppPanelPrefs');
		expect(composeSrc).toContain('useDesktopAiChatAppChromeState');
		expect(composeSrc).toContain('useDesktopAiChatAppVoice');
		expect(actionsSrc).toContain('handleDeleteChat');
		expect(actionsSrc).toContain('deleteDesktopAiChat');
	});

	it('view hosts sidebar → messages → composer journey regions', () => {
		const src = readFileSync(
			join(moduleDir, 'DesktopAiChatAppView.tsx'),
			'utf8'
		);
		expect(src).toContain('<DesktopAiChatSidebar');
		expect(src).toContain('<DesktopAiChatMessagesPane');
		expect(src).toContain('<DesktopAiChatComposer');
		const sidebarIdx = src.indexOf('DesktopAiChatSidebar');
		const messagesIdx = src.indexOf('DesktopAiChatMessagesPane');
		const composerIdx = src.indexOf('DesktopAiChatComposer');
		expect(messagesIdx).toBeGreaterThan(sidebarIdx);
		expect(composerIdx).toBeGreaterThan(messagesIdx);
		expect(src).toContain('<DesktopAiChatAppDiscussionDock');
		expect(src).toContain('<DesktopAiChatAppOverlays');
		expect(src).not.toContain('closedDiscussionPanelKeys');
		expect(src).not.toContain('ConfirmDeleteModal');

		const overlaysSrc = readFileSync(
			join(moduleDir, 'DesktopAiChatAppOverlays.tsx'),
			'utf8'
		);
		expect(overlaysSrc).toContain('ConfirmDeleteModal');
		expect(overlaysSrc).toContain("t('deleteChatConfirmTitle')");

		const dockSrc = readFileSync(
			join(moduleDir, 'DesktopAiChatAppDiscussionDock.tsx'),
			'utf8'
		);
		expect(dockSrc).toContain('closedDiscussionPanelKeys');
		expect(dockSrc).toContain('discussion-panel-reopen');
	});

	it('app child modules exist and stay ≤800 LOC each; compose ≤722', () => {
		const loc = (src: string): number =>
			src.replace(/\n$/, '').split('\n').length;
		const expected = [
			'DesktopAiChatApp.tsx',
			'DesktopAiChatAppView.tsx',
			'DesktopAiChatAppOverlays.tsx',
			'DesktopAiChatAppDiscussionDock.tsx',
			'desktopAiChatAppPrefs.ts',
			'desktopAiChatAppTypes.ts',
			'useDesktopAiChatAppCompose.ts',
			'useDesktopAiChatAppShellActions.ts',
			'useDesktopAiChatAppPanelPrefs.ts',
			'useDesktopAiChatAppChromeState.ts',
			'useDesktopAiChatAppVoice.ts',
		];
		const names = new Set(
			readdirSync(moduleDir).filter((n) => /\.tsx?$/.test(n))
		);
		for (const mod of expected) {
			expect(names.has(mod), mod).toBe(true);
			const lines = loc(readFileSync(join(moduleDir, mod), 'utf8'));
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
		const composeLines = loc(
			readFileSync(join(moduleDir, 'useDesktopAiChatAppCompose.ts'), 'utf8')
		);
		expect(composeLines).toBeLessThanOrEqual(722);
	});
});
