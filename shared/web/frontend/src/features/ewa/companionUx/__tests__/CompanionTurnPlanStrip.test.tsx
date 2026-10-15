/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionTurnPlanStrip (U8.3 slice 9).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionTurnPlanStrip } from '@/features/ewa/companionUx/CompanionTurnPlanStrip';

describe('CompanionTurnPlanStrip', () => {
	it('renders queued continue action', () => {
		const onContinue = vi.fn();
		render(
			<CompanionTurnPlanStrip
				turnPlanVisual={{
					hint: 'Next step',
					nextTool: 'music_generation',
					source: null,
					queued: true,
				}}
				pending={false}
				onContinue={onContinue}
			/>
		);
		expect(
			screen.getByTestId('ewa-companion-turn-plan-strip')
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Запустить отложенный шаг',
			})
		);
		expect(onContinue).toHaveBeenCalledOnce();
	});

	it('returns null when turn plan visual is absent', () => {
		const { container } = render(
			<CompanionTurnPlanStrip
				turnPlanVisual={null}
				pending={false}
				onContinue={vi.fn()}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});
});
