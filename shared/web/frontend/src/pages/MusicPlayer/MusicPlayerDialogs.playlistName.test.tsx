/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Covers playlist name dialog behavior for create/rename flow in Music Player.
 *
 * Invariants:
 * - Confirm action fires on Enter only when dialog validation allows submission.
 * - Validation copy is visible when parent page passes a message.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerDialogs.tsx
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 */

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PlaylistNameDialog } from './MusicPlayerDialogs';
import { renderMusicPlayer } from './musicPlayerTestI18n';

describe('PlaylistNameDialog', () => {
	it('renders title/confirm label and submits by Enter when allowed', () => {
		const onConfirm = vi.fn();
		renderMusicPlayer(
			<PlaylistNameDialog
				open
				titleId="playlist-dialog-title"
				title="Переименовать плейлист"
				description="Проверка диалога."
				playlistNameDraft="Новый плейлист"
				onDraftChange={vi.fn()}
				onCancel={vi.fn()}
				onConfirm={onConfirm}
				canConfirm
				confirmLabel="Сохранить"
			/>
		);
		expect(screen.getByText('Переименовать плейлист')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Сохранить' })
		).toBeInTheDocument();
		fireEvent.keyDown(screen.getByDisplayValue('Новый плейлист'), {
			key: 'Enter',
		});
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it('shows validation message and keeps confirm disabled', () => {
		renderMusicPlayer(
			<PlaylistNameDialog
				open
				titleId="playlist-dialog-title"
				title="Название плейлиста"
				description="Проверка валидации."
				playlistNameDraft="Любимые"
				onDraftChange={vi.fn()}
				onCancel={vi.fn()}
				onConfirm={vi.fn()}
				canConfirm={false}
				confirmLabel="Создать"
				validationMessage="Название «Любимые» зарезервировано системным плейлистом."
			/>
		);
		expect(
			screen.getByText(
				'Название «Любимые» зарезервировано системным плейлистом.'
			)
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Создать' })).toBeDisabled();
	});
});
