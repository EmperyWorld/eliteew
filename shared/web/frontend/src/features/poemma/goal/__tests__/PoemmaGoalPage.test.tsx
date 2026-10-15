/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for /goal screen: owner plan save, validation, finance CTA, team ACL.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPoemmaRepository } from '../../poemmaRepository';
import {
	buildPoemmaPeriodRollingLabel,
	PoemmaGoalPage,
} from '../PoemmaGoalPage';

describe('buildPoemmaPeriodRollingLabel', () => {
	it('returns rolling label with start date', () => {
		expect(
			buildPoemmaPeriodRollingLabel({
				id: 'p1',
				orgId: 'org-1',
				startDate: '2026-06-03',
				endDate: '2026-09-01',
				status: 'draft',
			})
		).toMatch(/^90 дней · с /);
	});
});

describe('PoemmaGoalPage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	async function seedWorkspace(userId: string): Promise<void> {
		const repo = getPoemmaRepository(userId);
		const workspace = await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});
		await repo.savePeriodGoal({
			periodId: workspace.period.id,
			primaryMetricType: 'profit',
			primaryMetricLabel: 'Прибыль',
			targetProfit: 1_500_000,
		});
	}

	it('denies non-owner roles', async () => {
		render(
			<PoemmaGoalPage
				ownerUserId="user-goal-team"
				userRole="team"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByText('Только для собственника')
		).toBeInTheDocument();
	});

	it('shows period label and saved profit plan for owner', async () => {
		await seedWorkspace('user-goal-owner');

		render(
			<PoemmaGoalPage
				ownerUserId="user-goal-owner"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByRole('heading', { name: 'Цель 90 дней' })
		).toBeInTheDocument();
		expect(screen.getByText(/90 дней · с/)).toBeInTheDocument();
		expect(
			screen.getByText(/1[\s\u00a0]?500[\s\u00a0]?000/)
		).toBeInTheDocument();
	});

	it('rejects profit plan <= 0', async () => {
		await seedWorkspace('user-goal-invalid');

		render(
			<PoemmaGoalPage
				ownerUserId="user-goal-invalid"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		await screen.findByLabelText('План прибыли');
		const input = screen.getByLabelText('План прибыли');
		fireEvent.change(input, { target: { value: '0' } });
		fireEvent.click(screen.getByRole('button', { name: 'Сохранить план' }));

		expect(
			await screen.findByText('Укажите прибыль больше нуля')
		).toBeInTheDocument();
	});

	it('navigates to finance on fact CTA', async () => {
		await seedWorkspace('user-goal-finance');

		const onNavigate = vi.fn();
		render(
			<PoemmaGoalPage
				ownerUserId="user-goal-finance"
				userRole="owner"
				onNavigate={onNavigate}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'Ввести факт' }));
		expect(onNavigate).toHaveBeenCalledWith('/finance');
	});

	it('persists valid profit plan', async () => {
		const userId = 'user-goal-save';
		await seedWorkspace(userId);
		const repo = getPoemmaRepository(userId);
		const period = await repo.getCurrentPeriod();
		expect(period).not.toBeNull();
		if (!period) {
			throw new Error('Expected current period');
		}

		render(
			<PoemmaGoalPage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		const input = await screen.findByLabelText('План прибыли');
		fireEvent.change(input, { target: { value: '2000000' } });
		fireEvent.click(screen.getByRole('button', { name: 'Сохранить план' }));

		await waitFor(() => {
			expect(screen.getByText('План сохранён')).toBeInTheDocument();
		});

		const saved = await repo.getPeriodGoal(period.id);
		expect(saved?.targetProfit).toBe(2_000_000);
	});
});
