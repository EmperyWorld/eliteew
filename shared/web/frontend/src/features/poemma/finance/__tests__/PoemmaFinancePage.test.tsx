/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for /finance profit tab: ACL, validation, persistence, marketplace note.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPoemmaRepository } from '../../poemmaRepository';
import { POEMMA_MARKETPLACE_FLAG_LABEL } from '../poemmaFinanceForm';
import { PoemmaFinancePage } from '../PoemmaFinancePage';

describe('PoemmaFinancePage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	async function seedWorkspace(
		userId: string,
		options?: { targetProfit?: number }
	): Promise<string> {
		const repo = getPoemmaRepository(userId);
		const workspace = await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});
		await repo.savePeriodGoal({
			periodId: workspace.period.id,
			primaryMetricType: 'profit',
			primaryMetricLabel: 'Прибыль',
			targetProfit: options?.targetProfit ?? 1_000_000,
		});
		return workspace.period.id;
	}

	it('denies non-owner roles', async () => {
		render(
			<PoemmaFinancePage
				ownerUserId="user-finance-team"
				userRole="team"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByText('Только для собственника')
		).toBeInTheDocument();
	});

	it('shows plan fact row for owner with goal', async () => {
		await seedWorkspace('user-finance-owner');

		render(
			<PoemmaFinancePage
				ownerUserId="user-finance-owner"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(await screen.findByText('Прибыль · 90 дней')).toBeInTheDocument();
		expect(screen.getByText('План')).toBeInTheDocument();
		expect(screen.getByText('Факт')).toBeInTheDocument();
		expect(
			screen.getByText(/1[\s\u00a0]?000[\s\u00a0]?000/)
		).toBeInTheDocument();
	});

	it('rejects profit <= 0 on save', async () => {
		await seedWorkspace('user-finance-invalid');

		render(
			<PoemmaFinancePage
				ownerUserId="user-finance-invalid"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		await screen.findByLabelText('Прибыль');
		fireEvent.change(screen.getByLabelText('Прибыль'), {
			target: { value: '0' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Ввести вручную' }));

		expect(
			await screen.findByText('Укажите прибыль больше нуля')
		).toBeInTheDocument();
	});

	it('persists manual snapshot and shows source badge', async () => {
		const userId = 'user-finance-save';
		const periodId = await seedWorkspace(userId, { targetProfit: 800_000 });
		const repo = getPoemmaRepository(userId);

		render(
			<PoemmaFinancePage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		await screen.findByLabelText('Прибыль');
		fireEvent.change(screen.getByLabelText('Выручка'), {
			target: { value: '3000000' },
		});
		fireEvent.change(screen.getByLabelText('Прибыль'), {
			target: { value: '400000' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Ввести вручную' }));

		await waitFor(() => {
			expect(screen.getByText('Цифры сохранены')).toBeInTheDocument();
		});
		expect(screen.getByText(/^вручную · /)).toBeInTheDocument();
		expect(screen.getByText('50%')).toBeInTheDocument();

		const saved = await repo.getFinanceSnapshot(periodId);
		expect(saved?.profit).toBe(400_000);
		expect(saved?.revenue).toBe(3_000_000);
		expect(saved?.source).toBe('manual');
	});

	it('saves marketplace flag and custom note', async () => {
		const userId = 'user-finance-marketplace';
		const periodId = await seedWorkspace(userId);
		const repo = getPoemmaRepository(userId);

		render(
			<PoemmaFinancePage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		await screen.findByLabelText('Прибыль');
		fireEvent.change(screen.getByLabelText('Прибыль'), {
			target: { value: '100000' },
		});
		fireEvent.click(
			screen.getByRole('checkbox', { name: POEMMA_MARKETPLACE_FLAG_LABEL })
		);
		fireEvent.change(await screen.findByLabelText('Заметка о маркетплейсе'), {
			target: { value: 'Wildberries без маржи' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Ввести вручную' }));

		await waitFor(() => {
			expect(screen.getByText('Цифры сохранены')).toBeInTheDocument();
		});

		const saved = await repo.getFinanceSnapshot(periodId);
		expect(saved?.marketplaceNote).toBe('Wildberries без маржи');
		expect(screen.getByText(POEMMA_MARKETPLACE_FLAG_LABEL)).toBeInTheDocument();
	});

	it('navigates to goal plan screen', async () => {
		await seedWorkspace('user-finance-goal-nav');
		const onNavigate = vi.fn();

		render(
			<PoemmaFinancePage
				ownerUserId="user-finance-goal-nav"
				userRole="owner"
				onNavigate={onNavigate}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'План →' }));
		expect(onNavigate).toHaveBeenCalledWith('/goal');
	});
});
