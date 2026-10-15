/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Social Hub Mobile tab load recovery and trusted-device list UX.
 *
 * Invariants:
 * - Empty mobile history remains visible and refreshable.
 * - Trusted-device list failures surface a warning banner without hiding overview data.
 * - Edge sync badge must reflect wg_edge_sync_status (not WG metadata alone).
 * - OTA observability strip shows version/SHA/published_at from overview + edge aggregate.
 * - Tests mock APK APIs; no browser download side effects are executed.
 *
 * Related:
 * - ../MobileAppHubPanel.tsx
 * - ../mobile-hub/mobileHubFormat.ts
 */

import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';

import MobileAppHubPanel from '../MobileAppHubPanel';
import {
	createMobilePairingChallenge,
	fetchMobileAppOverview,
	fetchMobileTrustedDevices,
} from '@/services/mobileAppApi';

vi.mock('@/services/keycloak', () => ({
	keycloak: { login: vi.fn() },
	isAuthenticated: vi.fn(() => true),
	isOidcAuthFreshForDeviceBinding: vi.fn(() => true),
}));

vi.mock('@/services/mobileAppApi', () => ({
	downloadMobileApkBlob: vi.fn(),
	createMobilePairingChallenge: vi.fn(),
	fetchMobileAppOverview: vi.fn(),
	fetchMobileTrustedDevices: vi.fn(),
	formatMobileBuildLabel: (
		versionName: string | null,
		versionCode: number | null
	) =>
		versionName && versionCode
			? `${versionName} (${versionCode})`
			: versionName,
	requestMobileApkDownloadTicket: vi.fn(),
	revokeMobileTrustedDevice: vi.fn(),
	triggerApkDownload: vi.fn(),
	triggerApkDownloadByUrl: vi.fn(),
}));

vi.mock('@/notifications/api', () => ({
	notify: {
		error: vi.fn(),
		success: vi.fn(),
		warning: vi.fn(),
	},
}));

import type { MobileTrustedDeviceItem } from '@/services/mobileAppApi';

function trustedDeviceFixture(
	overrides: Partial<MobileTrustedDeviceItem> = {}
): MobileTrustedDeviceItem {
	return {
		id: '00de9a78-b665-4092-b9a1-a3b856d5c7b8',
		stable_device_id: 'phone-1',
		device_label: 'HUAWEI GOA-LX9',
		platform: 'android',
		status: 'active',
		device_public_key_fingerprint: 'abc',
		wg_public_key_fingerprint: 'def',
		wg_assigned_ip: '10.66.0.2',
		wg_allowed_ips: null,
		wg_dns: null,
		wg_endpoint: 'vpn.example:51820',
		wg_server_public_key: 'server-key',
		gaf_public_key_fingerprint: 'gaf',
		approved_at: '2026-06-18T00:44:17+10:00',
		revoked_at: null,
		last_seen_at: null,
		created_at: '2026-06-18T00:44:17+10:00',
		updated_at: '2026-06-18T00:44:17+10:00',
		wg_edge_sync_status: 'synced',
		wg_edge_synced_at: '2026-07-16T02:00:00+10:00',
		...overrides,
	};
}

const overview = {
	download_page_url: 'https://app.eliteew.ru/mobile',
	download_api_path: '/api/v1/mobile-app/download',
	apk_available: true,
	apk_size_bytes: 42 * 1024 * 1024,
	version_code: 24,
	version_name: '0.2.4',
	apk_sha256:
		'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
	published_at: '2026-07-16T01:30:00+10:00',
	min_supported_version_code: 18,
	last_login_at: null,
	login_count: 0,
	mobile_session: null,
	login_history: [],
};

describe('MobileAppHubPanel', () => {
	beforeEach(() => {
		sessionStorage.clear();
		vi.mocked(fetchMobileAppOverview).mockReset();
		vi.mocked(fetchMobileTrustedDevices).mockReset();
		vi.mocked(createMobilePairingChallenge).mockReset();
		vi.mocked(fetchMobileTrustedDevices).mockResolvedValue({ items: [] });
	});

	it('renders load failures as an assertive product status banner with retry', async () => {
		const fetchMock = vi.mocked(fetchMobileAppOverview);
		fetchMock.mockRejectedValueOnce(new Error('offline'));
		fetchMock.mockResolvedValueOnce(overview);

		render(<MobileAppHubPanel />);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent(
			/Мобильный статус временно недоступен|Mobile status is temporarily unavailable/
		);

		fireEvent.click(
			within(alert).getByRole('button', { name: /Обновить|Refresh/i })
		);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});
		expect(
			await screen.findByText(
				/Событий мобильного канала пока нет|No mobile-channel events yet/
			)
		).toBeInTheDocument();
	});

	it('keeps empty mobile history visible and refreshable', async () => {
		const fetchMock = vi.mocked(fetchMobileAppOverview);
		fetchMock.mockResolvedValue(overview);

		render(<MobileAppHubPanel />);

		expect(
			await screen.findByText(
				/Событий мобильного канала пока нет|No mobile-channel events yet/
			)
		).toBeInTheDocument();

		const refreshButtons = screen.getAllByRole('button', {
			name: /Обновить|Refresh/i,
		});
		const emptyStateRefresh = refreshButtons.at(-1);
		expect(emptyStateRefresh).toBeDefined();
		fireEvent.click(emptyStateRefresh as HTMLElement);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});
	});

	it('renders OTA observability strip from overview meta and edge aggregate', async () => {
		vi.mocked(fetchMobileAppOverview).mockResolvedValue(overview);
		vi.mocked(fetchMobileTrustedDevices).mockResolvedValue({
			items: [trustedDeviceFixture()],
		});

		render(<MobileAppHubPanel />);

		const strip = await screen.findByTestId('mobile-hub-ota-observability');
		expect(within(strip).getByTestId('mobile-hub-ota-build')).toHaveTextContent(
			'0.2.4 (24)'
		);
		expect(within(strip).getByTestId('mobile-hub-ota-sha')).toHaveTextContent(
			'abcdef012345…'
		);
		expect(
			within(strip).getByTestId('mobile-hub-ota-published-at')
		).not.toHaveTextContent('—');
		expect(
			within(strip).getByTestId('mobile-hub-ota-active-devices')
		).toHaveTextContent('1');
		expect(
			within(strip).getByTestId('mobile-hub-ota-edge-aggregate')
		).toHaveAttribute('data-edge-worst', 'synced');
		expect(
			within(strip).getByTestId('mobile-hub-ota-edge-last-sync')
		).toHaveTextContent(/Последняя синхронизация|Last sync/);
	});

	it('renders localized mobile history event labels', async () => {
		const fetchMock = vi.mocked(fetchMobileAppOverview);
		fetchMock.mockResolvedValue({
			...overview,
			login_history: [
				{
					event_type: 'sso_login_seen',
					created_at: '2026-05-29T00:00:00Z',
					ip_address: '10.0.0.5',
					user_agent: null,
					client_id: 'empery-mobile',
				},
			],
		});

		render(<MobileAppHubPanel />);

		expect(
			await screen.findByText(/Вход SSO замечен|SSO login seen/)
		).toBeInTheDocument();
		expect(screen.queryByText('sso_login_seen')).not.toBeInTheDocument();
	});

	it('shows trusted-device warning without hiding overview when device list fails', async () => {
		vi.mocked(fetchMobileAppOverview).mockResolvedValue(overview);
		vi.mocked(fetchMobileTrustedDevices).mockRejectedValueOnce(
			new Error('devices offline')
		);

		render(<MobileAppHubPanel />);

		expect(
			await screen.findByText(
				/Событий мобильного канала пока нет|No mobile-channel events yet/
			)
		).toBeInTheDocument();
		expect(
			await screen.findByText(
				/Список доверенных телефонов недоступен|Trusted phone list is unavailable/
			)
		).toBeInTheDocument();
		expect(
			screen.getByText(
				/Доверенные телефоны ещё не привязаны|No trusted phones are bound yet/
			)
		).toBeInTheDocument();
	});

	it('renders bound trusted device after list refresh', async () => {
		vi.mocked(fetchMobileAppOverview).mockResolvedValue(overview);
		vi.mocked(fetchMobileTrustedDevices)
			.mockResolvedValueOnce({ items: [] })
			.mockResolvedValueOnce({
				items: [
					trustedDeviceFixture({
						wg_edge_sync_status: 'pending',
						wg_edge_synced_at: null,
					}),
				],
			});

		render(<MobileAppHubPanel />);

		expect(
			await screen.findByText(
				/Доверенные телефоны ещё не привязаны|No trusted phones are bound yet/
			)
		).toBeInTheDocument();

		const refreshButtons = screen.getAllByRole('button', {
			name: /Обновить|Refresh/i,
		});
		fireEvent.click(refreshButtons[0] as HTMLElement);

		expect(await screen.findByText('HUAWEI GOA-LX9')).toBeInTheDocument();
		expect(
			screen.getByText(/Телефон привязан|Phone bound/)
		).toBeInTheDocument();
		const edgeBadge = screen.getByTestId('trusted-device-edge-sync-badge');
		expect(edgeBadge).toHaveAttribute('data-edge-sync-status', 'pending');
		expect(edgeBadge).toHaveTextContent(
			/VPN на сервере: синхронизируется|Server VPN: syncing/
		);
		expect(
			screen.getByText(/Config на телефоне готов|Phone config ready/)
		).toBeInTheDocument();
	});

	it('shows synced edge status and last sync time when API reports synced', async () => {
		vi.mocked(fetchMobileAppOverview).mockResolvedValue(overview);
		vi.mocked(fetchMobileTrustedDevices).mockResolvedValue({
			items: [trustedDeviceFixture()],
		});

		render(<MobileAppHubPanel />);

		expect(await screen.findByText('HUAWEI GOA-LX9')).toBeInTheDocument();
		const edgeBadge = screen.getByTestId('trusted-device-edge-sync-badge');
		expect(edgeBadge).toHaveAttribute('data-edge-sync-status', 'synced');
		expect(edgeBadge).toHaveTextContent(
			/VPN на сервере: готов|Server VPN: ready/
		);
		expect(
			screen.getByTestId('trusted-device-edge-synced-at')
		).toHaveTextContent(/Последняя синхронизация|Last sync/);
	});

	it('shows pairing code after create even when a stale active device row exists', async () => {
		vi.mocked(fetchMobileAppOverview).mockResolvedValue(overview);
		vi.mocked(fetchMobileTrustedDevices).mockResolvedValue({
			items: [
				trustedDeviceFixture({
					id: 'ghost-device-id',
					stable_device_id: 'phone-ghost',
					device_label: 'HONOR VNE-LX1',
					gaf_public_key_fingerprint: null,
					approved_at: '2026-06-17T10:00:00+10:00',
				}),
			],
		});
		vi.mocked(createMobilePairingChallenge).mockResolvedValue({
			challenge_id: 'challenge-1',
			pairing_code: '12345678',
			challenge_nonce: 'nonce',
			expires_at: '2099-01-01T00:00:00Z',
			qr_payload: {},
		});

		render(<MobileAppHubPanel />);

		await screen.findByText('HONOR VNE-LX1');

		fireEvent.click(
			screen.getByRole('button', {
				name: /Создать код привязки|Create pairing code/i,
			})
		);

		expect(
			await screen.findByTestId('trusted-device-pairing-code-value')
		).toHaveTextContent('12345678');
	});
});
