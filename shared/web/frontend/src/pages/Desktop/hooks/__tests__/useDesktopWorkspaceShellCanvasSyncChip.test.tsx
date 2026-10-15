/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Edge/negative coverage for Wave A1 shell canvas sync chip merge (412 conflict vs plain errors).
 *
 * Invariants:
 * - Mocks only; no network.
 *
 * Related:
 * - hooks/useDesktopWorkspaceContentOrchestration.ts
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesktopWorkspaceShellCanvasSyncChip } from '../useDesktopWorkspaceContentOrchestration';

vi.mock('../../services/desktopApi', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../services/desktopApi')>();
	return {
		...actual,
		clearDesktopShellStateCache: vi.fn(),
	};
});

vi.mock('../useDesktopShellStatePipelineSync', () => ({
	recoverDesktopShellStateFromPipelineConflict: vi.fn(
		async (fn: () => Promise<void>) => {
			await fn();
		}
	),
}));

describe('useDesktopWorkspaceShellCanvasSyncChip', () => {
	it('returns combined error when expansion error empty', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspaceShellCanvasSyncChip({
				combinedDesktopPersistenceError: 'persist failed',
				expansionError: null,
				staleShellStateConflict: false,
				refreshStorage: vi.fn(),
				expansionRefresh: vi.fn(),
				clearPersistPatchConflict: vi.fn(),
			})
		);
		expect(result.current.canvasSyncPersistenceError).toBe('persist failed');
	});

	it('prefers combined error when staleShellStateConflict (412 path)', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspaceShellCanvasSyncChip({
				combinedDesktopPersistenceError: 'chip',
				expansionError: 'Desktop shell state changed in another session',
				staleShellStateConflict: true,
				refreshStorage: vi.fn(),
				expansionRefresh: vi.fn(),
				clearPersistPatchConflict: vi.fn(),
			})
		);
		expect(result.current.canvasSyncPersistenceError).toBe('chip');
	});

	it('merges non-conflict expansion error with combined', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspaceShellCanvasSyncChip({
				combinedDesktopPersistenceError: 'persist',
				expansionError: 'expansion boom',
				staleShellStateConflict: false,
				refreshStorage: vi.fn(),
				expansionRefresh: vi.fn(),
				clearPersistPatchConflict: vi.fn(),
			})
		);
		expect(result.current.canvasSyncPersistenceError).toBe(
			'persist · expansion boom'
		);
	});

	it('handles null combined + empty expansion (edge)', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspaceShellCanvasSyncChip({
				combinedDesktopPersistenceError: null,
				expansionError: '   ',
				staleShellStateConflict: false,
				refreshStorage: vi.fn(),
				expansionRefresh: vi.fn(),
				clearPersistPatchConflict: vi.fn(),
			})
		);
		expect(result.current.canvasSyncPersistenceError).toBeNull();
	});
});
