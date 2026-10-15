/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock: SPA nginx must not reintroduce catch-all `/ws/` after legacy FastAPI echo retire.
 *
 * Invariants:
 * - `location /ws/` block absent; `/ws/health` and `/socket.io/` remain.
 *
 * Related:
 * - documentation/platform/REALTIME-SOCKETIO-AND-WS.md
 * - nginx.prod.conf
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const nginxProdConf = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../../nginx.prod.conf'
);

describe('nginx.prod.conf realtime paths', () => {
	const conf = readFileSync(nginxProdConf, 'utf8');

	it('does not mount catch-all location /ws/', () => {
		expect(conf).not.toMatch(/location\s+\/ws\/\s*\{/);
		expect(conf).not.toMatch(/location\s+\^~\s+\/ws\/\s*\{/);
	});

	it('keeps Socket.IO and /ws/health probe', () => {
		expect(conf).toMatch(/location\s+\/socket\.io\/\s*\{/);
		expect(conf).toMatch(/location\s+=\s+\/ws\/health\s*\{/);
		expect(conf).toContain(
			'proxy_pass http://$backend_api_host:8000/ws/health'
		);
	});
});
