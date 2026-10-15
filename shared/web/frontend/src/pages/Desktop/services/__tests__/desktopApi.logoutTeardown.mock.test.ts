/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Assert logout teardown hook invokes music IDB cache clear helper.
 *
 * Invariants:
 * - Mocks musicAudioBlobCache only; no network.
 *
 * Related:
 * - src/pages/Desktop/services/desktopApi.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearCachedAudioBlobsMock = vi.hoisted(() =>
	vi.fn().mockResolvedValue(undefined)
);

vi.mock('../../utils/musicAudioBlobCache', () => ({
	clearCachedAudioBlobs: clearCachedAudioBlobsMock,
	getCachedAudioBlob: vi.fn(),
	putCachedAudioBlob: vi.fn(),
}));

const flushAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('desktopApi logout teardown — music IDB hook', () => {
	beforeEach(() => {
		clearCachedAudioBlobsMock.mockClear();
	});

	it('clearDesktopShellStateCache invokes clearCachedAudioBlobs', async () => {
		const { clearDesktopShellStateCache } = await import('../desktopApi');
		clearDesktopShellStateCache();
		await flushAsync();
		expect(clearCachedAudioBlobsMock).toHaveBeenCalledOnce();
	});
});
