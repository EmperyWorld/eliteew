/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Lock AdminJsonPreview New World atom (no Old World chrome).
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminJsonPreview } from '../atoms/AdminJsonPreview';

describe('AdminJsonPreview', () => {
	it('renders titled JSON details without Old World chrome classes', () => {
		const { container } = render(
			<AdminJsonPreview
				value={{ action_key: 'listing_quality_audit' }}
				title="Before"
				helper="Operator-only snapshot"
			/>
		);

		expect(screen.getByText('Before')).toBeInTheDocument();
		expect(screen.getByText('Operator-only snapshot')).toBeInTheDocument();
		expect(screen.getByText(/listing_quality_audit/)).toBeInTheDocument();
		expect(container.innerHTML).not.toMatch(/--desktop-border-subtle/);
		expect(container.innerHTML).toMatch(/admin-ui-border/);
	});
});
