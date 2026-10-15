/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for ModalAdvanced desktop shell keyboard defaults.
 *
 * Related:
 * - src/components/ui/ModalAdvanced.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ModalAdvanced keyboard contract', () => {
	it('defaults desktop variant to capture Escape and shell keyboard surface', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../ModalAdvanced.tsx'), 'utf8');
		expect(src).toContain('useShellCaptureEscape');
		expect(src).toContain(
			'resolvedEscapeCapture = escapeCapture ?? useDesktopChrome'
		);
		expect(src).toContain('data-desktop-shell-keyboard-surface');
		expect(src).toContain('onEscapeLayer');
		expect(src).toContain('searchEscapeValue');
		expect(src).toContain('onSearchEscapeClear');
		expect(src).toContain('consumeEscapeForSearchClear');
		expect(src).toContain('handleEscapeLayer');
	});
});
