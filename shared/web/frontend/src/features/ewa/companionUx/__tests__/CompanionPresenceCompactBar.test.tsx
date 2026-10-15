/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionPresenceCompactBar and compact CompanionSigil sizing.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionPresenceCompactBar } from '@/features/ewa/companionUx/CompanionPresenceCompactBar';
import { CompanionSigil } from '@/features/ewa/companionPresence/CompanionSigil';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'ru' },
	}),
}));

const baseProps = {
	personaId: 'parent',
	presence: 'online' as const,
	bond: 0.2,
	streamPhase: 'idle' as const,
	displayName: 'EWA',
	presenceChipLabel: 'рядом',
	roleLine: 'Ваш спутник на столе',
	canToggleArlikaV2Sigil: false,
	arlikaV2SigilLabel: '',
	arlikaV2ModeSwitching: false,
	pending: false,
	onArlikaV2SigilToggle: vi.fn(),
};

describe('CompanionPresenceCompactBar', () => {
	it('renders compact presence guide anchor and display name', () => {
		render(<CompanionPresenceCompactBar {...baseProps} />);
		expect(
			screen.getByTestId('ewa-companion-presence-compact')
		).toHaveAttribute('data-ewa-guide', 'presence-compact');
		expect(screen.getByText('EWA')).toBeInTheDocument();
	});
});

describe('CompanionSigil size', () => {
	it('renders compact footprint at 72px', () => {
		const { container } = render(
			<CompanionSigil personaId="parent" presence="online" size="compact" />
		);
		const svg = container.querySelector('svg');
		expect(svg).toHaveAttribute('width', '72');
		expect(svg).toHaveAttribute('height', '72');
	});
});
