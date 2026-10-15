/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for MusicForge admin run helpers.
 */

import { describe, expect, it } from 'vitest';
import {
	formatMusicForgeAdminDuration,
	formatMusicForgeAdminLanguageLabel,
	lyricsFromPayload,
	musicForgeAdminRunStatusTone,
	resultTrackName,
	truncateTableCell,
} from '../musicForgeAdminRunHelpers';

describe('musicForgeAdminRunHelpers', () => {
	it('formats duration as m:ss', () => {
		expect(formatMusicForgeAdminDuration(220)).toBe('3:40');
		expect(formatMusicForgeAdminDuration(0)).toBe('—');
	});

	it('maps run status to admin banner tone', () => {
		expect(musicForgeAdminRunStatusTone('completed').fg).toContain('success');
		expect(musicForgeAdminRunStatusTone('failed').fg).toContain('danger');
	});

	it('reads lyrics and track name from payload bags', () => {
		expect(lyricsFromPayload({ lyrics: 'Line one' })).toBe('Line one');
		expect(resultTrackName({ name: 'Night drive' })).toBe('Night drive');
	});

	it('formats language label and truncates table cells', () => {
		const t = (key: string) =>
			key === 'musicForge.languages.en' ? 'English' : key;
		expect(formatMusicForgeAdminLanguageLabel('en', t)).toBe('English');
		expect(truncateTableCell('abcdefghijklmnop', 8)).toBe('abcdefg…');
	});
});
