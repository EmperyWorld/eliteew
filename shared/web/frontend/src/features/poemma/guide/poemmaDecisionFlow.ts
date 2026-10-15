/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * MVP decision-tree config: root + three branches (P-405, P-408, P-409).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §16
 * - poemma/docs/implementation/COPY-RU.md (guide.*)
 * - poemma/docs/implementation/domain-model.ts (DecisionNode)
 */

export type PoemmaGuideNavigateTarget =
	| '/strategy'
	| '/strategy?view=utp'
	| '/customer-path'
	| '/finance'
	| '/ideas'
	| '/happiness'
	| '/promo';

export type PoemmaDecisionBranchId = 'strategy' | 'utp' | 'retention';

export interface PoemmaDecisionChoice {
	id: string;
	label: string;
	/** Left-column prompt on root secondary rows (wireframes §16). */
	prompt?: string;
	nextNodeId?: string;
	route?: PoemmaGuideNavigateTarget;
}

export type PoemmaDecisionNodeLayout = 'root' | 'binary' | 'terminal';

export interface PoemmaDecisionNode {
	id: string;
	branchId?: PoemmaDecisionBranchId;
	title: string;
	description: string;
	sectionLabel?: string;
	stepIndex?: number;
	stepTotal?: number;
	layout: PoemmaDecisionNodeLayout;
	choices: PoemmaDecisionChoice[];
	secondaryChoices?: PoemmaDecisionChoice[];
}

export const POEMMA_DECISION_ROOT_ID = 'root';

export const POEMMA_DECISION_NODE_IDS = {
	root: POEMMA_DECISION_ROOT_ID,
	retentionChurn: 'retention-churn',
	retentionIdea: 'retention-idea',
	retentionLock: 'retention-lock',
	profitFunnel: 'profit-funnel',
} as const;

const RETENTION_STEP_TOTAL = 4;

export const POEMMA_DECISION_NODES: Record<string, PoemmaDecisionNode> = {
	[POEMMA_DECISION_ROOT_ID]: {
		id: POEMMA_DECISION_ROOT_ID,
		title: 'Что делать',
		description: 'Три входа: смысл, отличие, удержание клиентов.',
		sectionLabel: 'Дерево',
		layout: 'root',
		choices: [
			{
				id: 'root-strategy',
				label: 'Нужна стратегия',
				route: '/strategy',
			},
			{
				id: 'root-utp',
				label: 'Нужно УТП',
				route: '/strategy?view=utp',
			},
			{
				id: 'root-retention',
				label: 'Новый → постоянный',
				nextNodeId: POEMMA_DECISION_NODE_IDS.retentionChurn,
			},
		],
		secondaryChoices: [
			{
				id: 'root-profit',
				prompt: 'Прибыль ниже плана?',
				label: 'Смотреть цифры',
				nextNodeId: POEMMA_DECISION_NODE_IDS.profitFunnel,
			},
			{
				id: 'root-happiness',
				prompt: 'Опыт не совпал?',
				label: 'Открыть опыт',
				route: '/happiness',
			},
			{
				id: 'root-promo',
				prompt: 'Есть деньги?',
				label: 'Создать акцию',
				route: '/promo',
			},
		],
	},
	[POEMMA_DECISION_NODE_IDS.retentionChurn]: {
		id: POEMMA_DECISION_NODE_IDS.retentionChurn,
		branchId: 'retention',
		title: 'Отток вырос?',
		description:
			'Сравните отток за месяц. Если цифр нет — введите вручную на пути клиента.',
		sectionLabel: 'Удержание',
		stepIndex: 2,
		stepTotal: RETENTION_STEP_TOTAL,
		layout: 'binary',
		choices: [
			{
				id: 'retention-churn-yes',
				label: 'Да',
				nextNodeId: POEMMA_DECISION_NODE_IDS.retentionIdea,
			},
			{
				id: 'retention-churn-no',
				label: 'Нет',
				nextNodeId: POEMMA_DECISION_NODE_IDS.retentionLock,
			},
		],
	},
	[POEMMA_DECISION_NODE_IDS.retentionIdea]: {
		id: POEMMA_DECISION_NODE_IDS.retentionIdea,
		branchId: 'retention',
		title: 'Идея удержания',
		description:
			'Запишите гипотезу: что мешает клиенту вернуться и как проверите за 90 дней.',
		sectionLabel: 'Удержание',
		stepIndex: 3,
		stepTotal: RETENTION_STEP_TOTAL,
		layout: 'terminal',
		choices: [
			{
				id: 'retention-idea-open',
				label: 'Открыть идеи',
				route: '/ideas',
			},
			{
				id: 'retention-idea-back',
				label: 'Назад',
				nextNodeId: POEMMA_DECISION_NODE_IDS.retentionChurn,
			},
		],
	},
	[POEMMA_DECISION_NODE_IDS.retentionLock]: {
		id: POEMMA_DECISION_NODE_IDS.retentionLock,
		branchId: 'retention',
		title: 'Закрепить практику',
		description:
			'Отток стабилен — зафиксируйте этапы пути, которые уже работают, и передайте команде.',
		sectionLabel: 'Удержание',
		stepIndex: 3,
		stepTotal: RETENTION_STEP_TOTAL,
		layout: 'terminal',
		choices: [
			{
				id: 'retention-lock-open',
				label: 'Открыть путь',
				route: '/customer-path',
			},
			{
				id: 'retention-lock-back',
				label: 'Назад',
				nextNodeId: POEMMA_DECISION_NODE_IDS.retentionChurn,
			},
		],
	},
	[POEMMA_DECISION_NODE_IDS.profitFunnel]: {
		id: POEMMA_DECISION_NODE_IDS.profitFunnel,
		title: 'Прибыль ниже плана',
		description:
			'Откройте цифры и воронку менеджеров — найдите этап с просадкой конверсии.',
		sectionLabel: 'Цифры',
		stepIndex: 1,
		stepTotal: 2,
		layout: 'binary',
		choices: [
			{
				id: 'profit-funnel-open',
				label: 'Открыть цифры',
				route: '/finance',
			},
			{
				id: 'profit-funnel-back',
				label: 'Назад',
				nextNodeId: POEMMA_DECISION_ROOT_ID,
			},
		],
	},
};

export const POEMMA_DECISION_BRANCH_ROOT_CHOICE_IDS: Record<
	PoemmaDecisionBranchId,
	string
> = {
	strategy: 'root-strategy',
	utp: 'root-utp',
	retention: 'root-retention',
};

export function getPoemmaDecisionNode(
	nodeId: string
): PoemmaDecisionNode | undefined {
	return POEMMA_DECISION_NODES[nodeId];
}

export function getPoemmaDecisionRoot(): PoemmaDecisionNode {
	return POEMMA_DECISION_NODES[POEMMA_DECISION_ROOT_ID];
}

export function listPoemmaDecisionNodeIds(): string[] {
	return Object.keys(POEMMA_DECISION_NODES);
}

export function listPoemmaDecisionBranchIds(): PoemmaDecisionBranchId[] {
	return ['strategy', 'utp', 'retention'];
}

export function poemmaDecisionProgressLabel(
	node: PoemmaDecisionNode
): string | null {
	if (node.stepIndex == null || node.stepTotal == null) {
		return null;
	}
	return `Шаг ${node.stepIndex} из ${node.stepTotal}`;
}

export function resolvePoemmaDecisionChoice(choice: PoemmaDecisionChoice): {
	nextNodeId?: string;
	route?: PoemmaGuideNavigateTarget;
} {
	return {
		nextNodeId: choice.nextNodeId,
		route: choice.route,
	};
}

export function findPoemmaDecisionChoice(
	nodeId: string,
	choiceId: string
): PoemmaDecisionChoice | undefined {
	const node = getPoemmaDecisionNode(nodeId);
	if (!node) {
		return undefined;
	}
	return (
		node.choices.find((choice) => choice.id === choiceId) ??
		node.secondaryChoices?.find((choice) => choice.id === choiceId)
	);
}

/** Home block E: `/guide?branch=…` opens the branch step, not the root. */
export function resolvePoemmaGuideStartNodeId(
	branchId?: PoemmaDecisionBranchId | null
): string {
	if (!branchId) {
		return POEMMA_DECISION_ROOT_ID;
	}
	const choice = getPoemmaDecisionBranchEntryChoice(branchId);
	const resolved = resolvePoemmaDecisionChoice(choice);
	return resolved.nextNodeId ?? POEMMA_DECISION_ROOT_ID;
}

export function parsePoemmaGuideBranchParam(
	value: string | null | undefined
): PoemmaDecisionBranchId | undefined {
	if (value === 'strategy' || value === 'utp' || value === 'retention') {
		return value;
	}
	return undefined;
}

export function getPoemmaDecisionBranchEntryChoice(
	branchId: PoemmaDecisionBranchId
): PoemmaDecisionChoice {
	const choiceId = POEMMA_DECISION_BRANCH_ROOT_CHOICE_IDS[branchId];
	const choice = findPoemmaDecisionChoice(POEMMA_DECISION_ROOT_ID, choiceId);
	if (!choice) {
		throw new Error(`Missing root choice for branch ${branchId}`);
	}
	return choice;
}

/** Validates graph integrity for tests and dev guards. */
export function validatePoemmaDecisionFlow(): string[] {
	const errors: string[] = [];

	for (const node of Object.values(POEMMA_DECISION_NODES)) {
		const allChoices = [...node.choices, ...(node.secondaryChoices ?? [])];

		for (const choice of allChoices) {
			if (choice.nextNodeId && !POEMMA_DECISION_NODES[choice.nextNodeId]) {
				errors.push(
					`Choice ${choice.id} points to missing node ${choice.nextNodeId}`
				);
			}
			if (!choice.nextNodeId && !choice.route) {
				errors.push(`Choice ${choice.id} has no next node or route`);
			}
		}

		if (node.layout === 'binary' && node.choices.length !== 2) {
			errors.push(`Binary node ${node.id} must have exactly 2 choices`);
		}
	}

	const root = getPoemmaDecisionRoot();
	if (root.choices.length !== 3) {
		errors.push('Root must expose exactly three primary branches');
	}

	return errors;
}
