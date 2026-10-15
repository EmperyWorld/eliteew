/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for the EWA companion first-meet preference quiz and birth-video bootstrap.
 *
 * Invariants:
 * - Global intro renders only on sceneIndex === 0; scenes 1+ are question-only.
 * - The birth video must not render or initialize the profile before the legend is completed.
 * - Final confirm is one primary CTA (`data-ewa-first-meet-confirm`); initialize still posts one hidden `seed_persona_id`.
 *
 * Related:
 * - src/features/ewa/EwaCompanionFirstMeet.tsx
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	EwaCompanionFirstMeet,
	type FirstMeetLegendAnswers,
	firstMeetBirthVideoUrl,
	resolvePersonaFromLegendAnswers,
} from '@/features/ewa/EwaCompanionFirstMeet';
import { initializeEwaCompanionProfile } from '@/services/ewa/ewaCompanionProfileApi';

vi.mock('@/services/ewa/ewaCompanionProfileApi', () => ({
	initializeEwaCompanionProfile: vi.fn(async () => ({
		principal_id: 'p1',
		schema_version: '1',
		seed_persona_id: 'mela',
		baseline: {},
		learned_preferences: {},
		style_parameters: {},
		companion_revision: 1,
		updated_at: null,
	})),
}));

const labels: Record<string, string> = {
	'ewaCompanion.firstMeetForever':
		'You cannot switch companion later in normal settings.',
	'ewaCompanion.firstMeetLegend.intro':
		'Five short questions help us match a companion style.',
	'ewaCompanion.firstMeetLegend.trustAnchor':
		'One-time choice: you cannot switch companion later in normal settings.',
	'ewaCompanion.firstMeetLegend.progress': 'Step',
	'ewaCompanion.firstMeetLegend.progressAriaLabel': 'Introduction step',
	'ewaCompanion.firstMeetLegend.back': 'Back',
	'ewaCompanion.firstMeetLegend.finalKicker': 'Almost ready',
	'ewaCompanion.firstMeetLegend.finalTitle':
		'Your companion is ready to meet you',
	'ewaCompanion.firstMeetLegend.finalBody':
		'We saved your answers and will match a communication style.',
	'ewaCompanion.firstMeetLegend.finalCtaHint':
		'Press the button below to create your companion.',
	'ewaCompanion.firstMeetLegend.finalSummaryLabel': 'Your answers',
	'ewaCompanion.firstMeetLegend.confirm': 'Create companion',
	'ewaCompanion.firstMeetLegend.change': 'Change answers',
	'ewaCompanion.firstMeetLegend.saving': 'Creating companion…',
	'ewaCompanion.firstMeetLegend.videoFailed': 'Video failed',
	'ewaCompanion.firstMeetLegend.videoContinue': 'Continue',
	'ewaCompanion.firstMeetLegend.scenes.threshold.title':
		'What helps you start calmly?',
	'ewaCompanion.firstMeetLegend.scenes.threshold.body':
		'When you open the desk',
	'ewaCompanion.firstMeetLegend.scenes.threshold.choices.hearth.label':
		'Warmth and support',
	'ewaCompanion.firstMeetLegend.scenes.threshold.choices.hearth.detail':
		'Soft tone',
	'ewaCompanion.firstMeetLegend.scenes.threshold.choices.hearth.token':
		'Warmth',
	'ewaCompanion.firstMeetLegend.scenes.threshold.choices.blade.label':
		'Clarity and directness',
	'ewaCompanion.firstMeetLegend.scenes.threshold.choices.blade.detail':
		'Short answers',
	'ewaCompanion.firstMeetLegend.scenes.threshold.choices.blade.token':
		'Clarity',
	'ewaCompanion.firstMeetLegend.scenes.threshold.choices.water.label':
		'A steady pace',
	'ewaCompanion.firstMeetLegend.scenes.threshold.choices.water.detail':
		'Calm rhythm',
	'ewaCompanion.firstMeetLegend.scenes.threshold.choices.water.token': 'Calm',
	'ewaCompanion.firstMeetLegend.scenes.light.title':
		'How do you prefer to get help?',
	'ewaCompanion.firstMeetLegend.scenes.light.body': 'Pick the style',
	'ewaCompanion.firstMeetLegend.scenes.light.choices.spark.label':
		'Ideas and wording',
	'ewaCompanion.firstMeetLegend.scenes.light.choices.spark.detail':
		'Suggestions and images',
	'ewaCompanion.firstMeetLegend.scenes.light.choices.spark.token': 'Ideas',
	'ewaCompanion.firstMeetLegend.scenes.light.choices.thread.label':
		'Structure and links',
	'ewaCompanion.firstMeetLegend.scenes.light.choices.thread.detail':
		'Break into steps',
	'ewaCompanion.firstMeetLegend.scenes.light.choices.thread.token': 'Structure',
	'ewaCompanion.firstMeetLegend.scenes.light.choices.lantern.label':
		'Quiet company',
	'ewaCompanion.firstMeetLegend.scenes.light.choices.lantern.detail':
		'Nearby without noise',
	'ewaCompanion.firstMeetLegend.scenes.light.choices.lantern.token': 'Beside',
	'ewaCompanion.firstMeetLegend.scenes.storm.title':
		'When there is too much to do?',
	'ewaCompanion.firstMeetLegend.scenes.storm.body': 'What do you need first?',
	'ewaCompanion.firstMeetLegend.scenes.storm.choices.shelter.label':
		'Lower the pressure',
	'ewaCompanion.firstMeetLegend.scenes.storm.choices.shelter.detail':
		'Support first',
	'ewaCompanion.firstMeetLegend.scenes.storm.choices.shelter.token': 'Support',
	'ewaCompanion.firstMeetLegend.scenes.storm.choices.map.label':
		'A plan and order',
	'ewaCompanion.firstMeetLegend.scenes.storm.choices.map.detail':
		'Causes and steps',
	'ewaCompanion.firstMeetLegend.scenes.storm.choices.map.token': 'Plan',
	'ewaCompanion.firstMeetLegend.scenes.storm.choices.needle.label':
		'One next step',
	'ewaCompanion.firstMeetLegend.scenes.storm.choices.needle.detail':
		'Focus on what matters',
	'ewaCompanion.firstMeetLegend.scenes.storm.choices.needle.token': 'Focus',
	'ewaCompanion.firstMeetLegend.scenes.work.title':
		'What will you work on together most?',
	'ewaCompanion.firstMeetLegend.scenes.work.body': 'This shapes tools',
	'ewaCompanion.firstMeetLegend.scenes.work.choices.file.label':
		'Text and documents',
	'ewaCompanion.firstMeetLegend.scenes.work.choices.file.detail':
		'Read and edit',
	'ewaCompanion.firstMeetLegend.scenes.work.choices.file.token': 'Documents',
	'ewaCompanion.firstMeetLegend.scenes.work.choices.image.label':
		'Images and visuals',
	'ewaCompanion.firstMeetLegend.scenes.work.choices.image.detail':
		'Pictures and mood',
	'ewaCompanion.firstMeetLegend.scenes.work.choices.image.token': 'Visual',
	'ewaCompanion.firstMeetLegend.scenes.work.choices.song.label':
		'Music and mood',
	'ewaCompanion.firstMeetLegend.scenes.work.choices.song.detail':
		'A state as sound',
	'ewaCompanion.firstMeetLegend.scenes.work.choices.song.token': 'Music',
	'ewaCompanion.firstMeetLegend.scenes.vow.title':
		'How should the companion stay close?',
	'ewaCompanion.firstMeetLegend.scenes.vow.body': 'Last question',
	'ewaCompanion.firstMeetLegend.scenes.vow.choices.remember.label':
		'Remember what matters',
	'ewaCompanion.firstMeetLegend.scenes.vow.choices.remember.detail':
		'Return details gently',
	'ewaCompanion.firstMeetLegend.scenes.vow.choices.remember.token': 'Memory',
	'ewaCompanion.firstMeetLegend.scenes.vow.choices.move.label': 'Nudge forward',
	'ewaCompanion.firstMeetLegend.scenes.vow.choices.move.detail':
		'Move to the next action',
	'ewaCompanion.firstMeetLegend.scenes.vow.choices.move.token': 'Action',
	'ewaCompanion.firstMeetLegend.scenes.vow.choices.watch.label':
		'Keep the whole picture',
	'ewaCompanion.firstMeetLegend.scenes.vow.choices.watch.detail':
		'Hold the overall frame',
	'ewaCompanion.firstMeetLegend.scenes.vow.choices.watch.token': 'Overview',
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => labels[key] ?? key,
		i18n: { language: 'en' },
	}),
}));

describe('EwaCompanionFirstMeet', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('resolves deterministic hidden personas for different legend paths', () => {
		const warm: FirstMeetLegendAnswers = {
			threshold: 'hearth',
			light: 'spark',
			storm: 'shelter',
			work: 'song',
			vow: 'remember',
		};
		const focused: FirstMeetLegendAnswers = {
			threshold: 'blade',
			light: 'spark',
			storm: 'needle',
			work: 'file',
			vow: 'move',
		};
		const frame: FirstMeetLegendAnswers = {
			threshold: 'water',
			light: 'thread',
			storm: 'map',
			work: 'file',
			vow: 'watch',
		};

		expect(resolvePersonaFromLegendAnswers(warm)).toBe('mela');
		expect(resolvePersonaFromLegendAnswers(focused)).toBe('feni');
		expect(resolvePersonaFromLegendAnswers(frame)).toBe('parent');
		expect(resolvePersonaFromLegendAnswers({ threshold: 'hearth' })).toBeNull();
		expect(firstMeetBirthVideoUrl('mela')).toMatch(
			/\/ewa\/first-meet\/mela\.mp4$/
		);
	});

	it('shows global intro and trust anchor only on scene index 0', () => {
		const onCommitted = vi.fn(async () => undefined);
		const { container } = render(
			<EwaCompanionFirstMeet onCommitted={onCommitted} />
		);

		expect(
			screen.getByText('Five short questions help us match a companion style.')
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'One-time choice: you cannot switch companion later in normal settings.'
			)
		).toBeInTheDocument();
		expect(
			container.querySelector('[data-ewa-first-meet-intro="1"]')
		).not.toBeNull();

		fireEvent.click(
			screen.getByRole('button', { name: /Warmth and support/i })
		);

		expect(
			screen.queryByText(
				'Five short questions help us match a companion style.'
			)
		).not.toBeInTheDocument();
		expect(
			container.querySelector('[data-ewa-first-meet-intro="1"]')
		).toBeNull();
		expect(
			screen.getByText('How do you prefer to get help?')
		).toBeInTheDocument();
	});

	it('exposes aria-live scene regions and ritual progress bar', () => {
		const onCommitted = vi.fn(async () => undefined);
		const { container } = render(
			<EwaCompanionFirstMeet onCommitted={onCommitted} />
		);

		expect(
			container.querySelector('[data-ewa-first-meet-scene="threshold"]')
		).toHaveAttribute('aria-live', 'polite');
		expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
	});

	it('requires the legend before showing the birth video and initializing once', async () => {
		const onCommitted = vi.fn(async () => undefined);
		const { container } = render(
			<EwaCompanionFirstMeet onCommitted={onCommitted} />
		);

		expect(
			screen.getByText('What helps you start calmly?')
		).toBeInTheDocument();
		expect(
			screen.queryByText(/Mela|Мела|mela|Kora|Кора|kora/u)
		).not.toBeInTheDocument();
		expect(initializeEwaCompanionProfile).not.toHaveBeenCalled();
		expect(container.querySelector('video')).toBeNull();

		fireEvent.click(
			screen.getByRole('button', { name: /Warmth and support/i })
		);
		expect(
			screen.getByText('How do you prefer to get help?')
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Ideas and wording/i }));
		expect(
			screen.getByText('When there is too much to do?')
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', { name: /Lower the pressure/i })
		);
		expect(
			screen.getByText('What will you work on together most?')
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Music and mood/i }));
		expect(
			screen.getByText('How should the companion stay close?')
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', { name: /Remember what matters/i })
		);

		expect(
			screen.getByText('Your companion is ready to meet you')
		).toBeInTheDocument();
		expect(
			screen.getByText('Press the button below to create your companion.')
		).toBeInTheDocument();
		expect(initializeEwaCompanionProfile).not.toHaveBeenCalled();
		expect(container.querySelector('video')).toBeNull();
		expect(
			container.querySelector('[data-ewa-first-meet-confirm="1"]')
		).not.toBeNull();

		fireEvent.click(screen.getByRole('button', { name: /Create companion/i }));
		const video = container.querySelector('video');
		expect(video?.getAttribute('src')).toMatch(/\/ewa\/first-meet\/mela\.mp4$/);
		expect(video?.querySelector('track')?.getAttribute('srcLang')).toBe('en');
		if (!video) throw new Error('Expected first-meet birth video');
		fireEvent.ended(video);

		await waitFor(() =>
			expect(initializeEwaCompanionProfile).toHaveBeenCalledTimes(1)
		);
		expect(initializeEwaCompanionProfile).toHaveBeenCalledWith({
			seed_persona_id: 'mela',
		});
		expect(onCommitted).toHaveBeenCalledTimes(1);
	});

	it('allows initialize retry after API failure without duplicate success commit', async () => {
		const onCommitted = vi.fn(async () => undefined);
		vi.mocked(initializeEwaCompanionProfile)
			.mockRejectedValueOnce(new Error('network down'))
			.mockResolvedValueOnce({
				principal_id: 'p1',
				schema_version: '1',
				seed_persona_id: 'mela',
				baseline: {},
				learned_preferences: {},
				style_parameters: {},
				character_state: {
					seed_persona_id: 'mela',
					mood: { valence: 0, energy: 0, tension: 0, confidence: 0 },
					bond: { trust: 0, familiarity: 0, repair_need: 0 },
					interaction_style: {
						answer_length: 0,
						initiative: 0,
						reassurance: 0,
					},
				},
				companion_revision: 1,
				updated_at: null,
				voice_enabled: false,
				reactive_chrome_enabled: true,
			});

		const { container } = render(
			<EwaCompanionFirstMeet onCommitted={onCommitted} />
		);
		for (const name of [
			/Warmth and support/i,
			/Ideas and wording/i,
			/Lower the pressure/i,
			/Music and mood/i,
			/Remember what matters/i,
		]) {
			fireEvent.click(screen.getByRole('button', { name }));
		}
		fireEvent.click(screen.getByRole('button', { name: /Create companion/i }));
		const video = container.querySelector('video');
		if (!video) throw new Error('Expected first-meet birth video');
		fireEvent.ended(video);

		await waitFor(() =>
			expect(screen.getByText('network down')).toBeInTheDocument()
		);
		expect(onCommitted).not.toHaveBeenCalled();

		fireEvent.ended(video);
		await waitFor(() => expect(onCommitted).toHaveBeenCalledTimes(1));
		expect(initializeEwaCompanionProfile).toHaveBeenCalledTimes(2);
	});

	it('returns to the last legend scene when changing answers before commit', () => {
		const onCommitted = vi.fn(async () => undefined);
		render(<EwaCompanionFirstMeet onCommitted={onCommitted} />);
		for (const name of [
			/Warmth and support/i,
			/Ideas and wording/i,
			/Lower the pressure/i,
			/Music and mood/i,
			/Remember what matters/i,
		]) {
			fireEvent.click(screen.getByRole('button', { name }));
		}
		expect(
			screen.getByText('Your companion is ready to meet you')
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Change answers/i }));
		expect(
			screen.getByText('How should the companion stay close?')
		).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: /Create companion/i })
		).not.toBeInTheDocument();
	});

	it('uses single-column choice grid on embedded mobile', () => {
		const onCommitted = vi.fn(async () => undefined);
		const { container } = render(
			<EwaCompanionFirstMeet embeddedMobile onCommitted={onCommitted} />
		);
		const choice = screen.getByRole('button', { name: /Warmth and support/i });
		expect(choice.className).toContain('min-h-11');
		expect(container.querySelector('[data-ewa-first-meet="1"]')).not.toBeNull();
	});
});
