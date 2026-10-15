import { describe, expect, it } from 'vitest';

import {
	AMKA_START_SECTION_KEYS,
	buildMarketingCabinetDeepLinkForAmkaChildJob,
	buildMarketingCabinetDeepLinkForAmkaEntity,
} from '../marketingCabinetAmkaDeepLink';

describe('marketingCabinetAmkaDeepLink', () => {
	it('maps imc research run to imc view with focusedEntityId', () => {
		const s = buildMarketingCabinetDeepLinkForAmkaEntity({
			companyId: 'c1',
			projectId: 'p1',
			entityType: 'imc_research_run',
			entityId: 'run-99',
		});
		expect(s).not.toBeNull();
		expect(s?.activeView).toBe('imc');
		expect(s?.focusedEntityId).toBe('run-99');
		expect(s?.selectedCompanyId).toBe('c1');
		expect(s?.selectedProjectId).toBe('p1');
	});

	it('maps content_source to evidence with selectedContentId', () => {
		const s = buildMarketingCabinetDeepLinkForAmkaEntity({
			companyId: 'c1',
			projectId: 'p1',
			entityType: 'content_source',
			entityId: 'doc-1',
		});
		expect(s).not.toBeNull();
		expect(s?.activeView).toBe('evidence');
		expect(s?.selectedContentId).toBe('doc-1');
	});

	it('builds child job deep link for imc_research_run', () => {
		const s = buildMarketingCabinetDeepLinkForAmkaChildJob(
			{ kind: 'imc_research_run', external_id: 'rid-1' },
			'c2',
			'p2'
		);
		expect(s?.focusedEntityId).toBe('rid-1');
		expect(s?.selectedCompanyId).toBe('c2');
	});

	it('exposes ordered section keys aligned with backend', () => {
		expect(AMKA_START_SECTION_KEYS).toContain('project_rag');
		expect(AMKA_START_SECTION_KEYS).toContain('dashboard');
	});
});
