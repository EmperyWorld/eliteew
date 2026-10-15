/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify keyboard shortcuts help modal contains documented playback shortcuts.
 *
 * Invariants:
 * - Help modal lists repeat, shuffle and search-focus shortcuts.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerDialogs.tsx
 */

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KeyboardShortcutsHelpModal } from './MusicPlayerDialogs';
import { renderMusicPlayer } from './musicPlayerTestI18n';

describe('KeyboardShortcutsHelpModal', () => {
	it('shows repeat, shuffle and search focus shortcuts', () => {
		renderMusicPlayer(
			<KeyboardShortcutsHelpModal
				open
				titleId="shortcuts-title"
				onClose={vi.fn()}
			/>
		);
		expect(screen.getByText('R')).toBeInTheDocument();
		expect(screen.getByText('S')).toBeInTheDocument();
		expect(screen.getByText(/Ctrl\/Cmd \+ F.*\?/)).toBeInTheDocument();
	});
});
