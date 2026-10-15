/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * R6 lock — REST-strict gate + split SSE allowlist files stay wired and green.
 *
 * Invariants:
 * - Default `lint-api-integrity.sh` exits 0 with mode=rest-strict+sse-allowlist.
 * - Both allowlists may be empty (post-R6 follow-up cleared Wave7 A + SSE C).
 * - STRICT=1 exits 0 when residual A/C/D hits are zero.
 *
 * Related:
 * - documentation/api/API-INTEGRITY-BACKLOG.md §R6
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const SCRIPTS = join(__dirname, '../../../scripts');
const GATE = join(SCRIPTS, 'lint-api-integrity.sh');
const REST_ALLOW = join(SCRIPTS, 'api-integrity-allowlist.txt');
const SSE_ALLOW = join(SCRIPTS, 'api-integrity-allowlist-sse.txt');

function nonCommentLines(path: string): string[] {
	return readFileSync(path, 'utf8')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('#'));
}

describe('R6 API integrity gate (REST-strict + SSE split)', () => {
	it('REST exceptions allowlist is empty after Wave7 clear', () => {
		expect(nonCommentLines(REST_ALLOW)).toEqual([]);
	});

	it('SSE allowlist is empty after Pattern C clear', () => {
		expect(nonCommentLines(SSE_ALLOW)).toEqual([]);
	});

	it('default gate passes REST-strict with empty allowlists', () => {
		const result = spawnSync('bash', [GATE], {
			encoding: 'utf8',
			env: { ...process.env, API_INTEGRITY_STRICT: '0' },
		});
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('mode=rest-strict+sse-allowlist');
		expect(result.stdout).toContain('hits_total=0');
		expect(result.stdout).toContain('new=0');
	});

	it('STRICT mode passes when residual A/C/D is zero', () => {
		const result = spawnSync('bash', [GATE], {
			encoding: 'utf8',
			env: { ...process.env, API_INTEGRITY_STRICT: '1' },
		});
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('hits_total=0');
	});
});
