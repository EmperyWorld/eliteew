/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock platformOpsApi against double-unwrap of api.get (body already unwrapped).
 *
 * Related:
 * - `pages/Admin/platformOps/platformOpsApi.ts`
 * - `services/api/client.ts` (`api.get` returns response.data)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../../../services/api/client', () => ({
	api: {
		get: (...args: unknown[]) => getMock(...args),
		post: (...args: unknown[]) => postMock(...args),
		patch: (...args: unknown[]) => patchMock(...args),
		delete: (...args: unknown[]) => deleteMock(...args),
	},
}));

describe('platformOpsApi', () => {
	beforeEach(() => {
		getMock.mockReset();
		postMock.mockReset();
		patchMock.mockReset();
		deleteMock.mockReset();
	});

	it('returns stack0 body from api.get without nested .data unwrap', async () => {
		const body = {
			schema_version: 1,
			overall: 'ok',
			runtime_line: 'dev-bind',
			checks: [{ id: 'api_process', status: 'ok', detail: 'in-process' }],
		};
		getMock.mockResolvedValueOnce(body);

		const { getPlatformOpsStack0Status } = await import(
			'../platformOps/platformOpsApi'
		);
		const snap = await getPlatformOpsStack0Status();

		expect(getMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/stack0-status'
		);
		expect(snap).toBe(body);
		expect(snap.overall).toBe('ok');
		expect(snap.checks).toHaveLength(1);
	});

	it('returns egress body from api.get without nested .data unwrap', async () => {
		const body = {
			schema_version: 1,
			overall: 'ok',
			containers: [{ name: 'stack0-eliteew-api-prod-baked', mode: 'lock' }],
			mode_counts: { lock: 1 },
			error: null,
		};
		getMock.mockResolvedValueOnce(body);

		const { getPlatformOpsEgressStatus } = await import(
			'../platformOps/platformOpsApi'
		);
		const snap = await getPlatformOpsEgressStatus();

		expect(getMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/egress-status'
		);
		expect(snap).toBe(body);
		expect(snap.containers).toHaveLength(1);
	});

	it('lists licenses with filters (Wave A inventory)', async () => {
		getMock.mockResolvedValueOnce({
			licenses: [],
			total: 0,
			limit: 50,
			offset: 0,
		});
		const { listPlatformOpsLicenses } = await import(
			'../platformOps/platformOpsApi'
		);
		await listPlatformOpsLicenses({
			status: 'active',
			mode: 'offline',
			q: 'pilot',
		});
		const url = String(getMock.mock.calls[0]?.[0] ?? '');
		expect(url).toContain('/platform-ops/licenses?');
		expect(url).toContain('status=active');
		expect(url).toContain('mode=offline');
		expect(url).toContain('q=pilot');
	});

	it('posts hard license revoke (Wave A)', async () => {
		postMock.mockResolvedValueOnce({ ok: true, status: 'revoked' });
		const { revokePlatformOpsLicense } = await import(
			'../platformOps/platformOpsApi'
		);
		await revokePlatformOpsLicense('abc-uuid', 'lost');
		expect(postMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/licenses/abc-uuid/revoke',
			{ reason: 'lost' }
		);
	});

	it('gets denylist status (Wave B)', async () => {
		const body = {
			published_at: null,
			pending_count: 1,
			updates_out_configured: true,
			signing_key_configured: true,
			entries: [],
			revoked_count: 0,
			note: null,
			payload_hash: null,
			out_path: null,
		};
		getMock.mockResolvedValueOnce(body);
		const { getPlatformOpsDenylistStatus } = await import(
			'../platformOps/platformOpsApi'
		);
		const snap = await getPlatformOpsDenylistStatus();
		expect(getMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/denylist'
		);
		expect(snap.pending_count).toBe(1);
	});

	it('adds and removes denylist entries (Wave B)', async () => {
		postMock.mockResolvedValueOnce({
			license_id: 'abc-uuid',
			reason: 'lost',
		});
		deleteMock.mockResolvedValueOnce({ ok: true, status: 'removed' });
		const { addPlatformOpsDenylistEntry, removePlatformOpsDenylistEntry } =
			await import('../platformOps/platformOpsApi');
		await addPlatformOpsDenylistEntry({
			license_id: 'abc-uuid',
			reason: 'lost',
		});
		expect(postMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/denylist/entries',
			{ license_id: 'abc-uuid', reason: 'lost' }
		);
		await removePlatformOpsDenylistEntry('abc-uuid');
		expect(deleteMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/denylist/entries/abc-uuid'
		);
	});

	it('publishes denylist (Wave B)', async () => {
		postMock.mockResolvedValueOnce({
			published_at: '2026-08-08T00:00:00Z',
			revoked_count: 1,
			payload_hash: 'h',
			out_path: '/tmp/denylist.json',
			note: 'n',
		});
		const { publishPlatformOpsDenylist } = await import(
			'../platformOps/platformOpsApi'
		);
		await publishPlatformOpsDenylist('n');
		expect(postMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/denylist/publish',
			{ note: 'n' }
		);
	});

	it('issues seat with allow_fofline (default deny when omitted)', async () => {
		postMock.mockResolvedValueOnce({
			filename: 'eliteew-seat.json',
			package: { license_id: 'abc', allow_fofline: true },
		});
		const { issuePlatformOpsSeat } = await import(
			'../platformOps/platformOpsApi'
		);
		const deviceRequest = {
			kind: 'device_request_v1',
			request_id: 'dr1_test',
			product_id: 'eliteew-desktop-connected',
			app_identifier: 'world.empery.desktop.client',
			device_signing_pubkey: 'aa'.repeat(32),
			capsule_recipient_pubkey: 'bb'.repeat(32),
			recipient_key_id: 'rk1_x',
			machine_fingerprint_hash: 'mfh1_y',
			created_at: '2026-08-11T00:00:00Z',
			nonce: 'cc'.repeat(16),
			signature: 'dd'.repeat(64),
		};
		await issuePlatformOpsSeat({
			mode: 'both',
			label: 'pilot',
			allow_fofline: true,
			device_request: deviceRequest,
		});
		expect(postMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/seats/issue',
			{
				mode: 'both',
				label: 'pilot',
				slug: null,
				allowed_email: null,
				allow_fofline: true,
				device_request: deviceRequest,
			}
		);
		postMock.mockResolvedValueOnce({
			filename: 'eliteew-seat.json',
			package: { license_id: 'abc', allow_fofline: false },
		});
		await issuePlatformOpsSeat({
			mode: 'offline',
			device_request: deviceRequest,
		});
		expect(postMock).toHaveBeenLastCalledWith(
			'/api/v1/desktop/admin/platform-ops/seats/issue',
			{
				mode: 'offline',
				label: null,
				slug: null,
				allowed_email: null,
				allow_fofline: false,
				device_request: deviceRequest,
			}
		);
	});

	it('patches license allow_fofline', async () => {
		patchMock.mockResolvedValueOnce({
			license_id: 'abc-uuid',
			allow_fofline: true,
			allow_offline: true,
			allow_online: false,
			mode: 'offline',
		});
		const { patchPlatformOpsLicense } = await import(
			'../platformOps/platformOpsApi'
		);
		await patchPlatformOpsLicense('abc-uuid', { allow_fofline: true });
		expect(patchMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/licenses/abc-uuid',
			{ allow_fofline: true }
		);
	});

	it('creates and reveals Air enroll sessions under platform-ops', async () => {
		postMock.mockResolvedValueOnce({
			id: 'air-1',
			lifecycle: 'ready',
			cleanup_state: 'not_started',
			port: 62345,
			events: [],
		});
		postMock.mockResolvedValueOnce({
			session: {
				id: 'air-1',
				lifecycle: 'revealed',
				cleanup_state: 'not_started',
				port: 62345,
				events: [],
			},
			access_code: 'EWAE1-62345-TESTSELECTORXXXX-TESTSECRETXXXXXXXXXXXXX-ABCD',
		});
		const {
			createPlatformOpsAirEnrollSession,
			revealPlatformOpsAirEnrollCode,
		} = await import('../platformOps/platformOpsApi');
		await createPlatformOpsAirEnrollSession({
			idempotency_key: 'idem-air-test-01',
			mode: 'offline',
			allow_fofline: false,
		});
		expect(postMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/air-enroll/sessions',
			{
				idempotency_key: 'idem-air-test-01',
				mode: 'offline',
				label: null,
				slug: null,
				allowed_email: null,
				expires_at: null,
				allow_fofline: false,
			}
		);
		await revealPlatformOpsAirEnrollCode('air-1');
		expect(postMock).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/platform-ops/air-enroll/sessions/air-1/reveal',
			{}
		);
	});
});
