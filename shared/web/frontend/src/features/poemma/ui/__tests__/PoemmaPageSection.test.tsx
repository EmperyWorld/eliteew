/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke tests for POEMMA section chrome (readable titles, helper callout, framed body).
 *
 * Invariants:
 * - Presentation-only; no API or repository mocks.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaPageSection.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PoemmaPageSection } from '../PoemmaPageSection';

describe('PoemmaPageSection', () => {
	it('renders section label as accessible heading', () => {
		render(
			<PoemmaPageSection label="Решение" helper="Коротко зафиксируйте итог.">
				<p>Тело раздела</p>
			</PoemmaPageSection>
		);

		expect(
			screen.getByRole('heading', { name: 'Решение', level: 2 })
		).toBeInTheDocument();
		expect(screen.getByText('Коротко зафиксируйте итог.')).toBeInTheDocument();
		expect(screen.getByText('Тело раздела')).toBeInTheDocument();
	});

	it('wraps children in framed body when variant is framed', () => {
		const { container } = render(
			<PoemmaPageSection label="Чеклист" variant="framed">
				<span data-testid="inner">Пункт</span>
			</PoemmaPageSection>
		);

		const inner = screen.getByTestId('inner');
		const framed = inner.closest('div');
		expect(framed).not.toBe(container.firstChild);
		expect(inner).toBeInTheDocument();
	});
});
