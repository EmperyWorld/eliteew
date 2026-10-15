/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for QuickSearch layered Escape handling (P23: model owns capture).
 *
 * Related:
 * - quickSearch/useQuickSearchModel.ts
 * - components/QuickSearch.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('QuickSearch keyboard contract', () => {
	it('uses dismissible context menu and layered capture Escape in model', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const modelSrc = readFileSync(
			join(dir, '../quickSearch/useQuickSearchModel.ts'),
			'utf8'
		);
		expect(modelSrc).toContain('useDismissibleFloatingMenu');
		expect(modelSrc).toContain('escapeCapture: true');
		expect(modelSrc).toContain('useShellCaptureEscape');
		expect(modelSrc).toContain('useShellCaptureKeyboard');
		expect(modelSrc).toContain('ctxMenu == null');
		expect(modelSrc).toContain('consumeEscapeForSearchClear');
	});

	it('parent still imports useQuickSearchModel', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentSrc = readFileSync(join(dir, '../QuickSearch.tsx'), 'utf8');
		expect(parentSrc).toContain('useQuickSearchModel');
	});
});
