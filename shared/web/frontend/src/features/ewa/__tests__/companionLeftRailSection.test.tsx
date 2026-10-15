/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component-level coverage for the EWA companion rail accordion shell.
 *
 * Invariants:
 * - Accordion content is shown only when parent marks the section as expanded.
 *
 * Related:
 * - src/features/ewa/companionLeftRailSection.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionLeftRailSection } from '@/features/ewa/companionLeftRailSection';

vi.mock('@/features/ewa/ewaIcons/EwaIcon', () => ({
	EwaIcon: ({ name }: { name: string }) => (
		<span data-testid={`ewa-icon-${name}`} />
	),
}));

describe('CompanionLeftRailSection', () => {
	it('keeps accordion toggle contract with premium rail chrome', () => {
		const onToggle = vi.fn();

		const { container, rerender } = render(
			<CompanionLeftRailSection
				sectionId="memory"
				expandedSection={null}
				onToggle={onToggle}
				icon="icon-ewa-brain"
				title="Memory"
				badge={3}
			>
				<div>Stored context</div>
			</CompanionLeftRailSection>
		);

		expect(screen.queryByText('Stored context')).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Memory/ }));
		expect(onToggle).toHaveBeenCalledWith('memory');

		rerender(
			<CompanionLeftRailSection
				sectionId="memory"
				expandedSection="memory"
				onToggle={onToggle}
				icon="icon-ewa-brain"
				title="Memory"
				badge={3}
			>
				<div>Stored context</div>
			</CompanionLeftRailSection>
		);

		expect(screen.getByText('Stored context')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(container.innerHTML).not.toContain('violet');
		expect(container.innerHTML).toContain('--companion-divider');
	});
});
