/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock post-OTA restart CTA in updater strip (no testing-library dependency).
 *
 * Invariants:
 * - Restart button label is user-facing RU «Перезапустить».
 *
 * Related:
 * - features/updater/UpdaterStatus.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'UpdaterStatus.tsx'), 'utf8');

describe('UpdaterStatus restart CTA', () => {
	it('exposes canRestart + Перезапустить primary CTA', () => {
		expect(src).toContain('canRestart');
		expect(src).toContain('onRestart');
		expect(src).toContain('Перезапустить');
		expect(src).toContain('Перезапуск…');
	});

	it('uses honest data-state and prefers restart over install', () => {
		expect(src).toContain("data-state={state}");
		expect(src).toContain("'idle'");
		expect(src).toContain("'available'");
		expect(src).toContain("'restart'");
		expect(src).toContain('!showRestart && canInstall');
	});
});
