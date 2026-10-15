/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Structural lock for EnsemblePlanWorkbench atomization (026 residual).
 *
 * Invariants:
 * - Facade stays under soft LOC cap; editor + duplicate wizard live in subfolder.
 * - Public export remains EnsemblePlanWorkbench.
 *
 * Related:
 * - pages/Admin/desktopAiChat/EnsemblePlanWorkbench.tsx
 * - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const workbenchRoot = join(dir, '..');

function loc(rel: string): number {
	return readFileSync(join(workbenchRoot, rel), 'utf8').split('\n').length;
}

describe('EnsemblePlanWorkbench atomization (026 residual)', () => {
	it('splits editor and duplicate wizard under LOC caps', () => {
		expect(loc('EnsemblePlanWorkbench.tsx')).toBeLessThanOrEqual(780);
		expect(
			loc('ensemblePlanWorkbench/EnsemblePlanEditorDialog.tsx')
		).toBeLessThanOrEqual(320);
		expect(
			loc('ensemblePlanWorkbench/EnsemblePlanDuplicateWizard.tsx')
		).toBeLessThanOrEqual(240);
	});
});
