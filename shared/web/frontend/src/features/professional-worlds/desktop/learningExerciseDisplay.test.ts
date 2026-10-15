/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for learning exercise display formatting.
 *
 * Related:
 * - learningExerciseDisplay.ts
 */
import { describe, expect, it } from 'vitest';

import { formatLearningExercise } from './learningExerciseDisplay';

describe('formatLearningExercise', () => {
	it('prefers prompt field from object exercises', () => {
		expect(
			formatLearningExercise({ prompt: '  Сформулируйте ответ клиенту.  ' })
		).toEqual({
			primary: 'Сформулируйте ответ клиенту.',
			raw: { prompt: '  Сформулируйте ответ клиенту.  ' },
		});
	});

	it('joins string steps into primary text', () => {
		expect(
			formatLearningExercise({
				steps: ['Шаг 1', 'Шаг 2'],
			})
		).toEqual({
			primary: 'Шаг 1\nШаг 2',
			raw: { steps: ['Шаг 1', 'Шаг 2'] },
		});
	});

	it('returns raw object when no readable primary exists', () => {
		expect(formatLearningExercise({ meta: { level: 2 } })).toEqual({
			primary: null,
			raw: { meta: { level: 2 } },
		});
	});
});
