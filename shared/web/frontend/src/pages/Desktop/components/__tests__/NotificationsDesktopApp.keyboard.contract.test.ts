/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for NotificationsApp window Escape close wiring.
 *
 * Related:
 * - NotificationsDesktopApp.tsx, desktopWindowAppContent/renderDesktopWindowAppContent.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('NotificationsDesktopApp keyboard contract', () => {
	it('forwards onRequestClose into NotificationHubBody', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const appSrc = readFileSync(
			join(dir, '../NotificationsDesktopApp.tsx'),
			'utf8'
		);
		const mountSrc = readFileSync(
			join(dir, '../desktopWindowAppContent/renderDesktopWindowAppContent.tsx'),
			'utf8'
		);
		expect(appSrc).toContain('onRequestClose?: () => void');
		expect(appSrc).toContain(
			'onRequestClose={guideOpen ? undefined : onRequestClose}'
		);
		expect(mountSrc).toContain("case 'NotificationsApp'");
		expect(mountSrc).toContain('onRequestClose={windowCallbacks?.onClose}');
	});
});
