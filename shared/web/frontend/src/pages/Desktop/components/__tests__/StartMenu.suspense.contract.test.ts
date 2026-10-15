/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Start Menu Suspense must not use fallback={null}.
 *
 * Related:
 * - ../StartMenu.tsx
 * - ../startMenu/StartMenuSuspenseFallback.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('StartMenu Suspense contract', () => {
	it('uses StartMenuSuspenseFallback with aria-busy', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const orch = readFileSync(join(dir, '../StartMenu.tsx'), 'utf8');
		const fallback = readFileSync(
			join(dir, '../startMenu/StartMenuSuspenseFallback.tsx'),
			'utf8'
		);
		expect(orch).toContain('StartMenuSuspenseFallback');
		expect(orch).not.toContain('fallback={null}');
		expect(fallback).toContain('useDesktopAppLoadStall');
		expect(fallback).toContain('data-stalled');
		expect(fallback).toContain('aria-busy={!stalled}');
		expect(fallback).toContain('role="status"');
		expect(fallback).toContain('START_MENU_PANEL_GEOMETRY');
		expect(fallback).toContain("'pointer-events-none absolute");
		expect(fallback).not.toMatch(/className=\{[^}]*\bfixed\b/);
		expect(fallback).not.toMatch(/'[^']*\bfixed\b[^']*'/);
	});
});
