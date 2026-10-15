import { describe, expect, it } from 'vitest';

import {
	buildCustomerDiagnosticDocumentText,
	buildCustomerDiagnosticImcAnswersBrief,
	buildCustomerDiagnosticImcBrief,
	IMC_CUSTOMER_DIAGNOSTIC_ANSWERS_TYPE_KEY,
	IMC_CUSTOMER_DIAGNOSTIC_TYPE_KEY,
} from './customerDiagnosticImcContext';
import type { DiagnosticComputedResults } from './diagnosticScoring';
import { defaultCustomerDiagnosticState } from './diagnosticTypes';

describe('customerDiagnosticImcContext', () => {
	it('exports stable type key', () => {
		expect(IMC_CUSTOMER_DIAGNOSTIC_TYPE_KEY).toBe(
			'imc_rag_customer_diagnostic'
		);
		expect(IMC_CUSTOMER_DIAGNOSTIC_ANSWERS_TYPE_KEY).toBe(
			'imc_rag_customer_diagnostic_answers'
		);
	});

	it('buildCustomerDiagnosticImcAnswersBrief focuses on wording', () => {
		const empty: DiagnosticComputedResults = {
			archetype: null,
			values: null,
			business: null,
			service: null,
			emotions: null,
		};
		const b = buildCustomerDiagnosticImcAnswersBrief(empty);
		expect(b).toContain('разобрать ответы');
		expect(b).toContain('Данные клиентской диагностики');
		expect(b).not.toContain('материалов маркетингового проекта');
	});

	it('buildCustomerDiagnosticImcBrief differs by variant', () => {
		const empty: DiagnosticComputedResults = {
			archetype: null,
			values: null,
			business: null,
			service: null,
			emotions: null,
		};
		const s = buildCustomerDiagnosticImcBrief('strategy', empty);
		const o = buildCustomerDiagnosticImcBrief('operations', empty);
		expect(s).toContain('Стратегический');
		expect(o).toContain('Операционные');
		expect(s).toContain('результатам клиентской диагностики');
		expect(o).toContain('результатам клиентской диагностики');
		expect(s).toContain('материалов маркетингового проекта');
		expect(s).not.toBe(o);
	});

	it('buildCustomerDiagnosticDocumentText includes session and state JSON', () => {
		const text = buildCustomerDiagnosticDocumentText({
			session: {
				id: 'sess-1',
				project_id: 'proj-1',
				progress_percent: 80,
				computed_results: { k: 1 },
				completed_at: null,
				updated_at: '2026-01-01T00:00:00Z',
				state: {},
				module_retake_status: {},
			},
			state: defaultCustomerDiagnosticState(),
			computedResults: {
				archetype: null,
				values: null,
				business: null,
				service: null,
				emotions: null,
			},
			completedModules: ['archetype'],
		});
		expect(text).toContain('Данные клиентской диагностики');
		expect(text).toContain('"session_id": "sess-1"');
		expect(text).toContain('completed_modules');
	});
});
