/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * U2.1: ShellPortalMount registers with portalStackController.
 *
 * Related:
 * - ../shellPortal.tsx
 * - ../portalStackController.ts
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	__resetShellPortalStackForTests,
	listShellPortalSurfaces,
} from '../portalStackController';
import { ShellPortalMount } from '../shellPortal';

vi.mock('../../utils/desktopUi', () => ({
	getDesktopPortalShellProps: () => ({
		style: { transform: 'none' },
		theme: 'dark' as const,
	}),
}));

vi.mock('../../runtime/desktopLowGpuMode', () => ({
	isDesktopLowGpuModeEnabled: () => false,
}));

describe('ShellPortalMount stack', () => {
	beforeEach(() => {
		__resetShellPortalStackForTests();
		document.body.innerHTML = '';
	});

	afterEach(() => {
		cleanup();
		__resetShellPortalStackForTests();
	});

	it('registers a surface on mount and clears on unmount', () => {
		const { unmount } = render(
			<ShellPortalMount layer="shell_global">
				<div>adapter-content</div>
			</ShellPortalMount>
		);

		expect(listShellPortalSurfaces().length).toBe(1);
		expect(screen.getByTestId('shell-portal-surface')).toHaveAttribute(
			'data-shell-portal-layer',
			'shell_global'
		);

		unmount();
		expect(listShellPortalSurfaces().length).toBe(0);
	});
});
