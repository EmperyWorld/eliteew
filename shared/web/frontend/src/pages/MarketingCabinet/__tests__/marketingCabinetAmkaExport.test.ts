import { describe, expect, it } from 'vitest';

import { buildAmkaRunExportMarkdown } from '@/pages/MarketingCabinet/marketingCabinetAmkaExport';
import type {
	AmkaRun,
	AmkaRunStep,
} from '@/pages/MarketingCabinet/marketingCabinetApi';

describe('buildAmkaRunExportMarkdown', () => {
	it('includes ensemble metadata for execute steps', () => {
		const run: AmkaRun = {
			id: 'run-1',
			project_id: 'project-1',
			company_id: 'company-1',
			created_by_user_id: 'user-1',
			scope_key: 'all_visible',
			status: 'completed',
			progress: 100,
			master_plan: [],
			final_assessment: {},
			metrics_before: {},
			metrics_after: {},
			error_payload: {},
		};
		const steps: AmkaRunStep[] = [
			{
				id: 'step-1',
				run_id: 'run-1',
				ordinal: 19,
				title: 'Evidence',
				stage_kind: 'execute_section',
				section_key: 'evidence',
				status: 'completed',
				plan_payload: { execution_mode: 'desktop_ensemble' },
				report_payload: {
					mode: 'desktop_ensemble',
					heroes: ['likiy_sorrento', 'arlyqueen'],
					template_hint: 'research_plan_v1',
				},
				applied_entities: [],
				operation_trail: [],
				error_payload: {},
				metrics_before: {},
				metrics_after: {},
			},
		];

		const md = buildAmkaRunExportMarkdown(run, steps);

		expect(md).toContain('`desktop_ensemble`');
		expect(md).toContain('research_plan_v1');
		expect(md).toContain('likiy_sorrento');
	});

	it('includes ensemble plan count and failed step error', () => {
		const run: AmkaRun = {
			id: 'run-2',
			project_id: 'project-1',
			company_id: 'company-1',
			created_by_user_id: 'user-1',
			scope_key: 'all_visible',
			status: 'failed',
			progress: 35,
			master_plan: [
				{
					step_key: 'evidence',
					section_key: 'evidence',
					title: 'Evidence',
					depends_on: [],
					autofill_targets: [],
					operations: [],
				},
			],
			final_assessment: {},
			metrics_before: {},
			metrics_after: {},
			error_payload: {},
		};
		const steps: AmkaRunStep[] = [
			{
				id: 'step-f',
				run_id: 'run-2',
				ordinal: 19,
				title: 'Evidence',
				stage_kind: 'execute_section',
				section_key: 'evidence',
				status: 'failed',
				plan_payload: { execution_mode: 'desktop_ensemble' },
				report_payload: {
					error: "coroutine has no attribute 'get_postgres_session'",
				},
				applied_entities: [],
				operation_trail: [],
				error_payload: {
					message: "coroutine has no attribute 'get_postgres_session'",
				},
				metrics_before: {},
				metrics_after: {},
			},
		];

		const md = buildAmkaRunExportMarkdown(run, steps);

		expect(md).toContain('Шагов «Команда» в плане: 1');
		expect(md).toContain('Ошибка ensemble:');
		expect(md).not.toContain('Ошибка шага:');
	});
});
