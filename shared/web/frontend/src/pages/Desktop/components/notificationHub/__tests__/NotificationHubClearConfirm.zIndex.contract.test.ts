/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for notification hub clear-all confirm modal stacking.
 *
 * Related:
 * - ../NotificationHubClearConfirm.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('NotificationHubClearConfirm z-index contract', () => {
	it('portals confirm via DesktopPortaledConfirmShell + embedded z-index', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../NotificationHubClearConfirm.tsx'),
			'utf8'
		);
		expect(src).toContain('useEmbeddedPortaledModalZIndex');
		expect(src).toContain('DesktopPortaledConfirmShell');
		expect(src).not.toContain('createPortal');
		expect(src).not.toContain('DESKTOP_Z_INDEX.MODAL');
	});
});
