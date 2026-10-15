/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest locks for MusicForge create panel premium IA (W6): hero, taste strip, disclosure, active run.
 *
 * Invariants:
 * - Idea + primary CTA stay visible; advanced fields live inside disclosed section.
 * - Taste copy appears only when authenticated capabilities report likes > 0.
 *
 * Related:
 * - src/pages/MusicForge/MusicForgeCreatePanel.tsx
 */

import { fireEvent, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MusicForgeCapabilities } from '@/services/musicForge/musicForgeApi';
import { MusicForgeCreatePanel } from '../MusicForgeCreatePanel';
import { renderMusicForge } from '../musicForgeTestI18n';

const baseCapabilities: MusicForgeCapabilities = {
	default_language: 'auto',
	languages: [
		{ value: 'auto', label_ru: 'Авто' },
		{ value: 'ru', label_ru: 'Русский' },
	],
	duration_seconds_default: 220,
	duration_seconds_min: 60,
	duration_seconds_max: 240,
	mvp_lane: 'SFT',
	frontend_role: 'thin_client',
	taste_profile_like_count: 0,
	taste_profile_dislike_count: 0,
	modes: [
		{
			mode_key: 'sft_xl',
			label_ru: 'SFT XL',
			label_en: 'SFT XL',
			is_default: true,
			lane_key: 'sft_xl',
		},
	],
};

function renderPanel(
	overrides: Partial<ComponentProps<typeof MusicForgeCreatePanel>> = {}
) {
	const props: ComponentProps<typeof MusicForgeCreatePanel> = {
		capabilities: baseCapabilities,
		capabilitiesWarning: false,
		onRetryCapabilities: vi.fn(),
		idea: '',
		onIdeaChange: vi.fn(),
		ideaHintVisible: false,
		language: 'auto',
		onLanguageChange: vi.fn(),
		resolveLanguageLabel: (_value, fallback) => fallback,
		modeKey: 'sft_xl',
		onModeKeyChange: vi.fn(),
		styleHint: '',
		onStyleHintChange: vi.fn(),
		vocal: 'female',
		onVocalChange: vi.fn(),
		constraints: '',
		onConstraintsChange: vi.fn(),
		duration: 220,
		onDurationChange: vi.fn(),
		onDurationBlur: vi.fn(),
		runActive: false,
		canSubmit: true,
		submitting: false,
		cancelPending: false,
		canRestoreLast: false,
		formError: null,
		onSubmit: vi.fn(),
		onCancel: vi.fn(),
		onRestoreLast: vi.fn(),
		...overrides,
	};
	return renderMusicForge(<MusicForgeCreatePanel {...props} />);
}

describe('MusicForgeCreatePanel', () => {
	it('shows hero and keeps mode settings inside disclosure', () => {
		renderPanel();
		expect(
			screen.getByText('Опишите идею — мы соберём песню')
		).toBeInTheDocument();
		expect(screen.getByTestId('music-forge-idea-starters')).toBeInTheDocument();
		expect(screen.getByText('Жанр')).toBeInTheDocument();
		expect(screen.getByText('Вокал')).toBeInTheDocument();
		expect(screen.getByText('Язык')).toBeInTheDocument();
		expect(screen.getByRole('option', { name: 'Женский' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		const modeSelect = document.getElementById('music-forge-mode');
		expect(modeSelect).toBeTruthy();
		expect(modeSelect).not.toBeVisible();
		fireEvent.click(screen.getByText('Настройки звучания'));
		expect(modeSelect).toBeVisible();
	});

	it('shows completed hint instead of hero when run finished', () => {
		const onStartNewSong = vi.fn();
		renderPanel({
			completedHintVisible: true,
			onStartNewSong,
		});
		expect(
			screen.getByTestId('music-forge-completed-hint')
		).toBeInTheDocument();
		expect(
			screen.queryByText('Опишите идею — мы соберём песню')
		).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Новая песня/i }));
		expect(onStartNewSong).toHaveBeenCalledOnce();
	});

	it('shows terminal hint for failed run with retry', () => {
		const onRetry = vi.fn();
		const onStartNewSong = vi.fn();
		renderPanel({
			terminalHintVisible: true,
			terminalStatus: 'failed',
			canRetryGeneration: true,
			onRetryGeneration: onRetry,
			onStartNewSong,
		});
		expect(screen.getByTestId('music-forge-terminal-hint')).toBeInTheDocument();
		expect(screen.getByText('Генерация не завершилась')).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', { name: /Повторить генерацию/i })
		);
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it('shows submit recap when idea is long enough', () => {
		renderPanel({ idea: 'Summer love story' });
		expect(screen.getByTestId('music-forge-submit-recap')).toBeInTheDocument();
	});

	it('shows taste strip when capabilities report likes', () => {
		renderPanel({
			capabilities: {
				...baseCapabilities,
				taste_profile_like_count: 2,
			},
		});
		expect(
			screen.getByText(
				'Учитываем 2 понравившихся треков при следующих генерациях.'
			)
		).toBeInTheDocument();
	});

	it('hides taste strip when like count is zero', () => {
		renderPanel({
			capabilities: {
				...baseCapabilities,
				taste_profile_like_count: 0,
			},
		});
		expect(
			screen.queryByText(/Учитываем .* понравившихся треков/)
		).not.toBeInTheDocument();
	});

	it('replaces form with active-run summary', () => {
		renderPanel({
			runActive: true,
			activeIdeaLabel: 'Night drive song',
			activeStatusLabel: 'Пишем текст',
			activeProgressCurrent: 3,
			activeProgressTotal: 8,
			activeRunStatus: 'running',
			activeVocal: 'male',
			activeStyleHint: 'rock',
			activeLanguage: 'ru',
			activeDurationSeconds: 180,
		});
		expect(screen.getByText('Сейчас создаём')).toBeInTheDocument();
		expect(screen.getByText('Night drive song')).toBeInTheDocument();
		expect(screen.getByText('Пишем текст')).toBeInTheDocument();
		expect(screen.getByText('Мужской')).toBeInTheDocument();
		expect(screen.getByText('Рок')).toBeInTheDocument();
		expect(screen.getByRole('progressbar')).toHaveAttribute(
			'aria-valuenow',
			'38'
		);
		expect(
			screen.queryByRole('button', { name: /создать песню/i })
		).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /отмена/i })).toBeInTheDocument();
	});

	it('calls onVocalChange when vocal chip clicked', () => {
		const onVocalChange = vi.fn();
		renderPanel({ onVocalChange });
		fireEvent.click(screen.getByRole('option', { name: 'Мужской' }));
		expect(onVocalChange).toHaveBeenCalledWith('male');
	});
});
