import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('NotificationsDesktopApp mobile embedded contract', () => {
	it('passes embeddedMobileLayout and disables guided tour', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const appSrc = readFileSync(
			join(dir, '../NotificationsDesktopApp.tsx'),
			'utf8'
		);
		const bodySrc = readFileSync(
			join(dir, '../NotificationHubBody.tsx'),
			'utf8'
		);
		const settingsSrc = readFileSync(
			join(dir, '../notificationHub/NotificationHubQuickSettings.tsx'),
			'utf8'
		);

		expect(appSrc).toContain('embeddedMobileLayout={embeddedMobileLayout}');
		expect(appSrc).toContain('DesktopProductWorkspace');
		expect(appSrc).toContain('data-testid="notifications-product-workspace"');
		expect(appSrc).toContain('enabled: !embeddedMobileLayout');
		expect(appSrc).toContain('data-notifications-hub-root');
		expect(bodySrc).toContain('embeddedMobileLayout');
		expect(bodySrc).toContain('max-h-[min(42dvh,380px)]');
		expect(settingsSrc).toContain('!embeddedMobileLayout &&');
		expect(settingsSrc).toContain("'xl:grid-cols-2'");
	});
});
