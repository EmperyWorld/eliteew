/**
 * Tests for /period-close: owner ACL, decisions validation, closeActivePeriod → draft.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPoemmaRepository } from '../../poemmaRepository';
import { buildPoemmaInitiativeVerdictSummary } from '../poemmaPeriodCloseHelpers';
import { PoemmaPeriodClosePage } from '../PoemmaPeriodClosePage';

describe('buildPoemmaInitiativeVerdictSummary', () => {
	it('summarizes go and stop counts', () => {
		expect(
			buildPoemmaInitiativeVerdictSummary([
				{
					id: 'i1',
					periodId: 'p1',
					title: 'Тест',
					story: '',
					status: 'decided',
					verdict: 'go',
					verdictNote: 'ok',
				},
				{
					id: 'i2',
					periodId: 'p1',
					title: 'Стоп',
					story: '',
					status: 'decided',
					verdict: 'stop',
					verdictNote: 'no',
				},
			])
		).toBe('Идеи: 1 go · 1 stop');
	});
});

describe('PoemmaPeriodClosePage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	async function seedActivePeriod(userId: string): Promise<string> {
		const repo = getPoemmaRepository(userId);
		const workspace = await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});
		await repo.savePeriodGoal({
			periodId: workspace.period.id,
			primaryMetricType: 'profit',
			primaryMetricLabel: 'Прибыль',
			targetProfit: 2_000_000,
		});
		await repo.activatePeriod(workspace.period.id);
		return workspace.period.id;
	}

	it('denies non-owner roles', async () => {
		render(
			<PoemmaPeriodClosePage
				ownerUserId="user-close-team"
				userRole="team"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByText('Только для собственника')
		).toBeInTheDocument();
	});

	it('requires three decisions before close', async () => {
		await seedActivePeriod('user-close-validate');

		render(
			<PoemmaPeriodClosePage
				ownerUserId="user-close-validate"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByRole('heading', { name: 'Итоги 90 дней' })
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Закрыть период' }));

		expect(
			await screen.findByText('Заполните три решения на следующий период')
		).toBeInTheDocument();
	});

	it('closes active period and creates draft via repository', async () => {
		const userId = 'user-close-success';
		const periodId = await seedActivePeriod(userId);
		const onPeriodClosed = vi.fn();

		render(
			<PoemmaPeriodClosePage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={vi.fn()}
				onPeriodClosed={onPeriodClosed}
			/>
		);

		expect(
			await screen.findByRole('heading', { name: 'Итоги 90 дней' })
		).toBeInTheDocument();

		const inputs = screen.getAllByRole('textbox');
		const decisionInputs = inputs.slice(-3);
		fireEvent.change(decisionInputs[0], { target: { value: 'Усилить УТП' } });
		fireEvent.change(decisionInputs[1], { target: { value: 'Сегмент B2B' } });
		fireEvent.change(decisionInputs[2], {
			target: { value: 'Проверить отток' },
		});

		fireEvent.click(screen.getByRole('button', { name: 'Закрыть период' }));

		await waitFor(() => {
			expect(onPeriodClosed).toHaveBeenCalled();
		});

		const repo = getPoemmaRepository(userId);
		const periods = await repo.listPeriods();
		const closed = periods.find((item) => item.id === periodId);
		const draft = periods.find((item) => item.status === 'draft');

		expect(closed?.status).toBe('closed');
		expect(draft).toBeTruthy();
		expect(draft?.startDate).toBe(new Date().toISOString().slice(0, 10));

		const review = await repo.getPeriodReview(periodId);
		expect(review?.decisions).toEqual([
			'Усилить УТП',
			'Сегмент B2B',
			'Проверить отток',
		]);
		expect(review?.closedAt).toBeTruthy();

		expect(
			await screen.findByRole('heading', { name: 'Новый период · черновик' })
		).toBeInTheDocument();
	});
});
