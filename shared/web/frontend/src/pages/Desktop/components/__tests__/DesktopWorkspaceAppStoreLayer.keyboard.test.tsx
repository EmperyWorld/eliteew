/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral keyboard tests for App Store detail overlay Escape coordination.
 *
 * Related:
 * - src/pages/Desktop/components/DesktopWorkspaceAppStoreLayer.tsx
 */

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import type { DesktopWindowStyle } from '@/types/profile';
import { storeAppFixture } from '../appStore/__tests__/storeAppFixture';
import { DesktopWorkspaceAppStoreLayer } from '../DesktopWorkspaceAppStoreLayer';

vi.mock('../AppStore', async (importOriginal) => {
	const mod = await importOriginal<typeof import('../AppStore')>();
	return {
		...mod,
		AppStore: ({ isOpen }: { isOpen?: boolean }) =>
			isOpen ? <div data-testid="app-store-catalog">catalog</div> : null,
	};
});

vi.mock('../AppStoreCard', () => ({
	AppStoreCard: () => <div data-testid="app-store-detail-card">detail</div>,
}));

const storeApp = storeAppFixture({
	app_id: 'demo-app',
	name: 'Demo App',
	description: 'Test',
	category: 'tools',
});

function renderLayer(
	overrides: Partial<
		React.ComponentProps<typeof DesktopWorkspaceAppStoreLayer>
	> = {}
) {
	const onCloseModal = vi.fn();
	const onBackFromDetail = vi.fn();

	render(
		<DesktopWorkspaceAppStoreLayer
			showAppStore={true}
			appStoreDetailId="demo-app"
			appStoreDetailFromStore={storeApp}
			storeApps={[storeApp]}
			installedAppsLoading={false}
			desktopIconStyle="glass"
			shellWindowStyle={'glass' satisfies DesktopWindowStyle}
			onCloseModal={onCloseModal}
			onBackFromDetail={onBackFromDetail}
			onSetAppStoreDetailId={vi.fn()}
			onInstall={vi.fn(async () => {})}
			onUninstall={vi.fn(async () => {})}
			onAppStoreError={vi.fn()}
			onAppStoreSuccess={vi.fn()}
			onOpenInstalledApp={vi.fn()}
			{...overrides}
		/>
	);

	return { onCloseModal, onBackFromDetail };
}

describe('DesktopWorkspaceAppStoreLayer keyboard', () => {
	it('Escape on detail overlay backs out without closing the store modal', async () => {
		const { onCloseModal, onBackFromDetail } = renderLayer();

		expect(await screen.findByTestId('app-store-detail-card')).toBeTruthy();
		expect(screen.queryByTestId('app-store-catalog')).toBeNull();

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(onBackFromDetail).toHaveBeenCalledTimes(1);
		expect(onCloseModal).not.toHaveBeenCalled();
	});

	it('keeps catalog hidden while detail is open', () => {
		renderLayer();
		expect(screen.queryByTestId('app-store-catalog')).toBeNull();
	});
});
