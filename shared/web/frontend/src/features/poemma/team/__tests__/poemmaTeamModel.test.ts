import { describe, expect, it } from 'vitest';
import type { PoemmaTeamTask } from '../../poemmaDomain';
import {
	filterPoemmaTeamTasksByTab,
	resolvePoemmaTeamMemberId,
	truncatePoemmaTeamListTitle,
	validatePoemmaTeamTaskDraft,
} from '../poemmaTeamModel';

const ORG_ID = 'org-team-test';

function task(
	overrides: Partial<PoemmaTeamTask> &
		Pick<PoemmaTeamTask, 'id' | 'title' | 'status'>
): PoemmaTeamTask {
	return {
		orgId: ORG_ID,
		assigneeId: 'member-maria',
		...overrides,
	};
}

describe('poemmaTeamModel', () => {
	it('truncates list titles to five words', () => {
		expect(
			truncatePoemmaTeamListTitle('Согласовать этикетку для новой линейки B2B')
		).toBe('Согласовать этикетку для новой линейки…');
	});

	it('validates title word count', () => {
		expect(
			validatePoemmaTeamTaskDraft({
				title: 'Согласовать этикетку для новой линейки B2B',
			})
		).toMatch(/5 слов/);
		expect(
			validatePoemmaTeamTaskDraft({ title: 'Согласовать этикетку' })
		).toBeNull();
	});

	it('maps dev roles to mock member ids', () => {
		expect(resolvePoemmaTeamMemberId('owner')).toBe('member-zoya');
		expect(resolvePoemmaTeamMemberId('team')).toBe('member-maria');
		expect(resolvePoemmaTeamMemberId('manager')).toBe('member-igor');
	});

	it('owner sees all tasks in tab; team only assigned', () => {
		const tasks: PoemmaTeamTask[] = [
			task({ id: 't1', title: 'Мария todo', status: 'todo' }),
			task({
				id: 't2',
				title: 'Игорь todo',
				status: 'todo',
				assigneeId: 'member-igor',
			}),
		];

		expect(
			filterPoemmaTeamTasksByTab(tasks, 'mine', 'owner', 'member-zoya')
		).toHaveLength(2);

		expect(
			filterPoemmaTeamTasksByTab(tasks, 'mine', 'team', 'member-maria')
		).toHaveLength(1);
		expect(
			filterPoemmaTeamTasksByTab(tasks, 'mine', 'team', 'member-maria')[0]?.id
		).toBe('t1');
	});

	it('filters waiting_owner tab by status and assignee', () => {
		const tasks: PoemmaTeamTask[] = [
			task({
				id: 'w1',
				title: 'Ждёт Зоя',
				status: 'waiting_owner',
				assigneeId: 'member-igor',
			}),
			task({
				id: 'w2',
				title: 'Ждёт Мария',
				status: 'waiting_owner',
				assigneeId: 'member-maria',
			}),
		];

		expect(
			filterPoemmaTeamTasksByTab(tasks, 'waiting_owner', 'owner', 'member-zoya')
		).toHaveLength(2);
		expect(
			filterPoemmaTeamTasksByTab(
				tasks,
				'waiting_owner',
				'manager',
				'member-igor'
			)
		).toHaveLength(1);
	});
});
