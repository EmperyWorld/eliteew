/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest locks for MusicForge genre picker and studio idle journey panel.
 */

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MusicForgeDurationPicker } from '../MusicForgeDurationPicker';
import { MusicForgeGenrePicker } from '../MusicForgeGenrePicker';
import { MusicForgeIdeaStarters } from '../MusicForgeIdeaStarters';
import { MusicForgeLanguagePicker } from '../MusicForgeLanguagePicker';
import { MusicForgeStudioIdlePanel } from '../MusicForgeStudioIdlePanel';
import { renderMusicForge } from '../musicForgeTestI18n';

describe('MusicForgeGenrePicker', () => {
	it('toggles style_hint via genre chips', () => {
		const onChange = vi.fn();
		renderMusicForge(
			<MusicForgeGenrePicker styleHint="" onStyleHintChange={onChange} />
		);
		fireEvent.click(screen.getByRole('option', { name: 'Поп' }));
		expect(onChange).toHaveBeenCalledWith('pop');
	});

	it('clears selection when the same chip is clicked again', () => {
		const onChange = vi.fn();
		renderMusicForge(
			<MusicForgeGenrePicker styleHint="pop" onStyleHintChange={onChange} />
		);
		fireEvent.click(screen.getByRole('option', { name: 'Поп' }));
		expect(onChange).toHaveBeenCalledWith('');
	});
});

describe('MusicForgeDurationPicker', () => {
	it('selects duration via preset chips', () => {
		const onChange = vi.fn();
		renderMusicForge(
			<MusicForgeDurationPicker
				duration={220}
				min={60}
				max={240}
				onDurationChange={onChange}
				onDurationBlur={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByRole('option', { name: '180 с' }));
		expect(onChange).toHaveBeenCalledWith(180);
	});
});

describe('MusicForgeIdeaStarters', () => {
	it('fills idea when starter chip clicked', () => {
		const onPick = vi.fn();
		renderMusicForge(<MusicForgeIdeaStarters onPickIdea={onPick} />);
		fireEvent.click(screen.getByRole('button', { name: 'Летний двор' }));
		expect(onPick).toHaveBeenCalledWith(
			'Курага, летний двор, смешная любовь без пафоса'
		);
	});
});

describe('MusicForgeLanguagePicker', () => {
	it('selects language via chips', () => {
		const onChange = vi.fn();
		renderMusicForge(
			<MusicForgeLanguagePicker
				language="auto"
				onLanguageChange={onChange}
				languages={[
					{ value: 'auto', label_ru: 'Авто' },
					{ value: 'ru', label_ru: 'Русский' },
					{ value: 'en', label_ru: 'English' },
				]}
				resolveLanguageLabel={(_value, fallback) => fallback}
			/>
		);
		fireEvent.click(screen.getByRole('option', { name: 'Русский' }));
		expect(onChange).toHaveBeenCalledWith('ru');
	});
});

describe('MusicForgeStudioIdlePanel', () => {
	it('renders journey steps before first run', () => {
		renderMusicForge(<MusicForgeStudioIdlePanel />);
		expect(screen.getByTestId('music-forge-studio-idle')).toBeInTheDocument();
		expect(screen.getByText('Здесь появится ваш трек')).toBeInTheDocument();
		expect(screen.getByText('Идея')).toBeInTheDocument();
		expect(screen.getByText('Текст и стиль')).toBeInTheDocument();
		expect(screen.getByText('Прослушивание')).toBeInTheDocument();
	});
});
