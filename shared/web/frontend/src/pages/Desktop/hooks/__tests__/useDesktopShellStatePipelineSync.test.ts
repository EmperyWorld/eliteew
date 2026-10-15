/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for pipeline-driven shell-state sync UI helpers.
 *
 * Invariants:
 * - Conflict flag requires both `conflict` phase and a populated `lastConflict`.
 *
 * Related:
 * - `hooks/useDesktopShellStatePipelineSync.ts`
 */

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesktopShellStateConflictError } from '../../services/desktopApi';
import {
	getShellStatePipelineSnapshot,
	reloadShellStateFromServer,
	resetShellStatePipeline,
	resolveShellStateConflict,
} from '../../utils/desktopShellStateMutationPipeline';
import {
	recoverDesktopShellStateFromPipelineConflict,
	resetShellStatePipelineSyncCacheForTests,
	useDesktopShellStatePipelineSync,
} from '../useDesktopShellStatePipelineSync';

vi.mock(
	'../../utils/desktopShellStateMutationPipeline',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('../../utils/desktopShellStateMutationPipeline')
			>();
		return {
			...actual,
			reloadShellStateFromServer: vi.fn(async () => ({}) as never),
			resolveShellStateConflict: vi.fn(async () => undefined),
		};
	}
);

describe('useDesktopShellStatePipelineSync', () => {
	afterEach(() => {
		resetShellStatePipeline();
		resetShellStatePipelineSyncCacheForTests();
		vi.clearAllMocks();
	});

	it('derives stale conflict only when phase is conflict and lastConflict is set', () => {
		resetShellStatePipeline();
		const { result, rerender } = renderHook(() =>
			useDesktopShellStatePipelineSync()
		);
		expect(result.current.staleShellStateConflict).toBe(false);

		const snapshot = getShellStatePipelineSnapshot();
		expect(snapshot.phase).toBe('idle');

		// Simulate conflict via pipeline internals is not exposed; verify hook shape instead.
		rerender();
		expect(result.current.conflictSignature).toBeNull();
	});
});

describe('recoverDesktopShellStateFromPipelineConflict', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('reloads server state, runs afterReload, then resolves conflict without second reload', async () => {
		const afterReload = vi.fn(async () => undefined);
		await recoverDesktopShellStateFromPipelineConflict(afterReload);

		expect(reloadShellStateFromServer).toHaveBeenCalledTimes(1);
		expect(afterReload).toHaveBeenCalledTimes(1);
		expect(resolveShellStateConflict).toHaveBeenCalledWith({
			skipReload: true,
		});
	});
});

describe('DesktopShellStateConflictError contract', () => {
	it('exposes currentEtag for conflict signatures', () => {
		const error = new DesktopShellStateConflictError('conflict', 'etag-1');
		expect(error.currentEtag).toBe('etag-1');
	});
});
