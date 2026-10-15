/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for Admin factory API client paths (Wave F5).
 *
 * Invariants:
 * - BASE stays under `/api/v1/desktop/admin/factory`.
 *
 * Related:
 * - `pages/Admin/factory/factoryApi.ts`
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('../../../services/api/client', () => ({
	api: {
		get: (...args: unknown[]) => getMock(...args),
		post: (...args: unknown[]) => postMock(...args),
	},
}));

describe('factoryApi contract', () => {
	beforeEach(() => {
		getMock.mockReset();
		postMock.mockReset();
	});

	it('lists intentions at desktop admin factory base', async () => {
		const body = { schema_version: 1, items: [], count: 0 };
		getMock.mockResolvedValueOnce(body);
		const { listFactoryIntentions } = await import('../factory/factoryApi');
		const snap = await listFactoryIntentions();
		expect(getMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/factory/intentions'
		);
		expect(snap).toBe(body);
		expect(snap.count).toBe(0);
	});

	it('reads status and enqueues', async () => {
		getMock.mockResolvedValueOnce({
			schema_version: 1,
			enabled: true,
			autonomous: false,
			assembly: false,
			cli_hint: 'x',
		});
		postMock.mockResolvedValueOnce({
			schema_version: 1,
			item: { id: '1', title: 't', status: 'completed', stage: 'done' },
		});
		const { getFactoryStatus, enqueueFactoryIntention } = await import(
			'../factory/factoryApi'
		);
		const st = await getFactoryStatus();
		expect(getMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/factory/status'
		);
		expect(st.assembly).toBe(false);
		await enqueueFactoryIntention({ title: 't', run_ticks: 3 });
		expect(postMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/factory/intentions',
			expect.objectContaining({ title: 't', run_ticks: 3 })
		);
	});

	it('posts assembly evaluate', async () => {
		postMock.mockResolvedValueOnce({
			schema_version: 1,
			assembly: true,
			result: { verdict: 'PASSED', passed: true },
		});
		const { evaluateFactoryAssembly } = await import('../factory/factoryApi');
		await evaluateFactoryAssembly({ pack_stems: ['notifications'] });
		expect(postMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/factory/assembly/evaluate',
			expect.objectContaining({ pack_stems: ['notifications'] })
		);
	});

	it('posts kill-all', async () => {
		postMock.mockResolvedValueOnce({
			schema_version: 1,
			mode: 'cancel',
			reason: 'admin_kill_switch',
			paused: [],
			cancelled: [{ id: '1', status: 'cancelled' }],
			skipped: [],
			affected: 1,
		});
		const { killAllFactoryIntentions } = await import('../factory/factoryApi');
		await killAllFactoryIntentions({ mode: 'cancel' });
		expect(postMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/factory/intentions/kill-all',
			expect.objectContaining({ mode: 'cancel' })
		);
	});

	it('posts cancel intention', async () => {
		postMock.mockResolvedValueOnce({
			schema_version: 1,
			item: { id: 'abc', status: 'cancelled' },
		});
		const { cancelFactoryIntention } = await import('../factory/factoryApi');
		await cancelFactoryIntention('abc');
		expect(postMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/factory/intentions/abc/cancel',
			{}
		);
	});
});
