/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P14 lock — DesktopShellRestrictedAppGate shows shell permissionDenied + close CTA.
 *
 * Invariants:
 * - Denied path uses DesktopProductStatePanel grammar and calls onRequestClose.
 * - Allowed path mounts children.
 *
 * Related:
 * - `../DesktopShellRestrictedAppGate.tsx`
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopShellRestrictedAppGate } from '../DesktopShellRestrictedAppGate';

const authState = vi.hoisted(() => ({
	user: { role: 'member', email: 'user@example.test' } as {
		role: string;
		email: string;
	} | null,
	isAuthenticated: true,
	loading: false,
}));

vi.mock('@/hooks', () => ({
	useAuth: () => authState,
}));

vi.mock('@/services/authSession', () => ({
	getUserInfo: vi.fn(() => null),
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

describe('DesktopShellRestrictedAppGate', () => {
	beforeEach(() => {
		authState.user = { role: 'member', email: 'user@example.test' };
		authState.isAuthenticated = true;
		authState.loading = false;
	});

	it('renders children when access is allowed', () => {
		authState.user = { role: 'admin', email: 'admin@example.test' };
		render(
			<DesktopShellRestrictedAppGate appComponent="UnifiedAdminApp">
				<div>admin-body</div>
			</DesktopShellRestrictedAppGate>
		);
		expect(screen.getByText('admin-body')).toBeInTheDocument();
	});

	it('shows permissionDenied panel and close CTA when denied', async () => {
		const onRequestClose = vi.fn();
		const user = userEvent.setup();
		render(
			<DesktopShellRestrictedAppGate
				appComponent="UnifiedAdminApp"
				onRequestClose={onRequestClose}
			>
				<div>admin-body</div>
			</DesktopShellRestrictedAppGate>
		);
		expect(screen.queryByText('admin-body')).not.toBeInTheDocument();
		expect(
			screen.getByText('shellRestrictedApp.deniedTitle')
		).toBeInTheDocument();
		await user.click(
			screen.getByRole('button', { name: 'shellRestrictedApp.closeWindow' })
		);
		expect(onRequestClose).toHaveBeenCalledTimes(1);
	});

	it('passes unrestricted apps through without gating', () => {
		authState.isAuthenticated = false;
		render(
			<DesktopShellRestrictedAppGate appComponent="AppStore">
				<div>store-body</div>
			</DesktopShellRestrictedAppGate>
		);
		expect(screen.getByText('store-body')).toBeInTheDocument();
	});
});
