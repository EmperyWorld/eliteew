/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Feedback Hub layout typography tokens.
 *
 * Invariants:
 * - Shell layout builders reference DESKTOP_TYPOGRAPHY and desktop visual system helpers.
 *
 * Related:
 * - pages/Desktop/components/feedbackHub/feedbackHubLayoutTokens.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readModuleSource(): string {
	const dir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(dir, '../feedbackHubLayoutTokens.ts'), 'utf8');
}

describe('feedbackHubLayoutTokens', () => {
	it('uses DESKTOP_TYPOGRAPHY for search input and trusted badge', () => {
		const src = readModuleSource();
		expect(src).toContain('DESKTOP_TYPOGRAPHY.body');
		expect(src).toContain('DESKTOP_TYPOGRAPHY.captionInherit');
		expect(src).toContain('getDesktopShellToolbarClusterClassName');
		expect(src).toContain('buildFeedbackHubHeaderStripClass');
	});
});
