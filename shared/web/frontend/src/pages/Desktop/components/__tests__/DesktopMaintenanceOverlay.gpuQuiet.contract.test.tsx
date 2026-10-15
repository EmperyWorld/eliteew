/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: desktop maintenance recovery overlay stays GPU-quiet (ambient-static, opaque backdrop, no quote churn).
 *
 * Related:
 * - `DesktopMaintenanceOverlay.tsx`
 * - `documentation/product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopMaintenanceOverlay } from '../DesktopMaintenanceOverlay';

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	};
});

vi.mock('@/utils/staleBundleReload', () => ({
	requestMaintenanceRecoveryReload: vi.fn(),
}));

describe('DesktopMaintenanceOverlay GPU quiet', () => {
	it('mounts ambient-static recovery with opaque backdrop and no live quote timer class churn', () => {
		const { container } = render(
			<DesktopMaintenanceOverlay
				windowId="win-test"
				title="EliteEW восстанавливает связь"
				message="Связь с сервером временно прервана."
				statusLabel="Связь восстанавливается"
				footnote="Следующая проверка через 60 с"
			/>
		);

		expect(
			container.querySelector('[data-testid="desktop-maintenance-overlay"]')
		).toBeTruthy();
		expect(container.querySelector('.elite-recovery-backdrop')).toBeTruthy();
		expect(
			container.querySelector('.elite-recovery-ambient-static')
		).toBeTruthy();
		expect(container.querySelector('.elite-shell-aura')).toBeTruthy();
	});
});
