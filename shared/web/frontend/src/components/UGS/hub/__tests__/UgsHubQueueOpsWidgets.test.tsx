/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Rendering tests for UGS Hub queue-snapshot operator widgets (panel + compact strip).
 *
 * Invariants:
 * - Warning badges and stale horizon details stay visible for operators.
 * - Panel is unit-tested in isolation (not mounted on Overview).
 *
 * Related:
 * - src/components/UGS/hub/UgsHubQueueOpsPanel.tsx
 * - src/components/UGS/hub/UgsHubQueueOpsStrip.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { UgsQueueOpsSnapshot } from '@/services/api/ugs/queueOps';
import ruUgsHub from '@/i18n/locales/ru/ugsHub.json';
import { UGS_HUB_NS } from '@/i18n/namespaces';
import { UgsHubQueueOpsPanel } from '../UgsHubQueueOpsPanel';
import { UgsHubQueueOpsStrip } from '../UgsHubQueueOpsStrip';
import { useUgsQueueOpsSnapshot } from '@/hooks/api/useUgsQueueOpsSnapshot';
import { UgsHubShellHeader } from '../shell/UgsHubShellHeader';

vi.mock('@/hooks/api/useUgsQueueOpsSnapshot', () => ({
	useUgsQueueOpsSnapshot: vi.fn(),
}));

const useUgsQueueOpsSnapshotMock = vi.mocked(useUgsQueueOpsSnapshot);

let hubI18n: i18n;

beforeAll(async () => {
	hubI18n = i18next.createInstance();
	await hubI18n.use(initReactI18next).init({
		lng: 'ru',
		fallbackLng: 'ru',
		ns: [UGS_HUB_NS],
		defaultNS: UGS_HUB_NS,
		resources: {
			ru: { [UGS_HUB_NS]: ruUgsHub },
		},
	});
});

function renderWithI18n(ui: React.ReactElement) {
	return render(<I18nextProvider i18n={hubI18n}>{ui}</I18nextProvider>);
}

function createSnapshot(): UgsQueueOpsSnapshot {
	return {
		status: 'degraded',
		timestamp: '2026-05-28T00:00:00Z',
		postgres: {
			total_queued: 24,
			dlq_finalized_failed_24h: 3,
			stale_candidates: {
				pending_orphan: 1,
				pending_in_queue: 2,
				processing: 3,
				total: 6,
			},
		},
		operator_slo: {
			level: 'degraded',
			pending_oldest_age_seconds: 900,
			failed_share: 0.2,
			failed_count: 20,
			completed_count: 80,
			stale_total: 6,
			dlq_finalized_failed_24h: 3,
			total_queued: 24,
		},
		rabbitmq: { ok: true, queues: [] },
		redis: { ugs_worker_leases: { available: true, active_leases: 2 } },
		worker_tuning: {
			stale_horizons: {
				pending_orphan_minutes: 30,
				pending_in_queue_hours: 6,
				processing_hours_default: 12,
				processing_hours_music: 24,
				processing_hours_image: 18,
				processing_estimated_multiplier: 6,
			},
		},
		hints: [
			{ level: 'warning', code: 'queue_depth_sustained', message: 'backlog' },
		],
		log_grep: [],
	} as UgsQueueOpsSnapshot;
}

describe('UgsHub queue-ops widgets', () => {
	it('renders compact strip status and opens admin on click', () => {
		const onOpenAdmin = vi.fn();
		useUgsQueueOpsSnapshotMock.mockReturnValue({
			data: createSnapshot(),
			isLoading: false,
		} as unknown as ReturnType<typeof useUgsQueueOpsSnapshot>);

		renderWithI18n(<UgsHubQueueOpsStrip onOpenAdmin={onOpenAdmin} />);

		expect(screen.getByText(/degraded/i)).toBeInTheDocument();
		expect(screen.getByText(/24 в очереди/i)).toBeInTheDocument();
		fireEvent.click(screen.getByTestId('ugs-hub-queue-ops-strip'));
		expect(onOpenAdmin).toHaveBeenCalledTimes(1);
	});

	it('shows warning/prefetch badges and stale horizons in panel details', () => {
		const onOpenAdmin = vi.fn();
		const refetch = vi.fn();
		useUgsQueueOpsSnapshotMock.mockReturnValue({
			data: createSnapshot(),
			isLoading: false,
			isError: false,
			isFetching: false,
			refetch,
		} as unknown as ReturnType<typeof useUgsQueueOpsSnapshot>);

		renderWithI18n(
			<UgsHubQueueOpsPanel onOpenAdmin={onOpenAdmin} tasksPrefetchActive />
		);

		expect(screen.getByText(/1 предупр\./i)).toBeInTheDocument();
		expect(
			screen.getByTestId('ugs-hub-queue-ops-prefetch-active')
		).toBeInTheDocument();
		expect(screen.getByText(ruUgsHub.queueOps.title)).toBeInTheDocument();
		expect(screen.queryByText(/queue-ops/i)).toBeNull();

		fireEvent.click(
			screen.getByRole('button', {
				name: new RegExp(ruUgsHub.queueOps.expand, 'i'),
			})
		);
		expect(
			screen.getByTestId('ugs-hub-queue-ops-stale-horizons')
		).toBeInTheDocument();
		expect(screen.getByText(/30 min/i)).toBeInTheDocument();
		expect(screen.getByText(ruUgsHub.queueOps.metricDlq)).toBeInTheDocument();
		expect(
			screen.getByText(ruUgsHub.queueOps.metricQueueAge)
		).toBeInTheDocument();
		expect(
			screen.getByText(ruUgsHub.queueOps.metricFailShare)
		).toBeInTheDocument();
		expect(screen.getByText(/^15m$/i)).toBeInTheDocument();
		expect(screen.getByText(/^20\.0%$/i)).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', {
				name: new RegExp(ruUgsHub.queueOps.admin, 'i'),
			})
		);
		expect(onOpenAdmin).toHaveBeenCalledTimes(1);
	});

	it('surfaces Redis lease fallback and warning hint for operators', () => {
		useUgsQueueOpsSnapshotMock.mockReturnValue({
			data: {
				...createSnapshot(),
				redis: {
					ugs_worker_leases: {
						available: false,
						active_leases: null,
						error: 'redis unavailable',
					},
				},
				hints: [
					{
						level: 'warning',
						code: 'redis_lease_unavailable',
						message: 'Redis недоступен — PG fallback активен.',
					},
				],
			},
			isLoading: false,
			isError: false,
			isFetching: false,
			refetch: vi.fn(),
		} as unknown as ReturnType<typeof useUgsQueueOpsSnapshot>);

		renderWithI18n(<UgsHubQueueOpsPanel />);

		expect(
			screen.getByText(ruUgsHub.queueOps.metricLeaseFallback)
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', {
				name: new RegExp(ruUgsHub.queueOps.expand, 'i'),
			})
		);
		expect(screen.getByText(/redis_lease_unavailable/i)).toBeInTheDocument();
	});

	it('shows provider degradation alert with admin shortcut', () => {
		const onNavigate = vi.fn();
		renderWithI18n(
			<UgsHubShellHeader
				onNavigate={onNavigate}
				isOnline
				updateIndicator={false}
				pollIntervalSeconds={60}
				lastUpdated={new Date('2026-05-28T00:00:00Z')}
				isBusy={false}
				onManualRefresh={vi.fn()}
				providerHealth={[
					{
						provider_name: 'llama',
						display_label: 'Text channel',
						status: 'degraded',
						response_time: 120,
						last_check: '2026-05-28T00:00:00Z',
						error: 'timeout',
					},
				]}
			/>
		);

		expect(screen.getByTestId('ugs-hub-provider-alert')).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', {
				name: new RegExp(ruUgsHub.shell.adminShortcut, 'i'),
			})
		);
		expect(onNavigate).toHaveBeenCalledWith('ugs-admin');
	});
});
