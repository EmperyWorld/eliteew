/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for global maintenance UX: a single calm notification per maintenance window.
 *
 * Invariants:
 * - Phase changes inside one maintenance window must not create a Sonner toast storm.
 * - Notification copy must not tell users to manually reload during automatic recovery.
 *
 * Related:
 * - src/contexts/MaintenanceContext.tsx
 * - src/services/maintenance/maintenanceState.ts
 */
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceProvider } from '@/contexts/MaintenanceContext';
import {
	clearMaintenanceStatus,
	publishMaintenanceStatus,
} from '@/services/maintenance/maintenanceState';

const notifyMock = vi.hoisted(() => ({
	info: vi.fn(),
	warning: vi.fn(),
}));

vi.mock('@/notifications', () => ({
	notify: notifyMock,
}));

vi.mock('@/utils/staleBundleReload', () => ({
	reloadAllAppTabs: vi.fn(),
	requestMaintenanceReturn: vi.fn(),
	markMaintenanceCompletionReload: vi.fn(() => true),
}));

vi.mock('@/services/maintenance/reloadCircuitBreaker', () => ({
	isBackendReadyForRecovery: vi.fn(async () => false),
	isReloadHoldActive: vi.fn(() => false),
	shouldBlockAutoReload: vi.fn(() => false),
	clearReloadCircuitWhenHealthy: vi.fn(async () => false),
	performRecoveryConnectionCheck: vi.fn(async () => false),
}));

vi.mock('@/services', () => ({
	Services: {
		socket: {
			addEventListener: vi.fn(() => () => undefined),
		},
	},
}));

function publishWindow(phase: 'warning' | 'active'): void {
	publishMaintenanceStatus({
		active: true,
		window: {
			id: 'deploy-one',
			kind: 'stack0_restart',
			phase,
			active: true,
			retry_after_seconds: 60,
			title: 'EliteEW обновляет среду',
			message:
				'Безраздельный мир временно на технической паузе. Данные, окна и раскладка сохранены.',
			user_impact:
				'Оставьте вкладку открытой: Безраздельный мир восстановится автоматически, данные и раскладка сохранены.',
		},
	});
}

describe('MaintenanceProvider notifications', () => {
	beforeEach(() => {
		clearMaintenanceStatus();
		notifyMock.info.mockClear();
		notifyMock.warning.mockClear();
		vi.stubGlobal(
			'fetch',
			vi.fn(() => new Promise<Response>(() => undefined))
		);
	});

	afterEach(() => {
		clearMaintenanceStatus();
		vi.unstubAllGlobals();
	});

	it('keeps one notification for phase changes inside the same window', async () => {
		render(
			<MaintenanceProvider>
				<div>app</div>
			</MaintenanceProvider>
		);

		act(() => publishWindow('warning'));

		await waitFor(() => expect(notifyMock.warning).toHaveBeenCalledTimes(1));
		expect(notifyMock.warning.mock.calls[0]?.[0]).toBe('Запланировано');
		expect(notifyMock.warning.mock.calls[0]?.[1]).toContain(
			'Безраздельный мир восстановится автоматически'
		);
		expect(notifyMock.warning.mock.calls[0]?.[1]).not.toContain(
			'ручная проверка'
		);

		act(() => publishWindow('active'));

		await waitFor(() => expect(notifyMock.warning).toHaveBeenCalledTimes(1));
	});

	it('does not reload on completed phase while backend health is down', async () => {
		const { requestMaintenanceReturn } = await import(
			'@/utils/staleBundleReload'
		);

		render(
			<MaintenanceProvider>
				<div>app</div>
			</MaintenanceProvider>
		);

		act(() => publishWindow('active'));

		act(() =>
			publishMaintenanceStatus({
				active: false,
				window: {
					id: 'deploy-one',
					kind: 'stack0_restart',
					phase: 'completed',
					active: false,
				},
			})
		);

		await waitFor(() =>
			expect(requestMaintenanceReturn).not.toHaveBeenCalled()
		);
		expect(notifyMock.info).not.toHaveBeenCalled();
	});
});
