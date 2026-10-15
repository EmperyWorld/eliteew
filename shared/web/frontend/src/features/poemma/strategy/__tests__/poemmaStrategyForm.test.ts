import { describe, expect, it } from 'vitest';
import {
	buildPoemmaTeamBrief,
	canPoemmaTeamAcknowledgeStrategy,
	countPoemmaAlignmentProgress,
	createEmptyPoemmaStrategy,
	isPoemmaStrategyOwner,
	normalizePoemmaStrategyValues,
	resolvePoemmaStrategyView,
	validatePoemmaStrategyDraft,
} from '../poemmaStrategyForm';

describe('poemmaStrategyForm', () => {
	it('resolves utp view from hash', () => {
		expect(resolvePoemmaStrategyView('#utp')).toBe('utp');
		expect(resolvePoemmaStrategyView('')).toBe('main');
	});

	it('limits team brief to five sentences', () => {
		const brief = buildPoemmaTeamBrief({
			utp: 'Первое. Второе. Третье.',
			mission: 'Четвёртое. Пятое. Шестое.',
			vision: 'Седьмое.',
		});
		expect(brief.split(/(?<=[.!?])\s+/u)).toHaveLength(5);
		expect(brief).not.toContain('Шестое');
	});

	it('validates owner draft', () => {
		expect(
			validatePoemmaStrategyDraft({
				vision: '',
				mission: 'Миссия',
				values: ['а', 'б', 'в'],
				utp: 'УТП',
			})
		).toBe('Заполните видение');
		expect(
			validatePoemmaStrategyDraft({
				vision: 'Видение',
				mission: 'Миссия',
				values: ['а', 'б'],
				utp: 'УТП',
			})
		).toBe('Добавьте минимум 3 ценности');
	});

	it('counts alignment progress with utp checklist item', () => {
		const progress = countPoemmaAlignmentProgress(
			{
				vision: 'Видение',
				mission: 'Миссия',
				values: ['а', 'б', 'в'],
				utp: 'УТП',
				teamUnderstood: true,
			},
			{
				primaryMetricType: 'profit',
				primaryMetricLabel: 'Прибыль',
				targetProfit: 100,
			}
		);
		expect(progress).toEqual({ done: 5, total: 5 });
	});

	it('scopes roles for edit and acknowledge', () => {
		expect(isPoemmaStrategyOwner('owner')).toBe(true);
		expect(isPoemmaStrategyOwner('manager')).toBe(false);
		expect(canPoemmaTeamAcknowledgeStrategy('team')).toBe(true);
		expect(canPoemmaTeamAcknowledgeStrategy('manager')).toBe(false);
	});

	it('creates default strategy with three value slots', () => {
		const strategy = createEmptyPoemmaStrategy('org-1', 'user-1');
		expect(strategy.values).toEqual(['', '', '']);
		expect(normalizePoemmaStrategyValues(strategy.values)).toEqual([]);
	});
});
