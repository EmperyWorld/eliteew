/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests Content Manager upload orchestration hook (success, partial failure, dedup, folder scope).
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useContentManagerUploadOrchestration } from './useContentManagerUploadOrchestration';

vi.mock('../../../services/contentApi', () => ({
	contentApi: {
		uploadContent: vi.fn(),
	},
}));

vi.mock('../../../notifications', () => ({
	notify: {
		error: vi.fn(),
		warning: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock('../../../services/unifiedContentEvents', () => ({
	requestDesktopFolderLibraryCountsInvalidate: vi.fn(),
}));

import { contentApi } from '../../../services/contentApi';
import { notify } from '../../../notifications';

const t = ((key: string, opts?: Record<string, unknown>) => {
	if (opts) {
		return `${key}:${JSON.stringify(opts)}`;
	}
	return key;
}) as never;

function makeFile(name: string): File {
	return new File(['x'], name, { type: 'text/plain' });
}

describe('useContentManagerUploadOrchestration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('uploads single file with folder_item_id in query', async () => {
		vi.mocked(contentApi.uploadContent).mockResolvedValue({
			id: 'c1',
			deduplicated_reused: false,
		} as never);

		const onUploadSuccess = vi.fn();
		const setError = vi.fn();
		const setSuccess = vi.fn();

		const { result } = renderHook(() =>
			useContentManagerUploadOrchestration({
				t,
				uploadScope: {
					folderItemId: 'folder-a',
					companyId: 'co-1',
					projectId: 'proj-1',
				},
				onUploadSuccess,
				setError,
				setSuccess,
			})
		);

		await act(async () => {
			await result.current.uploadFiles([makeFile('a.txt')]);
		});

		expect(contentApi.uploadContent).toHaveBeenCalledWith(
			expect.any(File),
			expect.objectContaining({
				name: 'a.txt',
				folder_item_id: 'folder-a',
				company_id: 'co-1',
				project_id: 'proj-1',
			}),
			expect.any(Object)
		);
		expect(onUploadSuccess).toHaveBeenCalled();
		expect(setSuccess).toHaveBeenCalled();
	});

	it('reports partial failure for batch upload', async () => {
		vi.mocked(contentApi.uploadContent)
			.mockResolvedValueOnce({ id: 'c1', deduplicated_reused: false } as never)
			.mockRejectedValueOnce(new Error('fail two'));

		const onUploadSuccess = vi.fn();
		const { result } = renderHook(() =>
			useContentManagerUploadOrchestration({
				t,
				uploadScope: { folderItemId: null },
				onUploadSuccess,
				setError: vi.fn(),
				setSuccess: vi.fn(),
			})
		);

		await act(async () => {
			await result.current.uploadFiles([
				makeFile('ok.txt'),
				makeFile('bad.txt'),
			]);
		});

		await waitFor(() => {
			expect(result.current.queue.some((q) => q.status === 'failed')).toBe(
				true
			);
		});
		expect(notify.warning).toHaveBeenCalled();
		expect(onUploadSuccess).toHaveBeenCalled();
	});

	it('retryFile re-uploads failed item only', async () => {
		vi.mocked(contentApi.uploadContent)
			.mockRejectedValueOnce(new Error('first fail'))
			.mockResolvedValueOnce({ id: 'c2', deduplicated_reused: false } as never);

		const { result } = renderHook(() =>
			useContentManagerUploadOrchestration({
				t,
				uploadScope: { folderItemId: null },
				onUploadSuccess: vi.fn(),
				setError: vi.fn(),
				setSuccess: vi.fn(),
			})
		);

		await act(async () => {
			await result.current.uploadFiles([makeFile('retry-me.txt')]);
		});

		const failed = result.current.queue.find((q) => q.status === 'failed');
		expect(failed).toBeDefined();
		if (!failed) {
			throw new Error('expected failed upload queue item');
		}

		await act(async () => {
			await result.current.retryFile(failed.id);
		});

		expect(contentApi.uploadContent).toHaveBeenCalledTimes(2);
	});

	it('shows dedup toast for single deduplicated upload', async () => {
		vi.mocked(contentApi.uploadContent).mockResolvedValue({
			id: 'c1',
			deduplicated_reused: true,
		} as never);

		const setSuccess = vi.fn();
		const { result } = renderHook(() =>
			useContentManagerUploadOrchestration({
				t,
				uploadScope: { folderItemId: null },
				onUploadSuccess: vi.fn(),
				setError: vi.fn(),
				setSuccess,
			})
		);

		await act(async () => {
			await result.current.uploadFiles([makeFile('dup.txt')]);
		});

		expect(setSuccess).toHaveBeenCalledWith(
			expect.stringContaining('pro.toast.uploadedDedup')
		);
	});
});
