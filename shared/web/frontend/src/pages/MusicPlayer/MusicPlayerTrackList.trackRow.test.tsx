/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify localized playback error badge on Music Player track rows.
 *
 * Invariants:
 * - List row shows i18n error badge when `isError` is true.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerTrackList.tsx
 */

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Content } from '../../components/UnifiedContent/types';
import { MusicTrackRow } from './MusicPlayerTrackList';
import { renderMusicPlayer } from './musicPlayerTestI18n';

const track: Content = {
	id: 'track-1',
	name: 'Focus Session',
	content_type: 'audio',
	file_size: null,
	mime_type: 'audio/mpeg',
	created_at: '2026-05-31T00:00:00Z',
	updated_at: '2026-05-31T00:00:00Z',
	user_id: 'u1',
	visibility: 'private',
	tags: [],
	metadata: { duration: 120 },
};

describe('MusicTrackRow playback error badge', () => {
	it('shows localized error badge when playback failed for the row', () => {
		renderMusicPlayer(
			<MusicTrackRow
				item={track}
				index={0}
				listIndex={0}
				isCurrent={false}
				isError
				playing={false}
				isLoading={false}
				strokeWidth={1.5}
				onPlay={vi.fn()}
				onRowContextMenu={vi.fn()}
				isFavorite={false}
				onToggleFavorite={vi.fn()}
				animateEntrance={false}
				density="compact"
			/>
		);
		expect(screen.getByText('Ошибка')).toBeInTheDocument();
	});
});
