/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for notification hub Escape capture coordination.
 *
 * Related:
 * - src/pages/Desktop/components/NotificationHubBody.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('NotificationHubBody keyboard contract', () => {
	it('uses useShellCaptureKeyboard with resolveNotificationHubEscapeAction', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../NotificationHubBody.tsx'), 'utf8');
		expect(src).toContain('useShellCaptureKeyboard');
		expect(src).toContain('resolveNotificationHubEscapeAction');
		expect(src).toContain('e.stopPropagation()');
	});
});
