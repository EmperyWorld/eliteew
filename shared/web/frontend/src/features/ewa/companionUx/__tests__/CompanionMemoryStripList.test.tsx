/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionMemoryStripList forget affordance (U6.3).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionMemoryStripList } from '@/features/ewa/companionUx/CompanionMemoryStripList';

describe('CompanionMemoryStripList', () => {
	it('calls onForgetRequest for forgettable rows', () => {
		const onForgetRequest = vi.fn();
		render(
			<CompanionMemoryStripList
				rows={[
					{
						key: 'hash-1',
						label: 'Prefers tea',
						contentHash: 'hash-1',
						forgettable: true,
					},
					{
						key: 'syn:catalog',
						label: 'Catalog line',
						contentHash: null,
						forgettable: false,
					},
				]}
				onForgetRequest={onForgetRequest}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Забыть «Prefers tea»' })
		);
		expect(onForgetRequest).toHaveBeenCalledWith(
			expect.objectContaining({ contentHash: 'hash-1' })
		);
	});
});
