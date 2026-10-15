/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock regenerable OpenAPI pilots to the full export path counts (freshness smoke).
 *
 * Invariants:
 * - Requires documentation/api/eliteew-openapi-export.json (gitignored; from openapi:export*).
 * - Skips cleanly when export is absent (local CI without API container).
 *
 * Related:
 * - scripts/openapi-check-pilot-freshness.mjs
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, '../../..');
const REPO_ROOT = join(FRONTEND_ROOT, '../../..');
const EXPORT_PATH = join(
	REPO_ROOT,
	'documentation/api/eliteew-openapi-export.json'
);

describe('openapi pilot freshness', () => {
	it('regenerable pilots match export prefixes when export is present', () => {
		if (!existsSync(EXPORT_PATH)) {
			return;
		}
		const result = spawnSync(
			process.execPath,
			[join(FRONTEND_ROOT, 'scripts/openapi-check-pilot-freshness.mjs')],
			{
				cwd: FRONTEND_ROOT,
				encoding: 'utf8',
				env: { ...process.env, OPENAPI_MARKETING_FULL: '1' },
			}
		);
		expect(result.status, result.stderr || result.stdout).toBe(0);
	});
});
