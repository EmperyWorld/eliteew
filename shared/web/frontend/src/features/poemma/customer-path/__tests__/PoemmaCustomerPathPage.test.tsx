/**
 * Tests for /customer-path (P-404, P-410): stages, churn empty state, ideas CTA.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createDefaultPoemmaCustomerPathStages,
	poemmaCustomerPathPainLabel,
} from '../../poemmaDomain';
import { getPoemmaRepository } from '../../poemmaRepository';
import { PoemmaCustomerPathPage } from '../PoemmaCustomerPathPage';

describe('poemmaCustomerPathPainLabel', () => {
	it('labels pain between bought and repeat', () => {
		expect(
			poemmaCustomerPathPainLabel(createDefaultPoemmaCustomerPathStages())
		).toBe('между «Купил» и «Повтор»');
	});
});

describe('PoemmaCustomerPathPage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	async function seedWorkspace(userId: string): Promise<void> {
		const repo = getPoemmaRepository(userId);
		await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});
	}

	it('shows stage chain and churn empty state', async () => {
		await seedWorkspace('user-path-1');

		render(
			<PoemmaCustomerPathPage
				ownerUserId="user-path-1"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByRole('heading', { name: 'Путь клиента' })
		).toBeInTheDocument();
		expect(screen.getByText('Узнал')).toBeInTheDocument();
		expect(screen.getByText('Рекомендует')).toBeInTheDocument();
		expect(screen.getByText('Нет оттока')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Ввести' })).toBeInTheDocument();
	});

	it('navigates to ideas from + Идея', async () => {
		await seedWorkspace('user-path-2');
		const onNavigate = vi.fn();

		render(
			<PoemmaCustomerPathPage
				ownerUserId="user-path-2"
				userRole="owner"
				onNavigate={onNavigate}
			/>
		);

		await screen.findByText('Идеи удержания');
		fireEvent.click(screen.getAllByRole('button', { name: '+ Идея' })[0]);
		expect(onNavigate).toHaveBeenCalledWith('/ideas');
	});

	it('shows ideas empty state when no initiatives', async () => {
		await seedWorkspace('user-path-3');

		render(
			<PoemmaCustomerPathPage
				ownerUserId="user-path-3"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(await screen.findByText('Нет идей')).toBeInTheDocument();
	});

	it('lists initiatives and saves manual churn', async () => {
		const userId = 'user-path-4';
		await seedWorkspace(userId);
		const repo = getPoemmaRepository(userId);
		const org = await repo.getOrg();
		const period = await repo.getCurrentPeriod();
		expect(org).not.toBeNull();
		expect(period).not.toBeNull();
		if (!period) {
			throw new Error('Expected current period');
		}

		await repo.saveInitiative({
			id: 'idea-1',
			periodId: period.id,
			title: 'Программа для сетей',
			story: 'Удержание B2B',
			source: 'путь клиента',
			status: 'testing',
		});

		render(
			<PoemmaCustomerPathPage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(await screen.findByText('Программа для сетей')).toBeInTheDocument();
		expect(screen.queryByText('Нет идей')).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Ввести' }));
		const input = screen.getByPlaceholderText('12');
		fireEvent.change(input, { target: { value: '12' } });
		fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

		await waitFor(() => {
			expect(screen.getByText('12 / мес')).toBeInTheDocument();
		});
	});
});
