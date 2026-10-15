import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FilePreviewModal } from '../FilePreviewModal';

const { mockGet } = vi.hoisted(() => ({
	mockGet: vi.fn(),
}));

vi.mock('@/services/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/services/api/client')>();
	return {
		...actual,
		api: {
			...actual.api,
			get: mockGet,
		},
	};
});

vi.mock('@/components/ui/ModalAdvanced', () => ({
	ModalAdvanced: ({
		children,
		footer,
		title,
	}: {
		children: ReactNode;
		footer?: ReactNode;
		title: string;
	}) => (
		<div>
			<h2>{title}</h2>
			{children}
			{footer}
		</div>
	),
}));

describe('FilePreviewModal', () => {
	it('loads image blob and exposes download control', async () => {
		mockGet.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));

		const onClose = vi.fn();
		render(
			<FilePreviewModal
				contentId="c1"
				name="shot.png"
				content_type="image"
				onClose={onClose}
			/>
		);

		await waitFor(() => {
			expect(screen.getByRole('img', { name: 'shot.png' })).toBeInTheDocument();
		});

		const download = screen.getByRole('button', { name: /скачать/i });
		expect(download).toBeInTheDocument();

		mockGet.mockResolvedValue(new Blob(['y'], { type: 'image/png' }));
		fireEvent.click(download);
		expect(mockGet).toHaveBeenCalledWith(
			'/content/c1/download',
			expect.objectContaining({
				baseURL: '/api/v1',
				responseType: 'blob',
			})
		);
	});
});
