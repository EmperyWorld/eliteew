/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused coverage for shared premium EWA companion UI primitives.
 *
 * Invariants:
 * - Primitives stay presentational and preserve native button/span/div semantics.
 *
 * Related:
 * - src/features/ewa/companionPremiumPrimitives.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
	CompanionGlassCard,
	CompanionGlassSection,
	CompanionHeroCard,
	CompanionIconTile,
	CompanionPillBadge,
	CompanionPillButton,
} from '@/features/ewa/companionPremiumPrimitives';

describe('companionPremiumPrimitives', () => {
	it('keeps shared glass and pill controls semantic', () => {
		const onClick = vi.fn();

		render(
			<CompanionGlassCard data-testid="glass-card" tone="muted">
				<CompanionPillBadge>3</CompanionPillBadge>
				<CompanionPillButton onClick={onClick}>Open</CompanionPillButton>
			</CompanionGlassCard>
		);

		expect(screen.getByTestId('glass-card')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Open' }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('keeps section semantics for surface shells', () => {
		render(
			<CompanionGlassSection aria-label="Operations shell">
				Panel
			</CompanionGlassSection>
		);

		expect(
			screen.getByRole('region', { name: 'Operations shell' })
		).toBeInTheDocument();
	});

	it('renders hero and icon primitives without adding behavior', () => {
		render(
			<CompanionHeroCard>
				<CompanionIconTile data-testid="icon-tile">Icon</CompanionIconTile>
				<CompanionPillBadge tone="success">Ready</CompanionPillBadge>
			</CompanionHeroCard>
		);

		expect(screen.getByTestId('icon-tile')).toHaveTextContent('Icon');
		expect(screen.getByText('Ready')).toBeInTheDocument();
	});
});
