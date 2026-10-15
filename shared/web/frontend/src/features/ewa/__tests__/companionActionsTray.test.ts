/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion actions tray visibility contract (no full chat panel mount).
 *
 * Related:
 * - src/features/ewa/companionActionsTray.ts
 */
import { describe, expect, it } from 'vitest';
import {
	actionTrayOutcomeI18nKey,
	actionsTrayGroupSectionI18nKey,
	buildActionsTrayCollapsedLabelArgs,
	COMPANION_ACTIONS_TRAY_COLLAPSED_I18N_KEY,
	filterVisibleCompanionActions,
	groupCompanionActionsTrayRows,
	shouldShowActionsTray,
	shouldShowActionsTrayGroupHeaders,
	shouldShowOutcomeBadge,
	readCompanionActionTaskRunId,
	stampCompanionActionsWithTaskRunId,
} from '@/features/ewa/companionActionsTray';

type TestAction = {
	id: string;
	closed: boolean;
};

const row = (id: string, closed: boolean): TestAction => ({ id, closed });

describe('companionActionsTray', () => {
	describe('filterVisibleCompanionActions', () => {
		it('returns empty array for empty records', () => {
			expect(filterVisibleCompanionActions([])).toEqual([]);
		});

		it('hides all closed records', () => {
			const records = [row('a', true), row('b', true)];
			expect(filterVisibleCompanionActions(records)).toEqual([]);
		});

		it('keeps only non-closed records', () => {
			const records = [
				row('open', false),
				row('closed', true),
				row('also', false),
			];
			expect(filterVisibleCompanionActions(records)).toEqual([
				row('open', false),
				row('also', false),
			]);
		});
	});

	describe('shouldShowActionsTray', () => {
		it('is false when there are no visible actions', () => {
			expect(shouldShowActionsTray(true, 0)).toBe(false);
			expect(shouldShowActionsTray(false, 0)).toBe(false);
		});

		it('is false when composer is hidden even with visible actions', () => {
			expect(shouldShowActionsTray(false, 3)).toBe(false);
		});

		it('is true when composer is visible and count is greater than zero', () => {
			expect(shouldShowActionsTray(true, 1)).toBe(true);
			expect(shouldShowActionsTray(true, 5)).toBe(true);
		});
	});

	describe('buildActionsTrayCollapsedLabelArgs', () => {
		it('uses the canonical collapsed tray i18n key with count', () => {
			expect(buildActionsTrayCollapsedLabelArgs(2)).toEqual({
				key: COMPANION_ACTIONS_TRAY_COLLAPSED_I18N_KEY,
				options: { count: 2 },
			});
		});
	});

	describe('shouldShowOutcomeBadge', () => {
		it('is false for undefined and ok', () => {
			expect(shouldShowOutcomeBadge(undefined)).toBe(false);
			expect(shouldShowOutcomeBadge('ok')).toBe(false);
		});

		it('is true for blocked and failed', () => {
			expect(shouldShowOutcomeBadge('blocked')).toBe(true);
			expect(shouldShowOutcomeBadge('failed')).toBe(true);
		});
	});

	describe('actionTrayOutcomeI18nKey', () => {
		it('maps blocked and failed to tray badge keys', () => {
			expect(actionTrayOutcomeI18nKey('blocked')).toBe(
				'ewaCompanion.actionOutcomeBlocked'
			);
			expect(actionTrayOutcomeI18nKey('failed')).toBe(
				'ewaCompanion.actionOutcomeFailed'
			);
		});
	});

	describe('task run link helpers', () => {
		it('reads task_run_id from action rows', () => {
			expect(readCompanionActionTaskRunId({ task_run_id: ' run-1 ' })).toBe(
				'run-1'
			);
			expect(readCompanionActionTaskRunId({})).toBeUndefined();
		});

		it('stamps missing task_run_id from final task_run snapshot', () => {
			const actions = [{ type: 'open_app' as const, task_run_id: undefined }];
			const out = stampCompanionActionsWithTaskRunId(actions, { id: 'run-2' });
			expect(out[0]?.task_run_id).toBe('run-2');
		});

		it('does not overwrite existing task_run_id', () => {
			const actions = [{ task_run_id: 'keep' }];
			const out = stampCompanionActionsWithTaskRunId(actions, { id: 'other' });
			expect(out[0]?.task_run_id).toBe('keep');
		});
	});

	describe('groupCompanionActionsTrayRows', () => {
		type Row = { id: string; kind: 'open' | 'close' | 'notice' };

		it('orders groups open → close → notice and preserves rows within group', () => {
			const rows: Row[] = [
				{ id: 'n1', kind: 'notice' },
				{ id: 'o1', kind: 'open' },
				{ id: 'c1', kind: 'close' },
				{ id: 'o2', kind: 'open' },
			];
			const groups = groupCompanionActionsTrayRows(rows);
			expect(groups.map((g) => g.kind)).toEqual([
				'open',
				'close',
				'focus',
				'minimize',
				'web_search',
				'notice',
			]);
			expect(groups[0]?.rows.map((r) => r.id)).toEqual(['o1', 'o2']);
			expect(groups[1]?.rows.map((r) => r.id)).toEqual(['c1']);
			expect(groups[5]?.rows.map((r) => r.id)).toEqual(['n1']);
		});
	});

	describe('shouldShowActionsTrayGroupHeaders', () => {
		it('is false for zero or one non-empty group', () => {
			expect(shouldShowActionsTrayGroupHeaders([])).toBe(false);
			expect(
				shouldShowActionsTrayGroupHeaders([
					{ rows: [] },
					{ rows: [{ id: 'a' }] },
				])
			).toBe(false);
		});

		it('is true when two or more groups have rows', () => {
			expect(
				shouldShowActionsTrayGroupHeaders([
					{ rows: [{ id: 'a' }] },
					{ rows: [{ id: 'b' }] },
				])
			).toBe(true);
		});
	});

	describe('actionsTrayGroupSectionI18nKey', () => {
		it('maps each tray kind to a section label key', () => {
			expect(actionsTrayGroupSectionI18nKey('open')).toBe(
				'ewaCompanion.actionsTrayGroupOpened'
			);
			expect(actionsTrayGroupSectionI18nKey('notice')).toBe(
				'ewaCompanion.actionsTrayGroupNotices'
			);
		});
	});
});
