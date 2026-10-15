/**
 * Tests for /happiness (P-302…P-306): balance status, scores persistence, team ACL, signals CRUD.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPoemmaExperienceBalance } from '../poemmaExperience';
import { PoemmaHappinessPage } from '../PoemmaHappinessPage';
import { getPoemmaRepository } from '../../poemmaRepository';

describe('PoemmaHappinessPage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	async function seedOrg(userId: string): Promise<string> {
		const repo = getPoemmaRepository(userId);
		const workspace = await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});
		return workspace.org.id;
	}

	it('shows В балансе for owner when scores 80 and 78', async () => {
		const userId = 'user-happy-balance';
		const orgId = await seedOrg(userId);
		const repo = getPoemmaRepository(userId);
		await repo.saveExperienceBalance(
			buildPoemmaExperienceBalance({
				orgId,
				employeeScore: 80,
				clientScore: 78,
			})
		);

		render(
			<PoemmaHappinessPage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByRole('heading', { name: 'Опыт совпал?' })
		).toBeInTheDocument();
		expect(screen.getByText('В балансе')).toBeInTheDocument();
		expect(screen.getByText('80')).toBeInTheDocument();
		expect(screen.getByText('78')).toBeInTheDocument();
	});

	it('shows gap status when scores diverge', async () => {
		const userId = 'user-happy-gap';
		const orgId = await seedOrg(userId);
		const repo = getPoemmaRepository(userId);
		await repo.saveExperienceBalance(
			buildPoemmaExperienceBalance({
				orgId,
				employeeScore: 80,
				clientScore: 50,
			})
		);

		render(
			<PoemmaHappinessPage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(await screen.findByText('Есть разрыв')).toBeInTheDocument();
	});

	it('team sees read-only banner without edit controls', async () => {
		const userId = 'user-happy-team';
		const orgId = await seedOrg(userId);
		const repo = getPoemmaRepository(userId);
		await repo.saveExperienceBalance(
			buildPoemmaExperienceBalance({
				orgId,
				employeeScore: 70,
				clientScore: 68,
			})
		);

		render(
			<PoemmaHappinessPage
				ownerUserId={userId}
				userRole="team"
				onNavigate={vi.fn()}
			/>
		);

		expect(await screen.findByText('Только просмотр')).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Изменить' })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: '+ Добавить отзыв' })
		).not.toBeInTheDocument();
		expect(screen.getByText('В балансе')).toBeInTheDocument();
	});

	it('owner can add and list happiness signal', async () => {
		const userId = 'user-happy-signal';
		await seedOrg(userId);

		render(
			<PoemmaHappinessPage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		fireEvent.click(
			await screen.findByRole('button', { name: '+ Добавить отзыв' })
		);
		const textArea = await screen.findByLabelText('Текст отзыва');
		fireEvent.change(textArea, { target: { value: 'повторила заказ' } });
		fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

		await waitFor(() => {
			expect(screen.getByText(/повторила заказ/)).toBeInTheDocument();
		});

		const repo = getPoemmaRepository(userId);
		const org = await repo.getOrg();
		expect(org).not.toBeNull();
		if (!org) {
			throw new Error('Expected organization');
		}
		const signals = await repo.listHappinessSignals(org.id);
		expect(signals).toHaveLength(1);
		expect(signals[0]?.text).toBe('повторила заказ');
	});
});
