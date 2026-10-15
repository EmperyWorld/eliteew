/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest: useCompanionViewPrefs is the React SSOT — one write notifies subscribers
 * and both consumers see the same lifecycle without local mirrors.
 *
 * Related:
 * - src/pages/Desktop/shell/useCompanionViewPrefs.ts
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md Part B
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	dismissCompanionRunInSurfaceLifecycle,
	loadCompanionSurfaceLifecycleState,
} from '@/features/ewa/companionOutputSurface/companionSurfaceLifecycle';
import { subscribeShellLifecycle } from '@/pages/Desktop/shell/shellLifecycleManager';
import { useCompanionViewPrefs } from '@/pages/Desktop/shell/useCompanionViewPrefs';

describe('useCompanionViewPrefs', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it('one write path updates both hook consumers and subscribe fires once per save', () => {
		const notifySpy = vi.fn();
		const { result: a } = renderHook(() => useCompanionViewPrefs('p-ssot'));
		const { result: b } = renderHook(() => useCompanionViewPrefs('p-ssot'));

		const unsub = subscribeShellLifecycle(notifySpy);

		act(() => {
			a.current.dispatchLifecycle({ type: 'close', id: 'task_run:run-1' });
		});

		expect(a.current.lifecycle.dismissedIds).toContain('task_run:run-1');
		expect(b.current.lifecycle.dismissedIds).toContain('task_run:run-1');
		expect(loadCompanionSurfaceLifecycleState('p-ssot').dismissedIds).toContain(
			'task_run:run-1'
		);
		expect(notifySpy).toHaveBeenCalledTimes(1);
		expect(notifySpy).toHaveBeenCalledWith('p-ssot');
		unsub();
	});

	it('external SLM write refreshes subscribed hooks', () => {
		const { result } = renderHook(() => useCompanionViewPrefs('p-ext'));
		act(() => {
			dismissCompanionRunInSurfaceLifecycle('p-ext', 'run-z');
		});
		expect(result.current.lifecycle.dismissedIds).toContain('run:run-z');
	});

	it('merges in-memory prefs when principal goes from empty to real id', () => {
		const { result, rerender } = renderHook(
			({ pid }: { pid: string }) => useCompanionViewPrefs(pid),
			{ initialProps: { pid: '' } }
		);
		act(() => {
			result.current.dispatchLifecycle({ type: 'pin', id: 'task_run:pre' });
		});
		expect(result.current.lifecycle.pinnedIds).toContain('task_run:pre');
		rerender({ pid: 'p-merge' });
		expect(result.current.lifecycle.pinnedIds).toContain('task_run:pre');
		expect(loadCompanionSurfaceLifecycleState('p-merge').pinnedIds).toContain(
			'task_run:pre'
		);
	});
});
