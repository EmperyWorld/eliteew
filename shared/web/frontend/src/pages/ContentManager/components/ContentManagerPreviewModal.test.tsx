/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Tests Content Manager preview modal navigation and download callbacks.
 *
 * Invariants:
 * - Previous/next controls call parent navigation without mutating selection.
 * - Download callback receives the resolved file name.
 *
 * Related:
 * - `ContentManagerPreviewModal.tsx`
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { ContentManagerPreviewModal } from './ContentManagerPreviewModal';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'en' },
		t: (key: string, values?: Record<string, unknown>) => {
			if (key === 'pro.preview.position') {
				return `${values?.current} of ${values?.total}`;
			}
			return key;
		},
	}),
}));

vi.mock('./ContentManagerPreviews', () => ({
	MediaPreview: ({ name }: { name: string }) => (
		<div data-testid="media-preview">{name}</div>
	),
	TextPreview: ({ fileName }: { fileName: string }) => (
		<div data-testid="text-preview">{fileName}</div>
	),
}));

beforeAll(() => {
	class MockAudioContext {
		state = 'running';
		resume = vi.fn().mockResolvedValue(undefined);
	}
	(
		globalThis as unknown as { AudioContext: typeof MockAudioContext }
	).AudioContext = MockAudioContext;
});

const item: ContentItem = {
	id: 'content-1',
	name: 'photo.png',
	title: null,
	content_type: 'image',
	file_size: 1024,
	mime_type: 'image/png',
	created_at: '2026-05-28T00:00:00Z',
	updated_at: '2026-05-28T00:00:00Z',
	user_id: 'user-1',
	visibility: 'private',
	tags: [],
	original_filename: 'photo.png',
};

describe('ContentManagerPreviewModal', () => {
	it('renders previous/next controls and supports keyboard navigation', () => {
		const onPrevious = vi.fn();
		const onNext = vi.fn();

		render(
			<ContentManagerPreviewModal
				item={item}
				embedded={false}
				previewViewport={null}
				onClose={vi.fn()}
				formatFileSize={(bytes) => `${bytes} B`}
				resolveContentTypeLabel={(type) => type}
				onDownload={vi.fn()}
				onPrevious={onPrevious}
				onNext={onNext}
				previousDisabled={false}
				nextDisabled={false}
				positionLabel="2 of 5"
			/>
		);

		expect(screen.getByText('2 of 5')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'pro.preview.next' }));
		fireEvent.keyDown(window, { key: 'ArrowLeft' });

		expect(onNext).toHaveBeenCalledTimes(1);
		expect(onPrevious).toHaveBeenCalledTimes(1);
	});

	it('disables unavailable navigation and resolves download name', () => {
		const onDownload = vi.fn();

		render(
			<ContentManagerPreviewModal
				item={item}
				embedded={false}
				previewViewport={null}
				onClose={vi.fn()}
				formatFileSize={(bytes) => `${bytes} B`}
				resolveContentTypeLabel={(type) => type}
				onDownload={onDownload}
				previousDisabled
				nextDisabled
				positionLabel="1 of 1"
			/>
		);

		expect(
			screen.getByRole('button', { name: 'pro.preview.previous' })
		).toBeDisabled();
		expect(
			screen.getByRole('button', { name: 'pro.preview.next' })
		).toBeDisabled();

		fireEvent.click(
			screen.getByRole('button', { name: 'pro.preview.download' })
		);
		expect(onDownload).toHaveBeenCalledWith('content-1', 'photo.png');
	});
});
