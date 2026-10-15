/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Poemma team tasks (P-501, P-502): members, tabs, ACL, list labels.
 *
 * Invariants:
 * - Owner sees all tasks; team roles see only tasks assigned to them.
 * - List titles ≤5 words (marketing-cabinet-wireframes.md §14).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §14
 * - src/features/poemma/poemmaDomain.ts
 */

import type {
	PoemmaTeamTask,
	PoemmaTeamTaskStatus,
	PoemmaUserId,
	PoemmaUserRole,
} from '../poemmaDomain';

export const POEMMA_TEAM_LIST_MAX_WORDS = 5;

export type PoemmaTeamTab = 'mine' | 'waiting_owner' | 'done';

export const POEMMA_TEAM_TAB_LABELS: Record<PoemmaTeamTab, string> = {
	mine: 'Мои',
	waiting_owner: 'Ждут Зою',
	done: 'Готово',
};

export interface PoemmaTeamMember {
	id: PoemmaUserId;
	displayName: string;
}

/** Dev mock members — wireframe §14 (Зоя, Мария, Игорь). */
export const POEMMA_TEAM_MEMBERS: PoemmaTeamMember[] = [
	{ id: 'member-zoya', displayName: 'Зоя' },
	{ id: 'member-maria', displayName: 'Мария' },
	{ id: 'member-igor', displayName: 'Игорь' },
];

export type PoemmaTeamTaskLinkType = NonNullable<PoemmaTeamTask['linkType']>;

export const POEMMA_TEAM_LINK_TYPE_LABELS: Record<
	PoemmaTeamTaskLinkType,
	string
> = {
	none: 'нет',
	initiative: 'идея',
	promotion: 'акция',
	utp: 'УТП',
	strategy: 'стратегия',
};

export const POEMMA_TEAM_STATUS_LABELS: Record<PoemmaTeamTaskStatus, string> = {
	todo: 'В работе',
	waiting_owner: 'Ждёт Зою',
	done: 'Готово',
};

const TAB_STATUS: Record<PoemmaTeamTab, PoemmaTeamTaskStatus> = {
	mine: 'todo',
	waiting_owner: 'waiting_owner',
	done: 'done',
};

export function isPoemmaTeamOwner(role: PoemmaUserRole): boolean {
	return role === 'owner';
}

export function canPoemmaRoleCreateTeamTasks(role: PoemmaUserRole): boolean {
	return role === 'owner';
}

export function resolvePoemmaTeamMemberId(role: PoemmaUserRole): PoemmaUserId {
	if (role === 'owner') {
		return 'member-zoya';
	}
	if (role === 'manager') {
		return 'member-igor';
	}
	return 'member-maria';
}

export function resolvePoemmaTeamMemberDisplayName(
	assigneeId: PoemmaUserId | undefined,
	ownerDisplayName?: string
): string {
	if (!assigneeId) {
		return '—';
	}
	if (assigneeId === 'member-zoya') {
		return ownerDisplayName?.trim() || 'Зоя';
	}
	const member = POEMMA_TEAM_MEMBERS.find((item) => item.id === assigneeId);
	return member?.displayName ?? assigneeId;
}

export function truncatePoemmaTeamListTitle(title: string): string {
	const words = title.trim().split(/\s+/u).filter(Boolean);
	if (words.length <= POEMMA_TEAM_LIST_MAX_WORDS) {
		return words.join(' ');
	}
	return `${words.slice(0, POEMMA_TEAM_LIST_MAX_WORDS).join(' ')}…`;
}

export function countPoemmaTeamTitleWords(title: string): number {
	return title.trim().split(/\s+/u).filter(Boolean).length;
}

export function validatePoemmaTeamTaskDraft(input: {
	title: string;
}): string | null {
	if (!input.title.trim()) {
		return 'Укажите название';
	}
	if (countPoemmaTeamTitleWords(input.title) > POEMMA_TEAM_LIST_MAX_WORDS) {
		return `Не больше ${POEMMA_TEAM_LIST_MAX_WORDS} слов в названии`;
	}
	return null;
}

export function canPoemmaMemberEditTask(
	task: PoemmaTeamTask,
	role: PoemmaUserRole,
	memberId: PoemmaUserId
): boolean {
	if (isPoemmaTeamOwner(role)) {
		return true;
	}
	return task.assigneeId === memberId;
}

export function canPoemmaMemberToggleTaskDone(
	task: PoemmaTeamTask,
	role: PoemmaUserRole,
	memberId: PoemmaUserId
): boolean {
	return canPoemmaMemberEditTask(task, role, memberId);
}

export function filterPoemmaTeamTasksByTab(
	tasks: PoemmaTeamTask[],
	tab: PoemmaTeamTab,
	role: PoemmaUserRole,
	memberId: PoemmaUserId
): PoemmaTeamTask[] {
	const status = TAB_STATUS[tab];
	return tasks.filter((task) => {
		if (task.status !== status) {
			return false;
		}
		if (isPoemmaTeamOwner(role)) {
			return true;
		}
		return task.assigneeId === memberId;
	});
}

export function sortPoemmaTeamTasksForList(
	tasks: PoemmaTeamTask[]
): PoemmaTeamTask[] {
	return [...tasks].sort((a, b) => {
		const dueA = a.dueDate ?? '9999-12-31';
		const dueB = b.dueDate ?? '9999-12-31';
		const byDue = dueA.localeCompare(dueB);
		if (byDue !== 0) {
			return byDue;
		}
		return a.title.localeCompare(b.title, 'ru');
	});
}

export function formatPoemmaTeamTaskDueDate(
	dueDate: string | undefined
): string {
	if (!dueDate) {
		return '';
	}
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: '2-digit',
	}).format(new Date(`${dueDate}T00:00:00.000Z`));
}

export function formatPoemmaTeamTaskMetaLine(
	task: PoemmaTeamTask,
	ownerDisplayName?: string
): string {
	const assignee = resolvePoemmaTeamMemberDisplayName(
		task.assigneeId,
		ownerDisplayName
	);
	const parts: string[] = [assignee];

	if (task.status === 'waiting_owner') {
		parts.push('ждёт Зою');
	} else if (task.dueDate) {
		parts.push(`до ${formatPoemmaTeamTaskDueDate(task.dueDate)}`);
	}

	if (task.linkType && task.linkType !== 'none') {
		parts.push(POEMMA_TEAM_LINK_TYPE_LABELS[task.linkType]);
	}

	return parts.join(' · ');
}

export function createEmptyPoemmaTeamTaskDraft(
	orgId: string
): Omit<PoemmaTeamTask, 'id'> {
	return {
		orgId,
		title: '',
		assigneeId: POEMMA_TEAM_MEMBERS[1]?.id,
		dueDate: '',
		status: 'todo',
		linkType: 'none',
	};
}

export function togglePoemmaTeamTaskDone(
	task: PoemmaTeamTask,
	checked: boolean
): PoemmaTeamTask {
	return {
		...task,
		status: checked ? 'done' : 'todo',
	};
}
