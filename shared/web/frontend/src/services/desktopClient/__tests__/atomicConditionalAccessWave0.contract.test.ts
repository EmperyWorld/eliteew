/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 0 source locks — contract module is wired; SoT exists; legacy paths tracked.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
 * - atomicConditionalAccessContract.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../../../..',
);

const contractPath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../atomicConditionalAccessContract.ts'
);

describe('atomicConditionalAccess Wave 0 source locks', () => {
	const contractSrc = readFileSync(contractPath, 'utf8');

	it('exports auth-risk and privilege invariants', () => {
		expect(contractSrc).toContain('authRiskMayAutoRevokeLicense');
		expect(contractSrc).toContain('return false');
		expect(contractSrc).toContain('clientSuppliedPrivilegeFlagTrusted');
	});

	it('documents forbidden Start URL query params', () => {
		expect(contractSrc).toContain('eliteewLicenseId');
		expect(contractSrc).toContain('eliteewDeviceId');
	});

	it('living SoT document exists at canonical path', () => {
		const sot = join(
			repoRoot,
			'documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md'
		);
		const text = readFileSync(sot, 'utf8');
		expect(text).toContain('Target invariant');
		expect(text).toContain('session/assert');
	});

	it('legacy session assert module references bind query constants (migration tracked)', () => {
		const assertPath = join(
			repoRoot,
			'shared/web/frontend/src/services/desktopClient/desktopClientSessionAssert.ts'
		);
		const src = readFileSync(assertPath, 'utf8');
		expect(src).toContain('eliteewLicenseId');
		expect(contractSrc).toContain('desktopClientSessionAssert.ts');
	});
});
