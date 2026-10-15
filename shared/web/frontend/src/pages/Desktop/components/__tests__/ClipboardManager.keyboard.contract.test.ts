/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for ClipboardManager layered capture Escape.
 *
 * Related:
 * - src/pages/Desktop/components/ClipboardManager.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ClipboardManager keyboard contract', () => {
	it('uses layered useShellCaptureEscape and defers while guide is open', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../ClipboardManager.tsx'), 'utf8');
		expect(src).toContain('useShellCaptureEscape');
		expect(src).toContain('!guideOpen');
		expect(src).toContain('consumeEscapeForSearchClear');
		expect(src).toContain('data-desktop-shell-keyboard-surface');
	});
});
