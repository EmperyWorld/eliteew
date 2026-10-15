/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for desktop body portals inheriting shell compositor prefs.
 *
 * Invariants:
 * - Reduce-backdrop-blur applies to portal overlays rendered outside #desktop-main.
 *
 * Related:
 * - pages/Desktop/shell/shellBodyPortal.tsx
 * - pages/Desktop/shell/shellPortal.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDesktopWorkspaceShellCss } from '../../hooks/useDesktopWorkspaceShellCss';
import { ShellPortalMount } from '../../shell/shellPortal';

vi.mock('../../utils/desktopUi', () => ({
	getDesktopPortalShellProps: () => ({
		style: { transform: 'none' },
		theme: 'dark',
	}),
}));

vi.mock('../../runtime/desktopLowGpuMode', () => ({
	isDesktopLowGpuModeEnabled: () => false,
}));

describe('ShellPortalMount compositor contract', () => {
	it('inherits reduce-backdrop-blur from #desktop-main', () => {
		document.body.innerHTML =
			'<main id="desktop-main" data-desktop-reduce-backdrop-blur="true"></main>';

		render(
			<ShellPortalMount>
				<div>Portal content</div>
			</ShellPortalMount>
		);

		expect(screen.getByTestId('desktop-shell-floating-portal')).toHaveAttribute(
			'data-desktop-reduce-backdrop-blur',
			'true'
		);
	});

	it('keeps portal blur stripping in the injected shell css', () => {
		function Probe() {
			return <style>{useDesktopWorkspaceShellCss()}</style>;
		}
		render(<Probe />);

		const css = document.querySelector('style')?.textContent ?? '';
		expect(css).toContain(
			".desktop-shell-floating-portal[data-desktop-reduce-backdrop-blur='true']"
		);
		expect(css).toContain('backdrop-filter: none !important');
	});
});
