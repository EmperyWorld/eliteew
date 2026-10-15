/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock prefers-reduced-motion path for UGS Hub empty state (static div).
 *
 * Related:
 * - ../UgsHubEmptyState.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', async (importOriginal) => {
	const actual = await importOriginal<typeof import('framer-motion')>();
	return {
		...actual,
		useReducedMotion: () => true,
	};
});

import { UgsHubEmptyState } from '../UgsHubEmptyState';

describe('UgsHubEmptyState reduced motion', () => {
	it('renders static empty state when prefers-reduced-motion', () => {
		render(
			<UgsHubEmptyState
				title="Пусто"
				description="Нет задач"
				actionLabel="Обновить"
				onAction={vi.fn()}
			/>
		);

		const root = screen.getByTestId('ugs-hub-empty-state');
		expect(root.getAttribute('data-reduced-motion')).toBe('true');
		expect(screen.getByText('Пусто')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Обновить' })
		).toBeInTheDocument();
	});
});
