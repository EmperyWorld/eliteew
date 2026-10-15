/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for shortcuts help modal wiring.
 *
 * Related:
 * - src/pages/Desktop/components/ShortcutsHelpModal.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ShortcutsHelpModal contract', () => {
	it('mirrors getDesktopShortcutHelpGroups and ModalAdvanced desktop shell surface', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../ShortcutsHelpModal.tsx'), 'utf8');
		expect(src).toContain('getDesktopShortcutHelpGroups');
		expect(src).toContain('variant="desktop"');
	});

	it('delegates Escape to ModalAdvanced desktop defaults', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../ShortcutsHelpModal.tsx'), 'utf8');
		expect(src).not.toContain('useShellCaptureEscape');
		expect(src).toContain('variant="desktop"');
	});

	it('applies platform-aware shortcut labels', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../ShortcutsHelpModal.tsx'), 'utf8');
		expect(src).toContain('formatShortcutKeysForPlatform');
	});
});
