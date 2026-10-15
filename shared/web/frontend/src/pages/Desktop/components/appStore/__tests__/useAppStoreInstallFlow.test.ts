/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for App Store install/uninstall flow hook.
 *
 * Invariants:
 * - One global busy operation; per-card error and success feedback.
 *
 * Related:
 * - useAppStoreInstallFlow.ts
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppStoreInstallFlow } from '../useAppStoreInstallFlow';
import { storeAppFixture } from './storeAppFixture';

const t = ((key: string) => key) as Parameters<
	typeof useAppStoreInstallFlow
>[0]['t'];

describe('useAppStoreInstallFlow', () => {
	const apps = [
		storeAppFixture({
			app_id: 'notes',
			name: 'Notes',
			installed: false,
			app_component: 'NotesApp',
		}),
		storeAppFixture({
			app_id: 'chat',
			name: 'Chat',
			installed: true,
			app_component: 'ChatApp',
		}),
	];

	it('installs app and emits success feedback scoped to app_id', async () => {
		const onInstall = vi.fn().mockResolvedValue(undefined);
		const onSuccess = vi.fn();
		const { result } = renderHook(() =>
			useAppStoreInstallFlow({
				apps,
				onInstall,
				onUninstall: vi.fn(),
				onSuccess,
				t,
			})
		);

		await act(async () => {
			await result.current.handleInstall('notes');
		});

		expect(onInstall).toHaveBeenCalledWith('notes');
		expect(onSuccess).toHaveBeenCalledWith({
			action: 'install',
			appId: 'notes',
			appName: 'Notes',
			appComponent: 'NotesApp',
		});
		expect(result.current.isBusy).toBe(false);
		expect(result.current.getCatalogCardInstallState('notes')).toMatchObject({
			busyHere: false,
			actionBusy: false,
			installErrorMessage: null,
			installFeedback: 'install',
		});
	});

	it('uninstalls when app is already installed', async () => {
		const onUninstall = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useAppStoreInstallFlow({
				apps,
				onInstall: vi.fn(),
				onUninstall,
				t,
			})
		);

		await act(async () => {
			await result.current.handleInstall('chat');
		});

		expect(onUninstall).toHaveBeenCalledWith('chat');
		expect(
			result.current.getCatalogCardInstallState('chat').installFeedback
		).toBe('uninstall');
	});

	it('maps API errors to card-scoped message and onError', async () => {
		const onError = vi.fn();
		const onInstall = vi.fn().mockRejectedValue(new Error('network down'));
		const { result } = renderHook(() =>
			useAppStoreInstallFlow({
				apps,
				onInstall,
				onUninstall: vi.fn(),
				onError,
				t,
			})
		);

		await act(async () => {
			await result.current.handleInstall('notes');
		});

		expect(onError).toHaveBeenCalledWith('error.installFailed');
		expect(result.current.getCatalogCardInstallState('notes')).toMatchObject({
			installErrorMessage: 'error.installFailed',
			installFeedback: null,
		});
	});

	it('clearInstallError resets card error state', async () => {
		const onInstall = vi.fn().mockRejectedValue(new Error('fail'));
		const { result } = renderHook(() =>
			useAppStoreInstallFlow({
				apps,
				onInstall,
				onUninstall: vi.fn(),
				t,
			})
		);

		await act(async () => {
			await result.current.handleInstall('notes');
		});
		act(() => {
			result.current.clearInstallError();
		});

		expect(
			result.current.getCatalogCardInstallState('notes').installErrorMessage
		).toBeNull();
	});

	it('ignores unknown app_id', async () => {
		const onInstall = vi.fn();
		const { result } = renderHook(() =>
			useAppStoreInstallFlow({
				apps,
				onInstall,
				onUninstall: vi.fn(),
				t,
			})
		);

		await act(async () => {
			await result.current.handleInstall('missing');
		});

		expect(onInstall).not.toHaveBeenCalled();
	});

	it('clears install feedback after timeout', async () => {
		vi.useFakeTimers();
		const onInstall = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useAppStoreInstallFlow({
				apps,
				onInstall,
				onUninstall: vi.fn(),
				t,
			})
		);

		await act(async () => {
			await result.current.handleInstall('notes');
		});
		expect(
			result.current.getCatalogCardInstallState('notes').installFeedback
		).toBe('install');

		await act(async () => {
			vi.advanceTimersByTime(2400);
		});
		expect(
			result.current.getCatalogCardInstallState('notes').installFeedback
		).toBeNull();
		vi.useRealTimers();
	});
});
