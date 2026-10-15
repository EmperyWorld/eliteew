/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopAiChatAdminSection states contract', () => {
	it('uses loadState skeleton and tablist a11y', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../DesktopAiChatAdminSection.tsx'),
			'utf8'
		);
		expect(src).toContain("loadState === 'loading'");
		expect(src).toContain("loadState === 'permissionDenied'");
		expect(src).toContain('AdminSectionFrame');
		expect(src).toContain('adminShell.sections.desktopAiChat');
		expect(src).toContain('role="tablist"');
		expect(src).toContain('aria-selected');
		expect(src).toContain("'blueprint'");
		expect(src).toContain('DesktopAiChatBlueprintTab');
		expect(src).toContain("'memoryCells'");
		expect(src).toContain('DesktopAiChatMemoryCellsTab');
		expect(src).toContain('onTabKeyDown');
		expect(src).toContain('ArrowRight');
		expect(src).toContain('DesktopAiChatBlueprintTab');
		expect(src).toContain("'blueprint'");
	});

	it('defaults tab blocks invalid JSON before PATCH', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../DesktopAiChatDefaultsTab.tsx'),
			'utf8'
		);
		expect(src).toContain('parseAdvancedDefaultsJson');
		expect(src).toContain("t('adminAiChat.invalidJson')");
		expect(src).toContain("saveState === 'saving'");
	});
});
