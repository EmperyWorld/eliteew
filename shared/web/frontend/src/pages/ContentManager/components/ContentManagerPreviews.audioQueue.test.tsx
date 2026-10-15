/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify Content Manager audio preview can enqueue tracks into global Music Player queue.
 *
 * Invariants:
 * - Queue CTA dispatches normalized desktop enqueue event with canonical content id.
 *
 * Related:
 * - src/pages/ContentManager/components/ContentManagerPreviews.tsx
 * - src/pages/Desktop/utils/desktopDeepLink.ts
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MediaPreview } from './ContentManagerPreviews';
import { DESKTOP_MUSIC_ENQUEUE_TRACK_EVENT } from '@/pages/Desktop/utils/desktopDeepLink';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			key === 'pro.preview.addToMusicQueue' ? 'Add to Music Queue' : key,
	}),
}));

vi.mock('@/components/Audio/AuthenticatedAudioPreview', () => ({
	AuthenticatedAudioPreview: () => (
		<div data-testid="authenticated-audio-preview">audio preview</div>
	),
}));

describe('ContentManager MediaPreview audio queue action', () => {
	it('dispatches enqueue event with content-manager source', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_MUSIC_ENQUEUE_TRACK_EVENT, spy);
		render(
			<MediaPreview
				contentId="audio-123"
				contentRevision="rev-7"
				type="audio"
				name="Demo Track"
			/>
		);
		expect(
			screen.getByTestId('authenticated-audio-preview')
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Add to Music Queue' }));
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toEqual({
			id: 'audio-123',
			name: 'Demo Track',
			thumbnail_url: null,
			version: 'rev-7',
			mime_type: null,
			source_surface: 'content-manager',
		});
		window.removeEventListener(DESKTOP_MUSIC_ENQUEUE_TRACK_EVENT, spy);
	});
});
