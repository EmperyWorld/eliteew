import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileId } from '../../../types/fileExchange';
import { useDocumentFileExchange } from './useDocumentFileExchange';

const { apiGetMock, apiPostMock, convertUploadMock } = vi.hoisted(() => ({
	apiGetMock: vi.fn(),
	apiPostMock: vi.fn(),
	convertUploadMock: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
	apiClient: {
		get: apiGetMock,
		post: apiPostMock,
	},
}));

vi.mock('../utils/convertUploadedFileViaDocEditor', () => ({
	convertUploadedFileViaDocEditor: convertUploadMock,
}));

vi.mock('../../../hooks/useFileUpload', () => ({
	useFileUpload: () => ({
		uploadFile: vi.fn(),
		uploading: false,
		progress: 0,
		error: null,
	}),
}));

vi.mock('../../../hooks/useFileData', () => ({
	useFileData: () => ({
		loading: false,
		data: null,
		error: null,
	}),
}));

vi.mock('../../../services/contentApi', () => ({
	contentApi: {
		createContent: vi.fn(),
		updateContent: vi.fn(),
		getVersions: vi.fn(),
		restoreVersion: vi.fn(),
	},
}));

vi.mock('../../../utils/logger', () => ({
	log: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

describe('useDocumentFileExchange', () => {
	beforeEach(() => {
		apiGetMock.mockReset();
		apiPostMock.mockReset();
		convertUploadMock.mockReset();
	});

	it('loads unified content document and clears load errors', async () => {
		apiGetMock
			.mockResolvedValueOnce({
				data: {
					name: 'Doc title',
					file_size: 42,
					content_type: 'document',
					mime_type: 'text/html',
				},
			})
			.mockResolvedValueOnce({
				data: new Blob(['<p>Hello</p>'], { type: 'text/html' }),
			});

		const { result } = renderHook(() => useDocumentFileExchange());
		await act(async () => {
			await result.current.loadDocumentById(createFileId('uc-1'));
		});

		expect(result.current.error).toBeNull();
		expect(result.current.errorCode).toBeNull();
		expect(result.current.currentFileId).toBe(createFileId('uc-1'));
		expect(result.current.currentContent?.title).toBe('Doc title');
		expect(result.current.currentContent?.storageFileName).toBe('Doc title');
		expect(result.current.currentContent?.html).toContain('<p>Hello</p>');
	});

	it('uses original_filename for storageFileName when name has no extension', async () => {
		apiGetMock
			.mockResolvedValueOnce({
				data: {
					name: 'desktop_file_test',
					original_filename: 'desktop_file_test.md',
					file_size: 10,
					content_type: 'document',
					mime_type: 'text/html',
				},
			})
			.mockResolvedValueOnce({
				data: new Blob(['<p>x</p>'], { type: 'text/html' }),
			});

		const { result } = renderHook(() => useDocumentFileExchange());
		await act(async () => {
			await result.current.loadDocumentById(createFileId('uc-2'));
		});

		expect(result.current.currentContent?.storageFileName).toBe(
			'desktop_file_test.md'
		);
	});

	it('converts docx via Stack4 convert/upload instead of blob.text()', async () => {
		convertUploadMock.mockResolvedValueOnce(
			'<html><body><p>sad &lt;br/&gt;a</p></body></html>'
		);
		apiGetMock
			.mockResolvedValueOnce({
				data: {
					name: 'Contract',
					original_filename: 'contract.docx',
					file_size: 12000,
					content_type: 'document',
					mime_type:
						'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				},
			})
			.mockResolvedValueOnce({
				data: new Blob(['PK\x03\x04'], {
					type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				}),
			});

		const { result } = renderHook(() => useDocumentFileExchange());
		await act(async () => {
			await result.current.loadDocumentById(createFileId('uc-docx'));
		});

		expect(convertUploadMock).toHaveBeenCalledTimes(1);
		expect(result.current.currentContent?.html).toContain('sad');
		expect(result.current.currentContent?.html).toMatch(/<br\s*\/?>/i);
		expect(result.current.currentContent?.html).not.toContain('&lt;br');
		expect(result.current.currentContent?.storageFileName).toBe(
			'contract.docx'
		);
	});

	it('maps 404 and 403 to explicit load error codes', async () => {
		const { result } = renderHook(() => useDocumentFileExchange());

		apiGetMock.mockRejectedValueOnce({ response: { status: 404 } });
		await act(async () => {
			await result.current.loadDocumentById(createFileId('missing'));
		});
		expect(result.current.errorCode).toBe('not_found');
		expect(result.current.error).toBe('Document was not found');

		apiGetMock.mockRejectedValueOnce({ response: { status: 403 } });
		await act(async () => {
			await result.current.loadDocumentById(createFileId('denied'));
		});
		expect(result.current.errorCode).toBe('forbidden');
		expect(result.current.error).toBe('Access denied to this document');

		act(() => {
			result.current.clearLoadError();
		});
		expect(result.current.error).toBeNull();
		expect(result.current.errorCode).toBeNull();
	});
});
