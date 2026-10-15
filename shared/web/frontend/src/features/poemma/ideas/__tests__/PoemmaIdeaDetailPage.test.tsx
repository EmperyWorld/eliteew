/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for /ideas/:id — verdict requires comment, owner save, team ACL.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPoemmaRepository } from '../../poemmaRepository';
import { PoemmaIdeaDetailPage } from '../PoemmaIdeaDetailPage';

describe('PoemmaIdeaDetailPage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	async function seedTestingIdea(userId: string) {
		const repo = getPoemmaRepository(userId);
		const workspace = await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});
		await repo.saveInitiative({
			id: 'idea-verdict',
			periodId: workspace.period.id,
			title: 'Коллаб Приморье',
			story: 'Полный текст идеи',
			source: 'Форум ВЭФ',
			status: 'testing',
		});
		return workspace;
	}

	it('blocks team from saving verdict', async () => {
		await seedTestingIdea('user-idea-team');

		render(
			<PoemmaIdeaDetailPage
				ownerUserId="user-idea-team"
				userRole="team"
				onNavigate={vi.fn()}
				ideaId="idea-verdict"
			/>
		);

		expect(
			await screen.findByText('Вердикт — собственник')
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Идём' })).toBeDisabled();
		expect(
			screen.queryByRole('button', { name: 'Сохранить решение' })
		).toBeNull();
	});

	it('requires comment before verdict save', async () => {
		await seedTestingIdea('user-idea-validate');

		render(
			<PoemmaIdeaDetailPage
				ownerUserId="user-idea-validate"
				userRole="owner"
				onNavigate={vi.fn()}
				ideaId="idea-verdict"
			/>
		);

		await screen.findByRole('button', { name: 'Идём' });
		fireEvent.click(screen.getByRole('button', { name: 'Идём' }));
		fireEvent.click(screen.getByRole('button', { name: 'Сохранить решение' }));

		expect(
			await screen.findByText('Комментарий к решению обязателен')
		).toBeInTheDocument();
	});

	it('persists verdict with comment for owner', async () => {
		const userId = 'user-idea-save';
		await seedTestingIdea(userId);
		const repo = getPoemmaRepository(userId);
		const period = await repo.getCurrentPeriod();
		expect(period).not.toBeNull();
		if (!period) {
			throw new Error('Expected current period');
		}

		render(
			<PoemmaIdeaDetailPage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={vi.fn()}
				ideaId="idea-verdict"
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'Стоп' }));
		fireEvent.change(screen.getByLabelText('Комментарий к решению'), {
			target: { value: 'Рано для коллаба' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Сохранить решение' }));

		await waitFor(() => {
			expect(screen.getByText('Решение сохранено')).toBeInTheDocument();
		});

		const items = await repo.listInitiatives(period.id);
		const saved = items.find((item) => item.id === 'idea-verdict');
		expect(saved?.status).toBe('decided');
		expect(saved?.verdict).toBe('stop');
		expect(saved?.verdictNote).toBe('Рано для коллаба');
	});

	it('navigates back to ideas list', async () => {
		await seedTestingIdea('user-idea-back');

		const onNavigate = vi.fn();
		render(
			<PoemmaIdeaDetailPage
				ownerUserId="user-idea-back"
				userRole="owner"
				onNavigate={onNavigate}
				ideaId="idea-verdict"
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: '← Идеи' }));
		expect(onNavigate).toHaveBeenCalledWith('/ideas');
	});
});
