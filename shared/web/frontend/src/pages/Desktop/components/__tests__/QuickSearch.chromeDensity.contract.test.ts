/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 2 Lock — Quick Search launcher chrome uses DesktopAppChrome primitives.
 *
 * Related:
 * - ../QuickSearch.tsx
 * - ../quickSearch/helpers.ts
 * - ../DesktopAppChrome.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('QuickSearch chrome density (Wave 2)', () => {
	it('composes DesktopAppToolbar/Input and listRow token for launcher rows', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const shell = readFileSync(join(dir, '../QuickSearch.tsx'), 'utf8');
		const helpers = readFileSync(
			join(dir, '../quickSearch/helpers.ts'),
			'utf8'
		);

		expect(shell).toContain('DesktopAppToolbar');
		expect(shell).toContain('DesktopAppInput');
		expect(shell).toContain('DesktopAppSectionLabel');
		expect(helpers).toContain('DESKTOP_APP_STYLE_CONTRACT.listRow');
		expect(helpers).toContain('qsLauncherRowClass');
	});
});
