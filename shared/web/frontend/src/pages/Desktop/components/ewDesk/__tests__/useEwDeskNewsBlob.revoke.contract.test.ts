/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EWDesk news blob URLs: unmount must not revoke while React Query still
 * caches the URL; cache removal must revoke.
 *
 * Invariants:
 * - Shared list/detail remounts reuse the same object URL.
 * - Unmounting one observer must not revoke while another is mounted.
 * - Refetch must not revoke the URL still shown by observers.
 * - `removeQueries` / `clear` on the blob key revokes cached URLs.
 *
 * Related:
 * - useEwDeskNewsBlob.ts, EwDeskNewsMedia.tsx
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/services/api/client', () => ({
	api: {
		get: (...args: unknown[]) => apiGet(...args),
	},
}));

import {
	ewDeskNewsBlobQueryKey,
	ewDeskNewsBlobQueryOptions,
} from '../ewDeskNewsQueryOptions';
import {
	resetEwDeskNewsBlobRevokeRegistryForTests,
	useEwDeskNewsBlob,
} from '../useEwDeskNewsBlob';

const BLOB_PATH = '/api/v1/product-desktop/news-linked-image/content-1';

function createWrapper(qc: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client: qc }, children);
	};
}

describe('ewDeskNewsBlobQueryOptions refetch policy', () => {
	it('does not refetch blobs on focus, reconnect, or remount', () => {
		const opts = ewDeskNewsBlobQueryOptions('k', async () => 'blob:x');
		expect(opts.refetchOnWindowFocus).toBe(false);
		expect(opts.refetchOnReconnect).toBe(false);
		expect(opts.refetchOnMount).toBe(false);
	});
});

describe('useEwDeskNewsBlob revoke vs cache', () => {
	const createObjectURL = vi.fn();
	const revokeObjectURL = vi.fn();
	let qc: QueryClient;
	let blobSeq = 0;

	beforeEach(() => {
		resetEwDeskNewsBlobRevokeRegistryForTests();
		blobSeq = 0;
		createObjectURL.mockImplementation(() => {
			blobSeq += 1;
			return `blob:https://app.eliteew.ru/news-blob-${blobSeq}`;
		});
		createObjectURL.mockClear();
		revokeObjectURL.mockClear();
		vi.stubGlobal('URL', {
			...URL,
			createObjectURL,
			revokeObjectURL,
		});
		apiGet.mockResolvedValue(new Blob(['img'], { type: 'image/webp' }));
		qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
	});

	afterEach(() => {
		qc.clear();
		resetEwDeskNewsBlobRevokeRegistryForTests();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('keeps the object URL after unmount so a remount can reuse the cache', async () => {
		const { result, unmount } = renderHook(() => useEwDeskNewsBlob(BLOB_PATH), {
			wrapper: createWrapper(qc),
		});

		await waitFor(() => {
			expect(result.current.blobUrl).toBe(
				'blob:https://app.eliteew.ru/news-blob-1'
			);
		});
		expect(createObjectURL).toHaveBeenCalledTimes(1);

		unmount();
		expect(revokeObjectURL).not.toHaveBeenCalled();

		const remount = renderHook(() => useEwDeskNewsBlob(BLOB_PATH), {
			wrapper: createWrapper(qc),
		});
		await waitFor(() => {
			expect(remount.result.current.blobUrl).toBe(
				'blob:https://app.eliteew.ru/news-blob-1'
			);
		});
		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(apiGet).toHaveBeenCalledTimes(1);
		remount.unmount();
	});

	it('revokes the object URL when the blob query is removed from cache', async () => {
		const { result, unmount } = renderHook(() => useEwDeskNewsBlob(BLOB_PATH), {
			wrapper: createWrapper(qc),
		});

		await waitFor(() => {
			expect(result.current.blobUrl).toBe(
				'blob:https://app.eliteew.ru/news-blob-1'
			);
		});

		unmount();
		qc.removeQueries({ queryKey: ewDeskNewsBlobQueryKey(BLOB_PATH) });
		expect(revokeObjectURL).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).toHaveBeenCalledWith(
			'blob:https://app.eliteew.ru/news-blob-1'
		);
	});

	it('does not revoke when one of two observers unmounts', async () => {
		const list = renderHook(() => useEwDeskNewsBlob(BLOB_PATH), {
			wrapper: createWrapper(qc),
		});
		const detail = renderHook(() => useEwDeskNewsBlob(BLOB_PATH), {
			wrapper: createWrapper(qc),
		});

		await waitFor(() => {
			expect(list.result.current.blobUrl).toBe(
				'blob:https://app.eliteew.ru/news-blob-1'
			);
			expect(detail.result.current.blobUrl).toBe(
				'blob:https://app.eliteew.ru/news-blob-1'
			);
		});

		list.unmount();
		expect(revokeObjectURL).not.toHaveBeenCalled();
		expect(detail.result.current.blobUrl).toBe(
			'blob:https://app.eliteew.ru/news-blob-1'
		);
		detail.unmount();
		expect(revokeObjectURL).not.toHaveBeenCalled();
	});

	it('does not revoke the live URL when the blob query refetches', async () => {
		const { result, unmount } = renderHook(() => useEwDeskNewsBlob(BLOB_PATH), {
			wrapper: createWrapper(qc),
		});

		await waitFor(() => {
			expect(result.current.blobUrl).toBe(
				'blob:https://app.eliteew.ru/news-blob-1'
			);
		});

		await qc.refetchQueries({ queryKey: ewDeskNewsBlobQueryKey(BLOB_PATH) });
		await waitFor(() => {
			expect(result.current.blobUrl).toBe(
				'blob:https://app.eliteew.ru/news-blob-2'
			);
		});
		expect(revokeObjectURL).not.toHaveBeenCalled();

		unmount();
		qc.removeQueries({ queryKey: ewDeskNewsBlobQueryKey(BLOB_PATH) });
		expect(revokeObjectURL).toHaveBeenCalledTimes(2);
		expect(revokeObjectURL).toHaveBeenCalledWith(
			'blob:https://app.eliteew.ru/news-blob-1'
		);
		expect(revokeObjectURL).toHaveBeenCalledWith(
			'blob:https://app.eliteew.ru/news-blob-2'
		);
	});

	it('revokes when the query client is cleared', async () => {
		const { result, unmount } = renderHook(() => useEwDeskNewsBlob(BLOB_PATH), {
			wrapper: createWrapper(qc),
		});

		await waitFor(() => {
			expect(result.current.blobUrl).toBe(
				'blob:https://app.eliteew.ru/news-blob-1'
			);
		});

		unmount();
		qc.clear();
		expect(revokeObjectURL).toHaveBeenCalledWith(
			'blob:https://app.eliteew.ru/news-blob-1'
		);
	});
});
