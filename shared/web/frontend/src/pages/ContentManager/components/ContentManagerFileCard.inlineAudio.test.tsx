/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock: inline audio/video transport clicks must not close card preview.
 *
 * Invariants:
 * - Click on `<audio controls>` while preview open does not call onToggleInlinePreview.
 *
 * Related:
 * - ContentManagerFileCard.tsx
 */

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { FileCard } from './ContentManagerFileCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'en' },
		t: (key: string) => key,
	}),
}));

vi.mock('../../Desktop/context/DesktopShellFrameContext', () => ({
	useDesktopShellFrame: () => null,
}));

vi.mock('../../Desktop/hooks/useRecentFiles', () => ({
	emitDesktopFileOpened: vi.fn(),
}));

vi.mock(
	'../../../components/UnifiedContent/components/ContentThumbnail',
	() => ({
		ContentThumbnail: ({ children }: { children?: React.ReactNode }) => (
			<div data-testid="thumb">{children}</div>
		),
	})
);

const audioItem: ContentItem = {
	id: 'audio-1',
	name: 'track.mp3',
	title: null,
	content_type: 'audio',
	file_size: 2048,
	mime_type: 'audio/mpeg',
	created_at: '2026-08-08T00:00:00Z',
	updated_at: '2026-08-08T00:00:00Z',
	user_id: 'user-1',
	visibility: 'private',
	tags: [],
	original_filename: 'track.mp3',
};

describe('ContentManagerFileCard inline audio', () => {
	it('does not toggle preview when clicking native audio controls', () => {
		const onToggleInlinePreview = vi.fn();
		const { container } = render(
			<FileCard
				item={audioItem}
				filterVisibility="all"
				selected={false}
				selectMode={false}
				onToggleSelect={vi.fn()}
				selectionIndex={0}
				onViewFile={vi.fn()}
				onDownloadFile={vi.fn()}
				onDeleteFile={vi.fn()}
				onEditFile={vi.fn()}
				inlinePreviewBlobUrl="blob:mock-audio"
				inlinePreviewLoading={false}
				onToggleInlinePreview={onToggleInlinePreview}
			/>
		);

		const audio = container.querySelector('audio');
		expect(audio).toBeTruthy();
		fireEvent.click(audio as HTMLAudioElement);
		expect(onToggleInlinePreview).not.toHaveBeenCalled();
	});
});
