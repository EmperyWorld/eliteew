/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for UGS workflow payload normalizers and i18n label/error helpers.
 *
 * Invariants:
 * - Malformed workflows/executions are skipped.
 * - Backend `started`/`processing` execution states normalize to UI `running`.
 * - User-facing helper copy is resolved via `ugsHub` EN resources.
 *
 * Related:
 * - components/UGS/workflows/utils.ts
 * - i18n/locales/en/ugsHub.json
 */

import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import enUgsHub from '@/i18n/locales/en/ugsHub.json';

import {
	formatEstimatedTime,
	formatRuntimeError,
	getDisabledExecuteLabel,
	getWorkflowExecutionStatusLabel,
	normalizeExecutionList,
	normalizeWorkflowList,
} from '../utils';
import type { WorkflowRecord } from '../types';

const i18n = createInstance();

beforeAll(async () => {
	await i18n.use(initReactI18next).init({
		lng: 'en',
		resources: { en: { ugsHub: enUgsHub } },
		interpolation: { escapeValue: false },
	});
});

describe('workflow payload guards', () => {
	it('normalizes wrapped workflow lists and drops malformed rows', () => {
		const workflows = normalizeWorkflowList({
			workflows: [
				{
					id: 'wf-1',
					workflow_name: 'Workflow',
					created_at: '2026-05-28T00:00:00Z',
					is_public: true,
				},
				{ id: 'bad' },
			],
		} as unknown as Parameters<typeof normalizeWorkflowList>[0]);

		expect(workflows).toHaveLength(1);
		expect(workflows[0]?.id).toBe('wf-1');
		expect(workflows[0]?.is_public).toBe(true);
	});

	it('normalizes execution status aliases', () => {
		const payload = {
			executions: [
				{
					id: 'exec-1',
					workflow_id: 'wf-1',
					status: 'started',
					created_at: '2026-05-28T00:00:00Z',
				},
				{ id: 'bad', status: 'completed' },
			],
		} as unknown as Parameters<typeof normalizeExecutionList>[0];
		const executions = normalizeExecutionList(payload);

		expect(executions).toHaveLength(1);
		expect(executions[0]?.status).toBe('running');
	});

	it('keeps actionable EN labels for execution and provider errors', () => {
		const t = i18n.getFixedT('en', 'ugsHub');
		expect(getWorkflowExecutionStatusLabel(t, 'running')).toBe('Running');
		expect(getWorkflowExecutionStatusLabel(t, 'failed')).toBe('Failed');
		expect(
			formatRuntimeError(t, 'Cannot connect to host stack2-comfyui:3000')
		).toMatch(/No connection to UGS media node/i);
		expect(formatRuntimeError(t, 'timeout waiting for image')).toMatch(
			/did not respond in time/i
		);
		expect(formatEstimatedTime(t, 45)).toBe('~45s');
		expect(formatEstimatedTime(t, 120)).toBe('~2m');
	});

	it('labels disabled workflow execution modes with recovery hints', () => {
		const t = i18n.getFixedT('en', 'ugsHub');
		expect(
			getDisabledExecuteLabel(t, {
				execution_mode: 'requires_image_input',
			} as WorkflowRecord)
		).toBe('File required');
		expect(
			getDisabledExecuteLabel(t, {
				execution_mode: 'requires_audio_input',
			} as WorkflowRecord)
		).toBe('Audio file required');
	});
});
