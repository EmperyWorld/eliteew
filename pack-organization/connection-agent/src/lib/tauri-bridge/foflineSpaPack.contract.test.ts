/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock FoFline SPA pack + A2 asset-group bridge invoke names in commands.ts.
 *
 * Invariants:
 * - fofline_spa_pack_* and fofline_spa_assets_* commands exist beside shell updater.
 *
 * Related:
 * - lib/tauri-bridge/commands.ts
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §11.3 / §17.4
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const commandsTs = readFileSync(
	join(root, 'lib/tauri-bridge/commands.ts'),
	'utf8'
);

describe('foflineSpaPack bridge contract', () => {
	it('exposes status + sync wrappers with snake_case invoke names', () => {
		expect(commandsTs).toContain('foflineSpaPackStatus');
		expect(commandsTs).toContain('foflineSpaPackCheckUpdate');
		expect(commandsTs).toContain('foflineSpaPackSync');
		expect(commandsTs).toContain("'fofline_spa_pack_status'");
		expect(commandsTs).toContain("'fofline_spa_pack_check_update'");
		expect(commandsTs).toContain("'fofline_spa_pack_sync'");
		expect(commandsTs).toContain('foflineSpaAssetsSync');
		expect(commandsTs).toContain('foflineSpaAssetsCancel');
		expect(commandsTs).toContain("'fofline_spa_assets_sync'");
		expect(commandsTs).toContain("'fofline_spa_assets_cancel'");
		expect(commandsTs).toContain('groups_ready');
		expect(commandsTs).toContain('groups_syncing');
		expect(commandsTs).toContain('allowFofline');
		expect(commandsTs).toContain('remote_app_build_id');
		expect(commandsTs).toContain('update_available');
		expect(commandsTs).toContain('foflineLocalStartUrl');
		expect(commandsTs).toContain("'fofline_local_start_url'");
	});
});
