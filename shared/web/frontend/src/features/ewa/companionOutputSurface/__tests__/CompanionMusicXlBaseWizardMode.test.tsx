/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for the companion interactive XL Base launch wizard.
 *
 * Invariants:
 * - The wizard emits a structured prompt; browser UI never starts XL Base generation directly.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionMusicXlBaseWizardMode.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionMusicXlBaseWizardMode } from '@/features/ewa/companionOutputSurface/CompanionMusicXlBaseWizardMode';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'ru' },
		t: (key: string) => {
			const map: Record<string, string> = {
				'ewaCompanion.musicXlBaseWizardTitle': 'XL Base',
				'ewaCompanion.musicXlBaseWizardSubtitle': 'Wizard',
				'ewaCompanion.outputSurfaceBackToChat': 'Back',
				'ewaCompanion.musicXlBaseWizardFooterHint': 'Hint',
				'ewaCompanion.musicXlBaseWizardDraft': 'Draft',
				'ewaCompanion.musicXlBaseWizardGenerate': 'Generate',
				'ewaCompanion.musicXlBaseWizardBadge': 'Badge',
				'ewaCompanion.musicXlBaseWizardHeroTitle': 'Hero',
				'ewaCompanion.musicXlBaseWizardHeroBody': 'Body',
				'ewaCompanion.musicXlBaseWizardThemeLabel': 'Theme',
				'ewaCompanion.musicXlBaseWizardThemePlaceholder': 'Theme placeholder',
				'ewaCompanion.musicXlBaseWizardStyleLabel': 'Style',
				'ewaCompanion.musicXlBaseWizardVocalLabel': 'Vocal',
				'ewaCompanion.musicXlBaseWizardLanguageLabel': 'Language',
				'ewaCompanion.musicXlBaseWizardBackendHint': 'Backend hint',
				'ewaCompanion.musicXlBaseWizardLaunchPromptHeader': 'Start XL Base',
			};
			return map[key] ?? key;
		},
	}),
}));

describe('CompanionMusicXlBaseWizardMode', () => {
	it('submits deterministic XL Base slots through companion chat prompt', () => {
		const onSubmitPrompt = vi.fn();
		const { container } = render(
			<CompanionMusicXlBaseWizardMode
				payload={{
					default_language: 'ru',
					default_style: 'pop',
					default_vocal: 'female',
				}}
				onBackToChat={vi.fn()}
				onDraftPrompt={vi.fn()}
				onSubmitPrompt={onSubmitPrompt}
			/>
		);

		expect(screen.queryByText('XL Base')).not.toBeInTheDocument();
		expect(screen.queryByText('Wizard')).not.toBeInTheDocument();
		expect(screen.queryByText('Backend hint')).not.toBeInTheDocument();

		fireEvent.change(screen.getByPlaceholderText('Theme placeholder'), {
			target: { value: 'ночной город и вера в себя' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Рок' }));
		fireEvent.click(screen.getByRole('button', { name: 'Дуэт' }));
		fireEvent.click(screen.getByRole('button', { name: 'Английский' }));
		fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

		expect(onSubmitPrompt).toHaveBeenCalledWith(
			expect.stringContaining('#ewa_xl_base_interactive_start')
		);
		const prompt = String(onSubmitPrompt.mock.calls[0]?.[0] ?? '');
		expect(prompt).toContain('Тема: ночной город и вера в себя');
		expect(prompt).toContain('Стиль: rock');
		expect(prompt).toContain('Вокал: duet');
		expect(prompt).toContain('Язык: en');
		expect(container.innerHTML).not.toContain('violet');
		expect(container.innerHTML).toContain('--companion-aura');
	});

	it('labels choice groups and exposes submitting state', () => {
		render(
			<CompanionMusicXlBaseWizardMode
				payload={{
					initial_theme: 'утренний город',
					default_language: 'ru',
					default_style: 'pop',
					default_vocal: 'female',
				}}
				onBackToChat={vi.fn()}
				onDraftPrompt={vi.fn()}
				onSubmitPrompt={vi.fn()}
				submitting
			/>
		);

		expect(screen.getByRole('group', { name: 'Style' })).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Vocal' })).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Поп' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(screen.getByRole('button', { name: 'Generate' })).toHaveAttribute(
			'aria-busy',
			'true'
		);
	});
});
