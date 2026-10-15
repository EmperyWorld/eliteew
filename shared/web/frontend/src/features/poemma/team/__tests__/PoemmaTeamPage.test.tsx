/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for /team screen: ACL, tabs, owner create, team filter.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPoemmaRepository } from '../../poemmaRepository';
import { PoemmaTeamPage } from '../PoemmaTeamPage';

describe('PoemmaTeamPage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	async function seedWorkspace(userId: string): Promise<string> {
		const repo = getPoemmaRepository(userId);
		const workspace = await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя Ясная',
		});
		return workspace.org.id;
	}

	it('owner sees create button and all tasks', async () => {
		const orgId = await seedWorkspace('user-team-owner');
		const repo = getPoemmaRepository('user-team-owner');
		await repo.saveTeamTask({
			id: 'task-maria',
			orgId,
			title: 'Согласовать этикетку',
			assigneeId: 'member-maria',
			status: 'todo',
			linkType: 'utp',
		});
		await repo.saveTeamTask({
			id: 'task-igor',
			orgId,
			title: 'Ответить Лэтуаль',
			assigneeId: 'member-igor',
			status: 'waiting_owner',
			linkType: 'none',
		});

		render(
			<PoemmaTeamPage
				ownerUserId="user-team-owner"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByRole('heading', { name: 'Команда', level: 1 })
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: '+ Задача' })
		).toBeInTheDocument();
		expect(screen.getByText('Согласовать этикетку')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('tab', { name: 'Ждут Зою' }));
		expect(await screen.findByText('Ответить Лэтуаль')).toBeInTheDocument();
	});

	it('team role sees only assigned tasks on Мои tab', async () => {
		const orgId = await seedWorkspace('user-team-member');
		const repo = getPoemmaRepository('user-team-member');
		await repo.saveTeamTask({
			id: 'mine',
			orgId,
			title: 'Моя задача',
			assigneeId: 'member-maria',
			status: 'todo',
		});
		await repo.saveTeamTask({
			id: 'other',
			orgId,
			title: 'Чужая задача',
			assigneeId: 'member-igor',
			status: 'todo',
		});

		render(
			<PoemmaTeamPage
				ownerUserId="user-team-member"
				userRole="team"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByText('Видны только ваши задачи.')
		).toBeInTheDocument();
		expect(screen.getByText('Моя задача')).toBeInTheDocument();
		expect(screen.queryByText('Чужая задача')).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: '+ Задача' })
		).not.toBeInTheDocument();
	});

	it('owner can create task via form', async () => {
		await seedWorkspace('user-team-create');

		render(
			<PoemmaTeamPage
				ownerUserId="user-team-create"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: '+ Задача' }));
		fireEvent.change(screen.getByLabelText('Название задачи'), {
			target: { value: 'Обновить прайс сети' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

		await waitFor(() => {
			expect(screen.getByText('Обновить прайс сети')).toBeInTheDocument();
		});
	});
});
