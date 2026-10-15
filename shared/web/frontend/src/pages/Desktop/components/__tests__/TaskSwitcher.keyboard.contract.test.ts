/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for TaskSwitcher capture keyboard handling.
 *
 * Related:
 * - src/pages/Desktop/components/TaskSwitcher.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('TaskSwitcher keyboard contract', () => {
	it('uses useShellCaptureKeyboard with stopPropagation on handled keys', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../TaskSwitcher.tsx'), 'utf8');
		expect(src).toContain('useShellCaptureKeyboard');
		expect(src).toContain('e.stopPropagation()');
	});

	it('opts out of ModalAdvanced trapFocus and handles Tab internally', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../TaskSwitcher.tsx'), 'utf8');
		expect(src).toContain('trapFocus={false}');
		expect(src).toContain("case 'Tab':");
		expect(src).toContain(
			"['Tab', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', ' ']"
		);
	});
});
