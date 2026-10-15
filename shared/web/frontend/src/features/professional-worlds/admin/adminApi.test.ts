/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Professional Worlds admin API path constants and DTO assumptions.
 *
 * Invariants:
 * - Tests stay pure and do not call admin endpoints.
 * - Admin API base must remain under `/api/v1/professional-worlds/admin`.
 *
 * Related:
 * - api.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	approveProfessionalWorldsPackRelease,
	confirmProfessionalWorldsPackImportJob,
	createProfessionalWorldsRollout,
	createProfessionalWorldsPackImportJob,
	createProfessionalWorldsPackRelease,
	createProfessionalWorldsPackVersion,
	diffProfessionalWorldsPackVsLive,
	exportProfessionalWorldsPack,
	getProfessionalWorldsPackImportJob,
	listProfessionalWorldsRollouts,
	patchProfessionalWorldsRollout,
	pauseProfessionalWorldsRollout,
	listProfessionalWorldsPackVersions,
	PROFESSIONAL_WORLDS_ADMIN_API_BASE,
	publishProfessionalWorldsPackRelease,
	resumeProfessionalWorldsRollout,
	rollbackProfessionalWorldsPackRelease,
	testProfessionalWorldsPhotoPreset,
} from './api';
import type { ProfessionalWorldsAdminSnapshot } from './types';

const apiMock = vi.hoisted(() => ({
	get: vi.fn(),
	patch: vi.fn(),
	post: vi.fn(),
}));

vi.mock('@/services/api/client', () => ({
	api: apiMock,
}));

describe('professional worlds admin api helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		apiMock.get.mockResolvedValue({});
		apiMock.post.mockResolvedValue({});
		apiMock.patch.mockResolvedValue({});
	});

	it('keeps admin API base path aligned with backend router prefix', () => {
		expect(PROFESSIONAL_WORLDS_ADMIN_API_BASE).toBe(
			'/api/v1/professional-worlds/admin'
		);
	});

	it('models admin snapshot sections used by the admin shell', () => {
		const snapshot: ProfessionalWorldsAdminSnapshot = {
			overview: {
				verticals_count: 1,
				modules_count: 2,
				ai_actions_count: 3,
				photo_presets_count: 4,
				enabled_integrations_count: 5,
				pack_versions_count: 0,
				pack_releases_count: 0,
				published_releases_count: 0,
				active_rollouts_count: 0,
				broken_bindings: [],
			},
			verticals: [],
			modules: [],
			assignments: [],
			schemas: [],
			aiActions: [],
			photoPresets: [],
			integrations: [],
			audit: [],
		};

		expect(snapshot.overview.ai_actions_count).toBe(3);
		expect('broken_bindings' in snapshot).toBe(false);
	});

	it('calls the pack version and export paths used by the pack admin tab', async () => {
		await listProfessionalWorldsPackVersions('realtor');
		expect(apiMock.get).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/packs/realtor/versions'
		);

		await exportProfessionalWorldsPack('realtor');
		expect(apiMock.get).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/verticals/realtor/export'
		);

		const versionPayload = {
			version_label: '2026.05',
			manifest: { version: 2 },
			changelog_md: 'Admin pack update',
		};
		await createProfessionalWorldsPackVersion('realtor', versionPayload);
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/packs/realtor/versions',
			versionPayload
		);
	});

	it('calls the pack diff and import job paths with encoded vertical slugs', async () => {
		const manifest = { vertical_slug: 'real estate' };

		await diffProfessionalWorldsPackVsLive('real estate', manifest);
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/packs/real estate/diff',
			manifest
		);

		await createProfessionalWorldsPackImportJob('real estate', manifest);
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/packs/import/jobs?vertical_slug=real%20estate',
			manifest
		);

		await getProfessionalWorldsPackImportJob('job-1');
		expect(apiMock.get).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/packs/import/jobs/job-1'
		);

		await confirmProfessionalWorldsPackImportJob('job-1');
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/packs/import/jobs/job-1/confirm',
			{}
		);
	});

	it('calls pack release workflow paths', async () => {
		const releasePayload = { pack_version_id: 'version-1', notes: 'ship' };
		await createProfessionalWorldsPackRelease('realtor', releasePayload);
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/packs/realtor/releases',
			releasePayload
		);

		await approveProfessionalWorldsPackRelease('release-1', {
			comment: 'reviewed',
		});
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/packs/releases/release-1/approve',
			{ comment: 'reviewed' }
		);

		await publishProfessionalWorldsPackRelease('release-1');
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/packs/releases/release-1/publish',
			{}
		);

		await rollbackProfessionalWorldsPackRelease('release-1');
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/packs/releases/release-1/rollback',
			{}
		);
	});

	it('passes sample Unified Content ids to photo preset test path', async () => {
		await testProfessionalWorldsPhotoPreset(
			'premium_gallery',
			'realtor',
			'00000000-0000-4000-8000-000000000001'
		);

		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/photo-presets/premium_gallery/test?vertical_slug=realtor&sample_content_id=00000000-0000-4000-8000-000000000001',
			{}
		);
	});

	it('maps rollout list, create, patch, pause and resume payloads', async () => {
		await listProfessionalWorldsRollouts('realtor');
		expect(apiMock.get).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/rollouts?vertical_slug=realtor'
		);

		const createPayload = {
			release_id: 'release-1',
			mode: 'percentage',
			percentage: 25,
		};
		await createProfessionalWorldsRollout('realtor', createPayload);
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/rollouts?vertical_slug=realtor',
			createPayload
		);

		const patchPayload = { mode: 'all', percentage: 100 };
		await patchProfessionalWorldsRollout('rollout-1', patchPayload);
		expect(apiMock.patch).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/rollouts/rollout-1',
			patchPayload
		);

		await pauseProfessionalWorldsRollout('rollout-1');
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/rollouts/rollout-1/pause',
			{}
		);

		await resumeProfessionalWorldsRollout('rollout-1');
		expect(apiMock.post).toHaveBeenCalledWith(
			'/api/v1/professional-worlds/admin/rollouts/rollout-1/resume',
			{}
		);
	});
});
