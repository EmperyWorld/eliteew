/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for companion composer Enter-to-send (E2 flow, plan 19/20).
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionComposerTextarea.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('CompanionComposerTextarea keyboard contract', () => {
	it('sends on Enter without Shift and keeps textarea as the handler owner', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../CompanionComposerTextarea.tsx'),
			'utf8'
		);
		expect(src).toContain("e.key === 'Enter' && !e.shiftKey");
		expect(src).toContain('e.preventDefault()');
		expect(src).toContain('void onSend()');
		expect(src).toContain('id="ewa-companion-chat-input"');
		expect(src).toContain('DESKTOP_CHROME_FOCUS_VISIBLE');
	});
});
