/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionPresenceHeader (U8.3 slice 12 + mid-desktop ops entry).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_EWA_PERSONA_ID } from '@/features/ewa/ewaPersonaCatalog';
import { CompanionPresenceHeader } from '@/features/ewa/companionUx/CompanionPresenceHeader';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: string | { count?: number }) => {
			if (typeof opts === 'string') return opts;
			if (key === 'ewaCompanion.nonChatOperationsDecisionAria') {
				return `Needs a reply for ${opts?.count ?? 0} operations`;
			}
			if (key === 'ewaCompanion.nonChatOperationsEntryAria') {
				return `Open operations, ${opts?.count ?? 0} active`;
			}
			if (key === 'ewaCompanion.nonChatOperationsDecisionEntry') {
				return 'Needs a reply';
			}
			if (key === 'ewaCompanion.nonChatOperationsEntry') {
				return 'Operations';
			}
			if (key === 'ewaCompanion.operationsSheetTitle') {
				return 'Operations';
			}
			return key;
		},
		i18n: { language: 'en' },
	}),
}));

const baseProps = {
	mobileEmbeddedLayout: false,
	mobileEmbeddedLandscape: false,
	personaId: DEFAULT_EWA_PERSONA_ID,
	presence: 'online' as const,
	bond: 0.42,
	streamPhase: 'idle' as const,
	displayName: 'EWA',
	presenceChipLabel: 'steady',
	roleLine: 'Your companion on the desk',
	canToggleArlikaV2Sigil: false,
	arlikaV2SigilLabel: '',
	arlikaV2ModeSwitching: false,
	pending: false,
	onArlikaV2SigilToggle: vi.fn(),
};

describe('CompanionPresenceHeader', () => {
	it('renders display name and role line on desktop', () => {
		render(<CompanionPresenceHeader {...baseProps} />);
		expect(screen.getByText('EWA')).toBeInTheDocument();
		expect(screen.getByText('Your companion on the desk')).toBeInTheDocument();
	});

	it('hides operations entry when showOperationsEntry is false (lg+ rail path)', () => {
		render(
			<CompanionPresenceHeader
				{...baseProps}
				showOperationsEntry={false}
				onOpenOperations={vi.fn()}
			/>
		);
		expect(
			screen.queryByTestId('ewa-companion-presence-operations-open')
		).not.toBeInTheDocument();
	});

	it('shows operations entry below lg and opens sheet on click', async () => {
		const user = userEvent.setup();
		const onOpenOperations = vi.fn();
		render(
			<CompanionPresenceHeader
				{...baseProps}
				showOperationsEntry
				activeOperationCount={2}
				onOpenOperations={onOpenOperations}
			/>
		);
		const btn = screen.getByTestId('ewa-companion-presence-operations-open');
		expect(btn).toBeInTheDocument();
		expect(btn).toHaveAttribute('data-active-operations', '2');
		await user.click(btn);
		expect(onOpenOperations).toHaveBeenCalledTimes(1);
	});

	it('prefers awaiting-confirmation badge over active count', () => {
		render(
			<CompanionPresenceHeader
				{...baseProps}
				showOperationsEntry
				activeOperationCount={5}
				awaitingConfirmationCount={1}
				onOpenOperations={vi.fn()}
			/>
		);
		const btn = screen.getByTestId('ewa-companion-presence-operations-open');
		expect(btn).toHaveAttribute('data-active-operations', '1');
		expect(btn).toHaveAttribute('aria-label', 'Needs a reply for 1 operations');
	});
});
