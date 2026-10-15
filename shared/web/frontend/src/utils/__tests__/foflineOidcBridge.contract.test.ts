/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock FoFline HTTPS OIDC bridge page contract: fixed handoff target, OIDC
 * fragment/query allowlist, no external assets, recovery copy, CSP hash vs nginx.
 *
 * Invariants:
 * - Bridge must stay dependency-free and fail closed on missing file (nginx =404).
 * - Prefer `location.hash` (response_mode=fragment); query is legacy fallback only.
 *
 * Related:
 * - `public/fofline-oidc-bridge.html`
 * - `nginx.prod.conf` location = /fofline-oidc-bridge.html
 * - `documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md` §5
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FOFLINE_OIDC_BRIDGE_PATH } from '../redirectUriNormalize';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const bridgeHtmlPath = join(frontendRoot, 'public', 'fofline-oidc-bridge.html');
const nginxPath = join(frontendRoot, 'nginx.prod.conf');

const OIDC_ALLOWED = [
	'code',
	'state',
	'session_state',
	'iss',
	'error',
	'error_description',
	'error_uri',
] as const;

describe('fofline OIDC bridge contract', () => {
	it('keeps path constant and documents exact nginx location', () => {
		expect(FOFLINE_OIDC_BRIDGE_PATH).toBe('/fofline-oidc-bridge.html');
		const nginx = readFileSync(nginxPath, 'utf8');
		expect(nginx).toContain('location = /fofline-oidc-bridge.html');
		expect(nginx).toContain('access_log off');
		expect(nginx).toContain('try_files $uri =404');
		expect(nginx).toContain('Cache-Control "no-store"');
		expect(nginx).toContain('Referrer-Policy "no-referrer"');
		expect(nginx).toContain("frame-ancestors 'none'");
	});

	it('locks handoff target, allowlist, recovery copy, and CSP hash agreement', () => {
		const html = readFileSync(bridgeHtmlPath, 'utf8');
		expect(html).toContain('fofline-spa://localhost/index.html');
		expect(html).toContain('eliteewFoflineClient');
		expect(html).toContain('Повторить переход');
		expect(html).toContain('response_mode=fragment');
		expect(html).toContain('readSourceParams');
		expect(html).toContain('window.location.hash');
		expect(html).not.toMatch(/<script\s+src=/i);
		expect(html).not.toMatch(/<link\s[^>]*href=/i);
		expect(html).not.toMatch(/\bsrc=["']https?:/i);
		for (const key of OIDC_ALLOWED) {
			expect(html).toContain(`${key}: 1`);
		}

		const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
		expect(scriptMatch?.[1]).toBeTruthy();
		const script = scriptMatch?.[1] ?? '';
		const digest = createHash('sha256').update(script, 'utf8').digest('base64');
		expect(html).toContain(`sha256-${digest}`);
		expect(html).toContain(`FOFLINE_OIDC_BRIDGE_CSP_SHA256=${digest}`);

		const nginx = readFileSync(nginxPath, 'utf8');
		expect(nginx).toContain(`script-src 'sha256-${digest}'`);
	});
});
