/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract: GAFChatProvider parent ≤800 LOC with stable named exports
 * and extracted process modules (Cause B Wave 4).
 *
 * Invariants:
 * - Parent GAFChatProvider.tsx ≤800 lines; GAFChatProvider + useGAFChatProcess exported from canonical path.
 * - Child modules each ≤800 lines.
 *
 * Related:
 * - context/GAFChatProvider.tsx
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const contextDir = join(dir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('GAFChatProvider atomization contract', () => {
	const parentPath = join(contextDir, 'GAFChatProvider.tsx');
	const childModules = [
		'gafChatProviderTypes.ts',
		'gafChatIncomingMute.ts',
		'gafChatIncomingNotifications.ts',
		'useGafDesktopVideoCallProcess.ts',
		'useDesktopSocketLeader.ts',
		'useGafChatSocketEventHandlers.ts',
	] as const;

	it('parent GAFChatProvider.tsx is ≤800 LOC with named exports', () => {
		const src = read(parentPath);
		expect(lineCount(parentPath)).toBeLessThanOrEqual(800);
		expect(src).toMatch(/export\s+function\s+GAFChatProvider\b/);
		expect(src).toMatch(/export\s+function\s+useGAFChatProcess\b/);
	});

	it('parent wires extracted hooks and helpers', () => {
		const src = read(parentPath);
		expect(src).toContain("from './gafChatProviderTypes'");
		expect(src).toContain("from './gafChatIncomingMute'");
		expect(src).toContain("from './gafChatIncomingNotifications'");
		expect(src).toContain("from './useGafDesktopVideoCallProcess'");
		expect(src).toContain("from './useDesktopSocketLeader'");
		expect(src).toContain("from './useGafChatSocketEventHandlers'");
		expect(src).toContain('useGafIncomingMuteCheck(');
		expect(src).toContain('useGafIncomingMessageNotifications(');
		expect(src).toContain('useGafDesktopVideoCallProcess(');
		expect(src).toContain('useDesktopSocketLeaderDisconnectEffects(');
		expect(src).toContain('useDesktopSocketLeaderConnect(');
		expect(src).toContain('useGafChatSocketEventHandlers(');
		expect(src).toContain('useGafChatRealtimeRelayChannel(');
	});

	it('child modules exist and are ≤800 LOC each', () => {
		for (const name of childModules) {
			const path = join(contextDir, name);
			expect(lineCount(path), name).toBeLessThanOrEqual(800);
		}
	});

	it('mount sites keep canonical import path', () => {
		const desktopWorkspace = read(join(contextDir, '../DesktopWorkspace.tsx'));
		expect(desktopWorkspace).toContain("from './context/GAFChatProvider'");
		expect(desktopWorkspace).toContain('<GAFChatProvider>');

		const mobileSettings = read(
			join(
				contextDir,
				'../../MobileDesktopSettings/MobileEmbeddedDesktopSettingsWorkspace.tsx'
			)
		);
		expect(mobileSettings).toContain(
			"from '@/pages/Desktop/context/GAFChatProvider'"
		);
		expect(mobileSettings).toContain('<GAFChatProvider>');
	});

	it('connection-restore policy lives in socket handlers module', () => {
		const handlers = read(join(contextDir, 'useGafChatSocketEventHandlers.ts'));
		expect(handlers).toContain('shouldRefetchGafChatsOnConnectionRestored');
	});
});
