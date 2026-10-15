/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for planned maintenance state normalization and global publication.
 *
 * Invariants:
 * - Maintenance 503 payloads become active browser state.
 * - Completed windows are terminal and not active.
 *
 * Related:
 * - `services/maintenance/maintenanceState.ts`
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createUnplannedMaintenanceStatus,
	fetchMaintenanceStatus,
	getCurrentMaintenanceStatus,
	isMaintenanceGatePhase,
	maintenanceStatusFromHttpError,
	normalizeMaintenanceStatus,
	publishMaintenanceStatus,
} from '../maintenanceState';

describe('maintenanceState', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('normalizes an active maintenance status', () => {
		const status = normalizeMaintenanceStatus({
			active: true,
			window: {
				id: 'restart-1',
				phase: 'active',
				retry_after_seconds: 120,
				title: 'Короткое обслуживание',
				message: 'Скоро вернёмся.',
			},
		});

		expect(status.active).toBe(true);
		expect(status.window?.id).toBe('restart-1');
		expect(isMaintenanceGatePhase(status)).toBe(true);
		expect(status.window?.user_impact).toBe('Вкладку можно оставить открытой.');
	});

	it('keeps completed windows terminal but inactive', () => {
		const status = normalizeMaintenanceStatus({
			active: false,
			window: {
				id: 'restart-1',
				phase: 'completed',
			},
		});

		expect(status.active).toBe(false);
		expect(status.window?.phase).toBe('completed');
	});

	it('publishes maintenance state from HTTP 503 body', () => {
		const status = maintenanceStatusFromHttpError({
			code: 'maintenance',
			window_id: 'http-503',
			phase: 'draining',
			retry_after: 45,
			title: 'Обслуживание',
			detail: 'Пауза связи.',
		});

		publishMaintenanceStatus(status);

		expect(getCurrentMaintenanceStatus().window?.id).toBe('http-503');
		expect(getCurrentMaintenanceStatus().active).toBe(true);
	});

	it('creates a calm unplanned fallback state for upstream outages', () => {
		const status = createUnplannedMaintenanceStatus('http-502', 90);

		expect(status.active).toBe(true);
		expect(status.window?.id).toBe('unplanned-http-502');
		expect(status.window?.kind).toBe('emergency');
		expect(status.window?.retry_after_seconds).toBe(90);
		expect(status.window?.suppress_error_toasts).toBe(true);
		expect(status.window?.title).toBe('EliteEW восстанавливает связь');
		expect(status.window?.affected_services).toContain('Безраздельный мир');
	});

	it('throws on maintenance API 5xx so static fallback is only used on outages', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('{}', { status: 503 }))
		);

		await expect(fetchMaintenanceStatus()).rejects.toThrow(
			'maintenance API unavailable: 503'
		);
	});

	it('coalesces concurrent fetchMaintenanceStatus into a single HTTP GET', async () => {
		let resolveFetch: (value: Response) => void = () => {};
		const fetchMock = vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				})
		);
		vi.stubGlobal('fetch', fetchMock);

		const p1 = fetchMaintenanceStatus();
		const p2 = fetchMaintenanceStatus();
		expect(fetchMock).toHaveBeenCalledTimes(1);

		resolveFetch(
			new Response(JSON.stringify({ active: false, window: null }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		);

		const [a, b] = await Promise.all([p1, p2]);
		expect(a.active).toBe(false);
		expect(b.active).toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('reuses a fresh successful maintenance response without a new GET', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ active: false, window: null }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
		);
		vi.stubGlobal('fetch', fetchMock);

		const { fetchMaintenanceStatusIfStale } = await import(
			'../maintenanceState'
		);
		await fetchMaintenanceStatus();
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const reused = await fetchMaintenanceStatusIfStale(60_000);
		expect(reused.active).toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
