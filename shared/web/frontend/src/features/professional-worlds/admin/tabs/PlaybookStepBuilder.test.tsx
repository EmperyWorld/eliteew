/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component coverage for the Professional Worlds admin playbook step editor.
 *
 * Invariants:
 * - Step controls must be labeled for operators and assistive tech.
 * - Invalid JSON stays visible so operators can repair it without losing edits.
 *
 * Related:
 * - PlaybookStepBuilder.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PlaybookStepBuilder } from './PlaybookStepBuilder';

describe('PlaybookStepBuilder', () => {
	it('labels action and move controls with human copy', () => {
		render(
			<PlaybookStepBuilder
				availableActions={[
					{
						action_key: 'listing_quality_audit',
						display_name: 'Listing quality audit',
					},
				]}
				steps={[
					{
						step_order: 1,
						action_key: 'listing_quality_audit',
						input_mapping: {},
						stop_on_error: true,
					},
				]}
				onChange={vi.fn()}
			/>
		);

		expect(screen.getByText(/Step action|Действие шага/)).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: /Move step 1 up|Переместить шаг 1 выше/,
			})
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: /Move step 1 down|Переместить шаг 1 ниже/,
			})
		).toBeInTheDocument();
		expect(
			screen.getByText(/Step input mapping|Соответствие входных полей/)
		).toBeInTheDocument();
	});

	it('keeps invalid mapping text visible for repair', () => {
		const onChange = vi.fn();
		render(
			<PlaybookStepBuilder
				availableActions={[
					{
						action_key: 'listing_quality_audit',
						display_name: 'Listing quality audit',
					},
				]}
				steps={[
					{
						step_order: 1,
						action_key: 'listing_quality_audit',
						input_mapping: {},
						stop_on_error: true,
					},
				]}
				onChange={onChange}
			/>
		);

		const mapping = screen.getByDisplayValue('{}');
		fireEvent.change(mapping, { target: { value: '{"property":' } });
		fireEvent.blur(mapping);

		expect(screen.getByDisplayValue('{"property":')).toBeInTheDocument();
		expect(screen.getByText(/JSON error|Ошибка JSON/)).toBeInTheDocument();
		expect(onChange).not.toHaveBeenCalled();
	});
});
