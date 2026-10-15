/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock UGS OpenAPI pilot aliases so queue-ops `operator_slo` stays on the typed path.
 *
 * Invariants:
 * - Service-layer schemas expose `UGSQueueOpsOperatorSlo` and snapshot `operator_slo`.
 *
 * Related:
 * - src/services/api/ugs/schemas.ts
 * - src/services/api/ugs/queueOps.ts
 * - api/tests/test_ugs_openapi_contracts.py
 */

import { describe, expect, it } from 'vitest';

import type {
	UgsQueueOpsOperatorSloSchema,
	UgsQueueOpsSnapshotSchema,
} from '../schemas';
import type { UgsQueueOpsSnapshot } from '../queueOps';

describe('ugs queueOps OpenAPI operator_slo lock', () => {
	it('snapshot schema type includes operator_slo from pilot (compile-time + runtime shape)', () => {
		const slo: UgsQueueOpsOperatorSloSchema = {
			level: 'healthy',
			pending_oldest_age_seconds: 12,
			failed_share: 0,
		};
		const snapshot: UgsQueueOpsSnapshotSchema = {
			status: 'ok',
			timestamp: '2026-07-28T00:00:00Z',
			postgres: {},
			rabbitmq: {},
			redis: {},
			operator_slo: slo,
			hints: [],
		};
		const aliased: UgsQueueOpsSnapshot = snapshot;
		expect(aliased.operator_slo?.level).toBe('healthy');
		expect(aliased.operator_slo).toEqual(slo);
	});
});
