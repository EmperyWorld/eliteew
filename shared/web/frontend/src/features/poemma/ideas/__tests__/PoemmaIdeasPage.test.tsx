/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for /ideas list: ACL, filters, create flow, embedded detail route.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPoemmaRepository } from '../../poemmaRepository';
import { PoemmaIdeasPage } from '../PoemmaIdeasPage';

describe('PoemmaIdeasPage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	async function seedWorkspace(userId: string) {
		const repo = getPoemmaRepository(userId);
		const workspace = await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});
		await repo.saveInitiative({
			id: 'idea-backlog',
			periodId: workspace.period.id,
			title: 'Скидка сетям',
			story: 'B2B гипотеза',
			source: 'B2B',
			status: 'backlog',
		});
		await repo.saveInitiative({
			id: 'idea-testing',
			periodId: workspace.period.id,
			title: 'Коллаб Приморье',
			story: 'Форум',
			source: 'Форум ВЭФ',
			status: 'testing',
		});
		await repo.saveInitiative({
			id: 'idea-decided',
			periodId: workspace.period.id,
			title: 'Новая этикетка',
			story: 'Упаковка',
			status: 'decided',
			verdict: 'go',
			verdictNote: 'Запускаем',
		});
		return workspace;
	}

	it('denies manager role', async () => {
		render(
			<PoemmaIdeasPage
				ownerUserId="user-ideas-manager"
				userRole="manager"
				onNavigate={vi.fn()}
			/>
		);
		expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
	});

	it('lists ideas and filters by testing tab', async () => {
		await seedWorkspace('user-ideas-list');

		render(
			<PoemmaIdeasPage
				ownerUserId="user-ideas-list"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByRole('heading', { name: 'Идеи' })
		).toBeInTheDocument();
		expect(screen.getByText('Коллаб Приморье')).toBeInTheDocument();
		expect(screen.getByText('Скидка сетям')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Проверяем' }));
		expect(screen.getByText('Коллаб Приморье')).toBeInTheDocument();
		expect(screen.queryByText('Скидка сетям')).not.toBeInTheDocument();
	});

	it('creates idea and navigates to detail', async () => {
		const userId = 'user-ideas-create';
		await seedWorkspace(userId);
		const onNavigate = vi.fn();

		render(
			<PoemmaIdeasPage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={onNavigate}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: '+ Идея' }));
		fireEvent.change(screen.getByLabelText('Название идеи'), {
			target: { value: 'Тестовая идея' },
		});
		fireEvent.change(screen.getByLabelText('История идеи'), {
			target: { value: 'Описание гипотезы' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

		await waitFor(() => {
			expect(onNavigate).toHaveBeenCalledWith(
				expect.stringMatching(/^\/ideas\/initiative-/)
			);
		});
	});

	it('renders embedded detail when ideaId is set', async () => {
		await seedWorkspace('user-ideas-detail');

		render(
			<PoemmaIdeasPage
				ownerUserId="user-ideas-detail"
				userRole="owner"
				onNavigate={vi.fn()}
				ideaId="idea-testing"
			/>
		);

		expect(
			await screen.findByRole('heading', { name: 'Коллаб Приморье' })
		).toBeInTheDocument();
		expect(screen.getByText('Форум')).toBeInTheDocument();
	});
});
