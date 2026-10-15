/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionTranscriptEmptyState (U8.3 slice 15).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionTranscriptEmptyState } from '@/features/ewa/companionUx/CompanionTranscriptEmptyState';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

describe('CompanionTranscriptEmptyState', () => {
	it('opens tools catalog from empty CTA', () => {
		const onOpenTools = vi.fn();
		render(
			<CompanionTranscriptEmptyState
				displayName="EWA"
				onOpenTools={onOpenTools}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'ewaCompanion.chatEmptyShowTools' })
		);
		expect(onOpenTools).toHaveBeenCalledOnce();
	});

	it('frames the empty transcript as Master Dashboard gateway', () => {
		render(
			<CompanionTranscriptEmptyState displayName="EWA" onOpenTools={vi.fn()} />
		);

		expect(
			screen.getByTestId('ewa-companion-master-dashboard')
		).toBeInTheDocument();
		expect(screen.getByText('ewaCompanion.gatewayTitle')).toBeInTheDocument();
		expect(screen.getByTestId('ewa-gateway-card-agentic')).toBeInTheDocument();
		expect(screen.getByTestId('ewa-gateway-card-media')).toBeInTheDocument();
		expect(
			screen.getByTestId('ewa-gateway-card-workflows')
		).toBeInTheDocument();
		expect(
			screen.getByTestId('ewa-gateway-card-documents')
		).toBeInTheDocument();
		expect(
			screen.getByTestId('ewa-gateway-examples-toggle')
		).toBeInTheDocument();
		expect(
			screen.queryByTestId('ewa-gateway-examples')
		).not.toBeInTheDocument();
	});

	it('uses mission examples as composer prompt chips behind disclosure', () => {
		const onChooseMissionPrompt = vi.fn();
		render(
			<CompanionTranscriptEmptyState
				displayName="EWA"
				onOpenTools={vi.fn()}
				onChooseMissionPrompt={onChooseMissionPrompt}
			/>
		);

		fireEvent.click(screen.getByTestId('ewa-gateway-examples-toggle'));
		expect(screen.getByTestId('ewa-gateway-examples')).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.chatEmptyMissionExampleResearch',
			})
		);
		expect(onChooseMissionPrompt).toHaveBeenCalledWith(
			'ewaCompanion.chatEmptyMissionExampleResearch'
		);
	});

	it('compacts gateway cards for embedded mobile WebView', () => {
		render(
			<CompanionTranscriptEmptyState
				displayName="EWA"
				onOpenTools={vi.fn()}
				embeddedMobile
			/>
		);
		expect(
			screen.getByTestId('ewa-companion-master-dashboard')
		).toHaveAttribute('data-embedded-mobile', '1');
		expect(screen.getByTestId('ewa-gateway-card-agentic')).toBeInTheDocument();
		expect(screen.getByTestId('ewa-gateway-card-media')).toBeInTheDocument();
		expect(
			screen.queryByTestId('ewa-gateway-card-workflows')
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId('ewa-gateway-card-documents')
		).not.toBeInTheDocument();
	});
});
