/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render tests for App Store install/remove sticky status bar labels.
 *
 * Invariants:
 * - Copy from appStore.installStatus.* keys only.
 *
 * Related:
 * - AppStoreInstallStatusBar.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppStoreInstallStatusBar } from '../AppStoreInstallStatusBar';

const t = ((key: string, opts?: { name?: string }) =>
	opts?.name ? `${key}:${opts.name}` : key) as Parameters<
	typeof AppStoreInstallStatusBar
>[0]['t'];

describe('AppStoreInstallStatusBar', () => {
	it('shows installing label with app name', () => {
		const { container } = render(
			<AppStoreInstallStatusBar t={t} appName="Notes" action="install" />
		);
		const bar = container.querySelector('[aria-live="polite"]');
		expect(bar).toHaveAttribute('aria-busy', 'true');
		expect(screen.getByText('installStatus.installing:Notes')).toBeTruthy();
	});

	it('shows uninstalling label with app name', () => {
		render(
			<AppStoreInstallStatusBar t={t} appName="Chat" action="uninstall" />
		);
		expect(screen.getByText('installStatus.uninstalling:Chat')).toBeTruthy();
	});
});
