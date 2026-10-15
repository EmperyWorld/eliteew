/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral keyboard shortcuts for SurveyQuestionStep (wave 26).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SurveyQuestionStep } from '../SurveyQuestionStep';
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			if (key === 'runner.yes') return 'Yes';
			if (key === 'runner.no') return 'No';
			if (key === 'runner.stepOf') {
				return `Q ${opts?.current}/${opts?.total}`;
			}
			return key;
		},
	}),
}));

const singleChoiceQuestion: SurveyQuestion = {
	id: 'q-color',
	question_key: 'color',
	question_type: 'single_choice',
	prompt: 'Pick a color',
	required: true,
	sort_order: 0,
	options_json: { choices: ['Red', 'Green', 'Blue'] },
	validation_json: {},
};

const npsQuestion: SurveyQuestion = {
	id: 'q-nps',
	question_key: 'nps',
	question_type: 'nps',
	prompt: 'Recommend?',
	required: true,
	sort_order: 0,
	options_json: {},
	validation_json: {},
};

describe('SurveyQuestionStep keyboard', () => {
	it('selects choice with number key 2', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		const onError = vi.fn();
		render(
			<SurveyQuestionStep
				question={singleChoiceQuestion}
				stepIndex={0}
				stepTotal={3}
				value={null}
				onChange={onChange}
				errorKey={null}
				onError={onError}
			/>
		);
		await user.keyboard('2');
		expect(onChange).toHaveBeenCalledWith('Green');
		expect(onError).toHaveBeenCalledWith(null);
	});

	it('adjusts NPS with arrow keys when scale chip focused', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		const onError = vi.fn();
		render(
			<SurveyQuestionStep
				question={npsQuestion}
				stepIndex={0}
				stepTotal={1}
				value={5}
				onChange={onChange}
				errorKey={null}
				onError={onError}
			/>
		);
		const chipFive = screen.getByRole('button', { name: '5' });
		chipFive.focus();
		await user.keyboard('{ArrowRight}');
		expect(onChange).toHaveBeenCalledWith(6);
		expect(onError).toHaveBeenCalledWith(null);
	});
});
