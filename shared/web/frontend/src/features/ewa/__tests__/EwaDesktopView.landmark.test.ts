/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Static landmark contract for EWA desktop companion window root (plan 19/20 A11Y-02).
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionChatPanelRoot.tsx
 * - src/features/ewa/EwaDesktopApp.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('EWA desktop companion landmarks', () => {
	it('uses stable guide root id on chat panel shell', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const rootSrc = readFileSync(
			join(dir, '../companionUx/CompanionChatPanelRoot.tsx'),
			'utf8'
		);
		expect(rootSrc).toContain('EWA_DESKTOP_GUIDE_ROOT_ID');
		expect(rootSrc).toContain('data-testid="ewa-companion-chat-root"');
	});

	it('mounts companion chat from EwaDesktopApp when gate is ready', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const appSrc = readFileSync(join(dir, '../EwaDesktopApp.tsx'), 'utf8');
		expect(appSrc).toContain('EwaCompanionChatPanel');
		expect(appSrc).toMatch(/role="status"/);
		expect(appSrc).toMatch(/aria-live="polite"/);
	});
});
