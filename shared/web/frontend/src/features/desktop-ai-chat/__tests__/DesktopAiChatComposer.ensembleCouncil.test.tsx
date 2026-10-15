/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock ensemble council: rich plan during deliberating; compact HUD while speaking.
 *
 * Related:
 * - `components/DesktopAiChatComposer.tsx`
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopAiChatComposer } from '../components/DesktopAiChatComposer';
import type { DesktopEnsembleCouncilUiState } from '../ensemble';
import type { DesktopAiChatComposerProps } from '../components/DesktopAiChatComposer';

vi.mock('../desktopAiHeroes', () => ({
	getDesktopAiHero: (id: string) => ({ shortLabel: id }),
}));

function baseProps(
	overrides: Partial<DesktopAiChatComposerProps> = {}
): DesktopAiChatComposerProps {
	const sttMic = {
		isRecording: false,
		level: 0,
		start: vi.fn(),
		stop: vi.fn(),
	} as unknown as DesktopAiChatComposerProps['sttMic'];
	return {
		voiceAllowed: false,
		voiceIn: false,
		sttBusy: false,
		ttsBusy: false,
		sttMic,
		isEnsembleActive: true,
		ensembleCouncilUi: null,
		ensembleDocConfirm: null,
		soloSendsBlocked: false,
		streamLockHeldByOther: false,
		streamLockStatusHint: null,
		ugsCreditsBalance: null,
		composerHint: null,
		webSearchArmed: false,
		onDisarmWebSearch: vi.fn(),
		networkOnline: true,
		sttLevelMeterRef: { current: null },
		composerRegionId: 'composer-region',
		composerTestId: 'composer',
		composerTextareaId: 'composer-ta',
		composerTextareaTestId: 'composer-ta-test',
		composerOfflineDescId: 'composer-offline',
		shellComposerTextareaClass: '',
		shellComposerDockClass: '',
		shellComposerIconBtnClass: '',
		shellComposerStopBtnClass: '',
		activeId: 'chat-1',
		input: '',
		onInputChange: vi.fn(),
		attachRef: { current: null },
		onAttach: vi.fn(),
		sending: true,
		onSend: vi.fn(),
		onStopStream: vi.fn(),
		onMicStt: vi.fn(),
		onEnsembleDocumentConfirm: vi.fn(),
		onOpenSoloSlotModal: vi.fn(),
		sttCancelNextBlobRef: { current: false },
		lucideStroke: 1.5,
		t: ((key: string) => key) as DesktopAiChatComposerProps['t'],
		...overrides,
	};
}

const deliberatingCouncil: DesktopEnsembleCouncilUiState = {
	phase: 'deliberating',
	speakers: ['hero_a', 'hero_b'],
	reason: 'plan reason',
	huddle_lines: ['Сверяем контуры ответа'],
	roster_size: 3,
	max_speakers_this_turn: 2,
	blueprint: true,
	plan_template_title: 'Tech plan',
	steps_preview: [
		{ step_id: 's1', title: 'Goals', hero_id: 'hero_a' },
		{ step_id: 's2', title: 'Architecture', hero_id: 'hero_b' },
	],
};

const speakingCouncil: DesktopEnsembleCouncilUiState = {
	...deliberatingCouncil,
	phase: 'speaking',
	active_speaker_id: 'hero_a',
};

describe('DesktopAiChatComposer ensemble council', () => {
	it('shows rich huddle and steps while deliberating', () => {
		render(
			<DesktopAiChatComposer
				{...baseProps({ ensembleCouncilUi: deliberatingCouncil })}
			/>
		);
		const panel = screen.getByTestId('desktop-ai-ensemble-council');
		expect(panel).toHaveAttribute('data-phase', 'deliberating');
		expect(screen.getByText('ensembleDeliberating')).toBeInTheDocument();
		expect(screen.getByText('Сверяем контуры ответа')).toBeInTheDocument();
		expect(screen.getByText(/Goals/)).toBeInTheDocument();
		expect(screen.getByText(/Architecture/)).toBeInTheDocument();
	});

	it('compacts council HUD while speakers answer', () => {
		render(
			<DesktopAiChatComposer
				{...baseProps({ ensembleCouncilUi: speakingCouncil })}
			/>
		);
		const panel = screen.getByTestId('desktop-ai-ensemble-council');
		expect(panel).toHaveAttribute('data-phase', 'speaking');
		expect(screen.getByText('ensembleSpeaking')).toBeInTheDocument();
		expect(screen.getByText('ensembleCouncilLiveInBubble')).toBeInTheDocument();
		expect(screen.getByText(/hintWriting/)).toBeInTheDocument();
		expect(
			panel.querySelector('[data-active-speaker="true"]')
		).toHaveTextContent('hero_a');
		expect(
			screen.queryByText('Сверяем контуры ответа')
		).not.toBeInTheDocument();
		expect(screen.queryByText(/Goals/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Architecture/)).not.toBeInTheDocument();
		expect(screen.queryByText('ensembleDeliberating')).not.toBeInTheDocument();
	});
});
