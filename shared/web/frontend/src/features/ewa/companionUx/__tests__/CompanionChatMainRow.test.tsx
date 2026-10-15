/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionChatMainRow layout (U8.3 slice 23 + compact presence).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionChatMainRow } from '@/features/ewa/companionUx/CompanionChatMainRow';

vi.mock('@/features/ewa/companionUx/CompanionPresenceHeader', () => ({
	CompanionPresenceHeader: () => <div data-testid="presence-header" />,
}));

vi.mock('@/hooks/useMediaQuery', () => ({
	useMediaQuery: vi.fn(() => false),
}));

const basePresenceHeaderProps = {
	mobileEmbeddedLayout: false,
	mobileEmbeddedLandscape: false,
	personaId: 'parent',
	presence: 'online' as const,
	bond: 0,
	streamPhase: 'idle' as const,
	displayName: 'EWA',
	presenceChipLabel: 'Online',
	roleLine: 'companion',
	canToggleArlikaV2Sigil: false,
	arlikaV2SigilLabel: '',
	arlikaV2ModeSwitching: false,
	pending: false,
	onArlikaV2SigilToggle: vi.fn(),
};

describe('CompanionChatMainRow', () => {
	it('renders presence header and three column slots on narrow viewport', () => {
		render(
			<CompanionChatMainRow
				presenceHeaderProps={basePresenceHeaderProps}
				leftRail={<div data-testid="left-rail" />}
				mainColumn={<div data-testid="main-column" />}
				rightRail={<div data-testid="right-rail" />}
			/>
		);
		expect(screen.getByTestId('presence-header')).toBeInTheDocument();
		expect(screen.getByTestId('left-rail')).toBeInTheDocument();
		expect(screen.getByTestId('main-column')).toBeInTheDocument();
		expect(screen.getByTestId('right-rail')).toBeInTheDocument();
	});

	it('omits top header on lg+ desktop (compact presence lives in left rail)', async () => {
		const { useMediaQuery } = await import('@/hooks/useMediaQuery');
		vi.mocked(useMediaQuery).mockReturnValue(true);

		render(
			<CompanionChatMainRow
				presenceHeaderProps={basePresenceHeaderProps}
				leftRail={<div data-testid="left-rail" />}
				mainColumn={<div data-testid="main-column" />}
				rightRail={<div data-testid="right-rail" />}
			/>
		);
		expect(screen.queryByTestId('presence-header')).not.toBeInTheDocument();
	});

	it('keeps presence header for mobile embedded layout even on wide viewport', async () => {
		const { useMediaQuery } = await import('@/hooks/useMediaQuery');
		vi.mocked(useMediaQuery).mockReturnValue(true);

		render(
			<CompanionChatMainRow
				presenceHeaderProps={{
					...basePresenceHeaderProps,
					mobileEmbeddedLayout: true,
				}}
				leftRail={<div data-testid="left-rail" />}
				mainColumn={<div data-testid="main-column" />}
				rightRail={<div data-testid="right-rail" />}
			/>
		);
		expect(screen.getByTestId('presence-header')).toBeInTheDocument();
		expect(screen.getByTestId('main-column')).toBeInTheDocument();
	});

	it('at 1023px (below lg) keeps presence header for mid-desktop ops path', async () => {
		const { useMediaQuery } = await import('@/hooks/useMediaQuery');
		// CompanionChatMainRow: desktopWide = min-width 1024px → false at 1023
		vi.mocked(useMediaQuery).mockReturnValue(false);

		render(
			<CompanionChatMainRow
				presenceHeaderProps={{
					...basePresenceHeaderProps,
					showOperationsEntry: true,
					onOpenOperations: vi.fn(),
				}}
				leftRail={<div data-testid="left-rail" />}
				mainColumn={<div data-testid="main-column" />}
				rightRail={<div data-testid="right-rail" />}
			/>
		);
		expect(screen.getByTestId('presence-header')).toBeInTheDocument();
	});

	it('at 1024px (lg+) omits top presence header — rail is ops source of truth', async () => {
		const { useMediaQuery } = await import('@/hooks/useMediaQuery');
		vi.mocked(useMediaQuery).mockReturnValue(true);

		render(
			<CompanionChatMainRow
				presenceHeaderProps={{
					...basePresenceHeaderProps,
					showOperationsEntry: false,
				}}
				leftRail={<div data-testid="left-rail" />}
				mainColumn={<div data-testid="main-column" />}
				rightRail={<div data-testid="right-rail" />}
			/>
		);
		expect(screen.queryByTestId('presence-header')).not.toBeInTheDocument();
	});
});
