/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin EBrowser tab — default-deny honesty + New World atoms smoke.
 *
 * Related:
 * - pages/Admin/adminUserDetail/AdminUserDetailEbrowserTab.tsx
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { AdminUserDetailEbrowserTab } from '../AdminUserDetailEbrowserTab';

vi.mock('@/features/ebrowser/ebrowserPolicyApi', () => ({
	adminGetEBrowserPolicy: vi.fn().mockResolvedValue({
		user_id: 'u1',
		mode: 'allowlist',
		allow: [],
		deny: [],
		ttl_seconds: 300,
		fetched_at: '2026-09-10T00:00:00Z',
		expires_at: '2026-09-10T00:05:00Z',
		is_default: true,
	}),
	adminPutEBrowserPolicy: vi.fn(),
}));

const t = ((key: string, opts?: { defaultValue?: string }) =>
	opts?.defaultValue ?? key) as TFunction;

describe('AdminUserDetailEbrowserTab', () => {
	it('shows default-deny honesty and save CTA', async () => {
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={qc}>
				<AdminUserDetailEbrowserTab userId="u1" t={t} />
			</QueryClientProvider>
		);
		expect(await screen.findByText(/No saved policy yet/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Save policy/i })).toBeEnabled();
		expect(screen.getByLabelText(/Mode/i)).toBeInTheDocument();
	});
});
