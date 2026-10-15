import { describe, expect, it } from 'vitest';
import {
	findPoemmaDecisionChoice,
	getPoemmaDecisionBranchEntryChoice,
	getPoemmaDecisionNode,
	getPoemmaDecisionRoot,
	listPoemmaDecisionBranchIds,
	listPoemmaDecisionNodeIds,
	POEMMA_DECISION_NODE_IDS,
	POEMMA_DECISION_ROOT_ID,
	poemmaDecisionProgressLabel,
	resolvePoemmaDecisionChoice,
	validatePoemmaDecisionFlow,
} from '../poemmaDecisionFlow';

describe('poemmaDecisionFlow', () => {
	it('exposes root with three primary branches', () => {
		const root = getPoemmaDecisionRoot();
		expect(root.id).toBe(POEMMA_DECISION_ROOT_ID);
		expect(root.choices).toHaveLength(3);
		expect(root.choices.map((choice) => choice.label)).toEqual([
			'Нужна стратегия',
			'Нужно УТП',
			'Новый → постоянный',
		]);
	});

	it('maps branch entries to routes or retention sub-flow', () => {
		const strategy = getPoemmaDecisionBranchEntryChoice('strategy');
		expect(resolvePoemmaDecisionChoice(strategy).route).toBe('/strategy');

		const utp = getPoemmaDecisionBranchEntryChoice('utp');
		expect(resolvePoemmaDecisionChoice(utp).route).toBe('/strategy?view=utp');

		const retention = getPoemmaDecisionBranchEntryChoice('retention');
		expect(resolvePoemmaDecisionChoice(retention).nextNodeId).toBe(
			POEMMA_DECISION_NODE_IDS.retentionChurn
		);
	});

	it('implements retention churn sub-branch (P-409)', () => {
		const churn = getPoemmaDecisionNode(
			POEMMA_DECISION_NODE_IDS.retentionChurn
		);
		expect(churn?.layout).toBe('binary');
		expect(churn?.choices).toHaveLength(2);

		const yes = findPoemmaDecisionChoice(
			POEMMA_DECISION_NODE_IDS.retentionChurn,
			'retention-churn-yes'
		);
		const no = findPoemmaDecisionChoice(
			POEMMA_DECISION_NODE_IDS.retentionChurn,
			'retention-churn-no'
		);

		expect(yes?.nextNodeId).toBe(POEMMA_DECISION_NODE_IDS.retentionIdea);
		expect(no?.nextNodeId).toBe(POEMMA_DECISION_NODE_IDS.retentionLock);

		const ideaOpen = findPoemmaDecisionChoice(
			POEMMA_DECISION_NODE_IDS.retentionIdea,
			'retention-idea-open'
		);
		const lockOpen = findPoemmaDecisionChoice(
			POEMMA_DECISION_NODE_IDS.retentionLock,
			'retention-lock-open'
		);

		expect(ideaOpen).toBeDefined();
		expect(lockOpen).toBeDefined();
		if (!ideaOpen || !lockOpen) {
			throw new Error('Decision choices must exist');
		}
		expect(resolvePoemmaDecisionChoice(ideaOpen).route).toBe('/ideas');
		expect(resolvePoemmaDecisionChoice(lockOpen).route).toBe('/customer-path');
	});

	it('links profit fallback to finance (P-408)', () => {
		const profitChoice = findPoemmaDecisionChoice(
			POEMMA_DECISION_ROOT_ID,
			'root-profit'
		);
		expect(profitChoice?.nextNodeId).toBe(
			POEMMA_DECISION_NODE_IDS.profitFunnel
		);

		const openFinance = findPoemmaDecisionChoice(
			POEMMA_DECISION_NODE_IDS.profitFunnel,
			'profit-funnel-open'
		);
		expect(openFinance).toBeDefined();
		if (!openFinance) {
			throw new Error('Finance choice must exist');
		}
		expect(resolvePoemmaDecisionChoice(openFinance).route).toBe('/finance');
	});

	it('labels branch progress for binary steps', () => {
		const churn = getPoemmaDecisionNode(
			POEMMA_DECISION_NODE_IDS.retentionChurn
		);
		expect(churn).toBeDefined();
		if (!churn) {
			throw new Error('Retention churn node must exist');
		}
		expect(poemmaDecisionProgressLabel(churn)).toBe('Шаг 2 из 4');
		expect(poemmaDecisionProgressLabel(getPoemmaDecisionRoot())).toBeNull();
	});

	it('lists all MVP branches and passes graph validation', () => {
		expect(listPoemmaDecisionBranchIds()).toEqual([
			'strategy',
			'utp',
			'retention',
		]);
		expect(listPoemmaDecisionNodeIds().length).toBeGreaterThanOrEqual(5);
		expect(validatePoemmaDecisionFlow()).toEqual([]);
	});
});
