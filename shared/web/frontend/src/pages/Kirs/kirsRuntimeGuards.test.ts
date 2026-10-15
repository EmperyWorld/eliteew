/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for KIRS runtime guardrail decisions in operator console.
 *
 * Invariants:
 * - Pending transitions disable all runtime actions.
 * - Running state never enables `canStart`.
 * - Gallery/public readiness hints map to deterministic operator guidance.
 *
 * Related:
 * - `pages/Kirs/kirsRuntimeGuards.ts`
 * - `pages/Kirs/KirsPage.tsx`
 */
import { describe, expect, it } from 'vitest';
import { computeKirsRuntimeUi, isKirsPendingStatus } from './kirsRuntimeGuards';

describe('kirsRuntimeGuards', () => {
	it('detects pending statuses robustly', () => {
		expect(isKirsPendingStatus('starting')).toBe(true);
		expect(isKirsPendingStatus('ReDeploying')).toBe(true);
		expect(isKirsPendingStatus('running')).toBe(false);
		expect(isKirsPendingStatus('')).toBe(false);
	});

	it('disables all actions while pending', () => {
		const runtime = computeKirsRuntimeUi({
			status: 'starting',
			healthStatus: 'starting',
			apiOk: false,
			publicOk: false,
			publicationState: 'closed',
			hasInstance: true,
			busy: false,
		});

		expect(runtime.isPending).toBe(true);
		expect(runtime.canProvision).toBe(false);
		expect(runtime.canStart).toBe(false);
		expect(runtime.canStop).toBe(false);
		expect(runtime.canRedeploy).toBe(false);
		expect(runtime.nextStepHint).toContain('Операция выполняется');
		expect(runtime.startTitle).toContain('Операция уже выполняется');
		expect(runtime.disabledActionHints).toHaveLength(4);
	});

	it('allows start only for stopped or draft runtime', () => {
		const runtime = computeKirsRuntimeUi({
			status: 'stopped',
			healthStatus: 'offline',
			apiOk: false,
			publicOk: false,
			publicationState: 'closed',
			hasInstance: true,
			busy: false,
		});

		expect(runtime.isRunning).toBe(false);
		expect(runtime.canStart).toBe(true);
		expect(runtime.canStop).toBe(false);
		expect(runtime.canRedeploy).toBe(false);
		expect(runtime.nextStepHint).toContain('подготовить сайт');
		expect(runtime.disabledActionHints).toContain(
			'Поставить на паузу: Сайт уже остановлен.'
		);
		expect(runtime.disabledActionHints).toContain(
			'Обновить сайт: Сначала запустите сайт, затем обновляйте его.'
		);
	});

	it('marks running+api-fail as actionable redeploy scenario', () => {
		const runtime = computeKirsRuntimeUi({
			status: 'running',
			healthStatus: 'running',
			apiOk: false,
			publicOk: false,
			publicationState: 'closed',
			hasInstance: true,
			busy: false,
		});

		expect(runtime.isRunning).toBe(true);
		expect(runtime.canStart).toBe(false);
		expect(runtime.canStop).toBe(true);
		expect(runtime.canRedeploy).toBe(true);
		expect(runtime.nextStepHint).toContain('API недоступен');
		expect(runtime.startTitle).toContain('уже запущен');
		expect(runtime.disabledActionHints).toContain(
			'Запустить сайт: Сайт уже запущен.'
		);
	});

	it('shows publish hint when runtime is healthy but closed', () => {
		const runtime = computeKirsRuntimeUi({
			status: 'running',
			healthStatus: 'running',
			apiOk: true,
			publicOk: false,
			publicationState: 'closed',
			hasInstance: true,
			busy: false,
		});

		expect(runtime.isPublished).toBe(false);
		expect(runtime.nextStepHint).toContain('закрыт для посетителей');
	});

	it('shows ready hint when all checks pass', () => {
		const runtime = computeKirsRuntimeUi({
			status: 'running',
			healthStatus: 'running',
			apiOk: true,
			publicOk: true,
			publicationState: 'open',
			hasInstance: true,
			busy: false,
		});

		expect(runtime.isPublished).toBe(true);
		expect(runtime.nextStepHint).toContain('рабочем состоянии');
	});

	it('respects busy flag as hard lock', () => {
		const runtime = computeKirsRuntimeUi({
			status: 'stopped',
			healthStatus: 'offline',
			apiOk: false,
			publicOk: false,
			publicationState: 'closed',
			hasInstance: true,
			busy: true,
		});

		expect(runtime.canProvision).toBe(false);
		expect(runtime.canStart).toBe(false);
		expect(runtime.canStop).toBe(false);
		expect(runtime.canRedeploy).toBe(false);
		expect(runtime.disabledActionHints).toHaveLength(4);
	});
});
