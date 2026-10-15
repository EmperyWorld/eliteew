import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPoemmaRepository } from '../../poemmaRepository';

describe('poemmaRepository team tasks', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('lists, gets and saves team tasks per orgId', async () => {
		const repo = getPoemmaRepository('user-team-repo');
		const { org } = await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});

		expect(await repo.listTeamTasks(org.id)).toEqual([]);

		const task = {
			id: 'task-1',
			orgId: org.id,
			title: 'Согласовать этикетку',
			assigneeId: 'member-maria',
			dueDate: '2026-06-10',
			status: 'todo' as const,
			linkType: 'utp' as const,
		};

		await repo.saveTeamTask(task);

		expect(await repo.getTeamTask(org.id, 'task-1')).toEqual(task);
		expect(await repo.listTeamTasks(org.id)).toHaveLength(1);

		await repo.saveTeamTask({ ...task, status: 'done' });
		expect((await repo.getTeamTask(org.id, 'task-1'))?.status).toBe('done');
	});

	it('rejects empty task title', async () => {
		const repo = getPoemmaRepository('user-team-repo-empty');
		const { org } = await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});

		await expect(
			repo.saveTeamTask({
				id: 'task-empty',
				orgId: org.id,
				title: '   ',
				status: 'todo',
			})
		).rejects.toThrow(/Название задачи/);
	});
});
