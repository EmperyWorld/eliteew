/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for companion music result card (U4 music card).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
	CompanionOperationMusicCard,
	buildMusicPlayTrackAction,
} from '@/features/ewa/companionOperations/CompanionOperationMusicCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string>) => {
			if (key === 'ewaCompanion.operationTrackUntitled') return 'Untitled';
			if (key === 'ewaCompanion.operationsPlayReadyTrackNow') return 'Play now';
			if (key === 'ewaCompanion.operationsPlayReadyTrack') return 'Ask to play';
			if (key === 'ewaCompanion.operationsMusicCardAria')
				return `Track ${params?.name ?? ''}`;
			if (key === 'ewaCompanion.operationsMusicCoverAlt')
				return `Cover ${params?.name ?? ''}`;
			return key;
		},
	}),
}));

describe('buildMusicPlayTrackAction', () => {
	it('maps ready track to music_play_track action', () => {
		expect(
			buildMusicPlayTrackAction({
				unifiedContentId: 'uc-1',
				trackName: 'Neon Sky',
				thumbnailUrl: 'https://example.com/cover.png',
			})
		).toEqual({
			type: 'music_play_track',
			unified_content_id: 'uc-1',
			track_name: 'Neon Sky',
			thumbnail_url: 'https://example.com/cover.png',
		});
	});
});

describe('CompanionOperationMusicCard', () => {
	it('renders cover and dispatches play action', () => {
		const onPlayTrack = vi.fn();
		render(
			<CompanionOperationMusicCard
				track={{
					unifiedContentId: 'uc-9',
					trackName: 'Sunrise',
					thumbnailUrl: 'https://example.com/sunrise.png',
				}}
				onPlayTrack={onPlayTrack}
			/>
		);
		expect(screen.getByAltText('Cover Sunrise')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Play now' }));
		expect(onPlayTrack).toHaveBeenCalledWith({
			type: 'music_play_track',
			unified_content_id: 'uc-9',
			track_name: 'Sunrise',
			thumbnail_url: 'https://example.com/sunrise.png',
		});
	});
});
