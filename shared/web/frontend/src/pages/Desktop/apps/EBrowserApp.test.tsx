/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EBrowserApp journey locks — cloud degrade + default-deny honesty.
 *
 * Related:
 * - pages/Desktop/apps/EBrowserApp.tsx
 * - documentation/product/desktop/DESKTOP-EBROWSER.md
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EBrowserApp } from './EBrowserApp';

const fetchOwn = vi.fn();

vi.mock('@/features/ebrowser/ebrowserNative', () => ({
	isEliteewNativeDesktopProductShell: () => false,
	closeNativeEBrowser: vi.fn(),
	ebrowserStageBoundsFromElement: () => null,
	getNativeEBrowserLocation: vi.fn(),
	getNativeEBrowserChromeSnapshot: vi.fn(async () => null),
	listenNativeEBrowserChrome: vi.fn(async () => () => undefined),
	getNativeEBrowserDownloads: vi.fn(async () => []),
	listNativeEBrowserTabs: vi.fn(async () => ({ tabs: [], maxTabs: 3 })),
	createNativeEBrowserTab: vi.fn(),
	activateNativeEBrowserTab: vi.fn(),
	closeNativeEBrowserTab: vi.fn(),
	getNativeEBrowserMediaToggles: vi.fn(),
	nativeEBrowserFind: vi.fn(),
	nativeEBrowserSetZoom: vi.fn(async () => ({ ok: true, level: 1 })),
	nativeEBrowserGetZoom: vi.fn(async () => 1),
	ebrowserDownloadStatusCopy: (item: { name: string; phase: string }) =>
		`${item.name}:${item.phase}`,
	nativeEBrowserHistoryBack: vi.fn(),
	nativeEBrowserHistoryForward: vi.fn(),
	nativeEBrowserReload: vi.fn(),
	navigateNativeEBrowser: vi.fn(),
	openNativeEBrowser: vi.fn(),
	policyApiToSnapshot: (api: {
		mode: string;
		allow: string[];
		deny: string[];
		ttl_seconds: number;
	}) => ({
		mode: api.mode,
		allow: api.allow,
		deny: api.deny,
		fetchedAtMs: Date.now(),
		ttlSeconds: api.ttl_seconds,
	}),
	refreshNativeEBrowserPolicy: vi.fn(),
	setNativeEBrowserBounds: vi.fn(),
	setNativeEBrowserMediaToggles: vi.fn(),
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			if (key === 'ebrowserApp.closeTab' && opts?.id != null) {
				return `Close tab ${opts.id}`;
			}
			if (key === 'ebrowserApp.tabLimit' && opts?.max != null) {
				return `Tab limit ${opts.max}`;
			}
			if (key === 'ebrowserApp.emptyEnterUrlBody' && opts?.mode) {
				return String(opts.mode);
			}
			const map: Record<string, string> = {
				'ebrowserApp.title': 'EBrowser',
				'ebrowserApp.subtitle':
					'Protected HTTPS browsing in the EliteEW client',
				'ebrowserApp.cloudTitle': 'Available in the EliteEW client',
				'ebrowserApp.cloudBody':
					'EBrowser opens pages in the installed client on your organization device.',
				'ebrowserApp.addressLabel': 'Address bar',
				'ebrowserApp.back': 'Back',
				'ebrowserApp.forward': 'Forward',
				'ebrowserApp.policyClosedTitle': 'Sites are closed for now',
				'ebrowserApp.policyLoadFailed': 'policy load failed',
			};
			return map[key] ?? key;
		},
	}),
}));

vi.mock('@/features/ebrowser/ebrowserPolicyApi', () => ({
	fetchOwnEBrowserPolicy: () => fetchOwn(),
}));

describe('EBrowserApp', () => {
	beforeEach(() => {
		fetchOwn.mockReset();
	});

	it('shows honest cloud degrade without native shell', async () => {
		fetchOwn.mockRejectedValue(new Error('offline'));
		render(<EBrowserApp />);
		expect(
			await screen.findByText(/Available in the EliteEW client/i)
		).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: 'EBrowser' })
		).toBeInTheDocument();
		expect(screen.getByLabelText('Address bar')).toBeInTheDocument();
		expect(screen.getByLabelText('Back')).toBeDisabled();
		expect(screen.getByLabelText('Forward')).toBeDisabled();
	});

	it('shows default-deny honesty when API returns is_default', async () => {
		fetchOwn.mockResolvedValue({
			user_id: 'u1',
			mode: 'allowlist',
			allow: [],
			deny: [],
			ttl_seconds: 300,
			fetched_at: '2026-09-10T00:00:00Z',
			expires_at: '2026-09-10T00:05:00Z',
			is_default: true,
		});
		render(<EBrowserApp />);
		expect(
			await screen.findByText(/Sites are closed for now/i)
		).toBeInTheDocument();
	});
});
