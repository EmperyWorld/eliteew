/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke render for /guide — catches missing Desktop chrome imports (section labels).
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PoemmaGuidePage } from '../PoemmaGuidePage';

describe('PoemmaGuidePage', () => {
	it('renders branch section label without ReferenceError', async () => {
		render(<PoemmaGuidePage onNavigate={vi.fn()} initialBranch="retention" />);

		await waitFor(() => {
			expect(screen.getByText('Удержание')).toBeInTheDocument();
		});
	});
});
