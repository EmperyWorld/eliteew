import { describe, expect, it } from 'vitest';
import {
	SITE_STUDIO_AI_API_BASE,
	SITE_STUDIO_API_BASE,
	SITE_MANAGER_OPS_API_BASE,
	SITE_STUDIO_PROXY_API_BASE,
	type SiteStudioActionResponse,
} from '../api';

/**
 * Contract: paths must stay aligned with FastAPI routers
 * `shared/api/routers/desktop_sites.py` and `site_studio_ai.py`.
 */
describe('site studio API path contract', () => {
	it('exports stable base paths', () => {
		expect(SITE_STUDIO_API_BASE).toBe('/api/v1/desktop/site-studio');
		expect(SITE_STUDIO_AI_API_BASE).toBe('/api/v1/desktop/site-studio/ai');
		expect(SITE_STUDIO_PROXY_API_BASE).toBe(
			'/api/v1/desktop/site-studio/proxy'
		);
		expect(SITE_MANAGER_OPS_API_BASE).toBe('/api/v1/desktop/site-manager/ops');
	});

	it('instance action POST paths match desktop_sites router', () => {
		expect(`${SITE_STUDIO_API_BASE}/instance/provision`).toBe(
			'/api/v1/desktop/site-studio/instance/provision'
		);
		expect(`${SITE_STUDIO_API_BASE}/instance/start`).toBe(
			'/api/v1/desktop/site-studio/instance/start'
		);
		expect(`${SITE_STUDIO_API_BASE}/instance/stop`).toBe(
			'/api/v1/desktop/site-studio/instance/stop'
		);
		expect(`${SITE_STUDIO_API_BASE}/instance/redeploy`).toBe(
			'/api/v1/desktop/site-studio/instance/redeploy'
		);
	});

	it('AI drafts path matches site_studio_ai mount', () => {
		expect(`${SITE_STUDIO_AI_API_BASE}/drafts`).toBe(
			'/api/v1/desktop/site-studio/ai/drafts'
		);
	});

	it('operator ops paths match site_manager_ops router', () => {
		expect(`${SITE_MANAGER_OPS_API_BASE}/overview`).toBe(
			'/api/v1/desktop/site-manager/ops/overview'
		);
		expect(`${SITE_MANAGER_OPS_API_BASE}/smoke/publish`).toBe(
			'/api/v1/desktop/site-manager/ops/smoke/publish'
		);
	});
});

describe('SiteStudioActionResponse', () => {
	it('accepts backend-shaped JSON', () => {
		const parsed: SiteStudioActionResponse = {
			status: 'accepted',
			queued: true,
			detail: 'task queued',
		};
		expect(parsed.queued).toBe(true);
		expect(parsed.detail).toBe('task queued');
	});
});
