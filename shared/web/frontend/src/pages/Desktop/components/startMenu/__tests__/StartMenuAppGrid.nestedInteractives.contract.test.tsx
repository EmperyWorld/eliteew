/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P5 Focus contract lock: Start Menu app cards must not nest interactive controls.
 *
 * Invariants:
 * - Mounts StartMenuAppGrid; asserts zero `button button` / nested role=button.
 *
 * Related:
 * - ../StartMenuAppGrid.tsx
 * - shell/shellSemanticContracts.ts
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import type { DesktopItem } from '../../../types/desktop.types';
import { StartMenuAppGrid } from '../StartMenuAppGrid';

vi.mock('../../DesktopChromeTooltip', () => ({
	DesktopChromeTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('../../../utils/desktopAppRegistry', () => ({
	isSystemDesktopApp: () => false,
}));

const t = ((key: string) => key) as TFunction<'desktopUi'>;

function sampleApp(id: string, name: string): DesktopItem {
	return {
		id,
		name,
		type: 'app',
		position: { x: 0, y: 0 },
		appComponent: 'AppStore',
	};
}

describe('StartMenuAppGrid P5 nested interactivity', () => {
	it('has no nested buttons; pin and menu remain reachable siblings', () => {
		const openAppFromStart = vi.fn();
		const onOpenAppContext = vi.fn();
		const toggleAppDesktopPin = vi.fn();

		const { container } = render(
			<StartMenuAppGrid
				apps={[sampleApp('app-1', 'Store')]}
				search=""
				iconStyle="glass"
				desktopAppIdSet={new Set()}
				canToggleDesktopPin
				t={t}
				openAppFromStart={openAppFromStart}
				onOpenAppContext={onOpenAppContext}
				onAppContextMenu={vi.fn()}
				onAppMouseDown={vi.fn()}
				onPreloadApp={vi.fn()}
				toggleAppDesktopPin={toggleAppDesktopPin}
			/>
		);

		const nestedButtons = container.querySelectorAll('button button');
		expect(nestedButtons.length).toBe(0);

		const grid = screen.getByTestId('start-menu-app-grid');
		expect(grid.className).toContain('grid-cols-2');

		const card = screen.getByTestId('start-menu-app-card');
		const buttons = card.querySelectorAll('button');
		expect(buttons.length).toBeGreaterThanOrEqual(2);

		fireEvent.click(screen.getByLabelText('Store'));
		expect(openAppFromStart).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByLabelText('startMenu.pinToDesktop'));
		expect(toggleAppDesktopPin).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'app-1' }),
			false
		);

		fireEvent.click(screen.getByLabelText('startMenu.appMenuTriggerTitle'));
		expect(onOpenAppContext).toHaveBeenCalled();
	});

	it('keeps unpin as sibling when app is already on desktop', () => {
		const toggleAppDesktopPin = vi.fn();
		const { container } = render(
			<StartMenuAppGrid
				apps={[sampleApp('app-1', 'Store')]}
				search=""
				iconStyle="glass"
				desktopAppIdSet={new Set(['app-1'])}
				canToggleDesktopPin
				t={t}
				openAppFromStart={vi.fn()}
				onOpenAppContext={vi.fn()}
				onAppContextMenu={vi.fn()}
				onAppMouseDown={vi.fn()}
				onPreloadApp={vi.fn()}
				toggleAppDesktopPin={toggleAppDesktopPin}
			/>
		);

		expect(container.querySelectorAll('button button').length).toBe(0);
		fireEvent.click(screen.getByLabelText('startMenu.unpinFromDesktop'));
		expect(toggleAppDesktopPin).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'app-1' }),
			true
		);
	});
});
