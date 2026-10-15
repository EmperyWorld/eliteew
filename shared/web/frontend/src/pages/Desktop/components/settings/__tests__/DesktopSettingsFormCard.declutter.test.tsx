/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock SettingsFormCard chrome: title only — persistence badges gated by
 * settings chromeProfile traits (allowPersistenceBadges=false).
 *
 * Related:
 * - ../DesktopSettingsFormCard.tsx
 * - documentation/product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md
 * - shell/shellChrome.ts
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetAndReseedShellAppCatalogForTests } from '../../../shell/appRegistry.catalog';
import { SettingsFormCard } from '../DesktopSettingsFormCard';

describe('SettingsFormCard declutter', () => {
	beforeEach(() => {
		__resetAndReseedShellAppCatalogForTests();
	});

	it('renders title without persistence badge copy', () => {
		render(
			<SettingsFormCard title="Размер иконок" windowStyle="glass">
				<div>controls</div>
			</SettingsFormCard>
		);
		expect(screen.getByText('Размер иконок')).toBeTruthy();
		expect(screen.queryByText(/на этом столе/i)).toBeNull();
		expect(screen.queryByText(/в аккаунте/i)).toBeNull();
		expect(screen.queryByText(/в этой вкладке/i)).toBeNull();
	});

	it('suppresses persistenceBadge when settings chromeProfile forbids badges', () => {
		const { container } = render(
			<SettingsFormCard
				title="Размер иконок"
				windowStyle="glass"
				persistenceBadge={<span>на этом столе</span>}
			>
				<div>controls</div>
			</SettingsFormCard>
		);
		expect(screen.queryByText(/на этом столе/i)).toBeNull();
		expect(
			container.querySelector('[data-shell-chrome-profile="settings"]')
		).toBeTruthy();
	});
});
