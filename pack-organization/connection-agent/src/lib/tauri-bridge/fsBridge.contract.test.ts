/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Stage 2 FS bridge invoke names + allowlist/default-deny contract in FE wrappers.
 *
 * Related:
 * - src/lib/tauri-bridge/commands.ts
 * - src-tauri/src/fs_bridge.rs
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.2
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const commandsSource = readFileSync(join(here, 'commands.ts'), 'utf8');
const rustCore = readFileSync(
	join(here, '../../../src-tauri/src/fs_bridge.rs'),
	'utf8'
);
const rustCmd = readFileSync(
	join(here, '../../../src-tauri/src/commands/fs_bridge.rs'),
	'utf8'
);

describe('fs bridge tauri contract', () => {
	it('exports roots/list/read/write_atomic wrappers', () => {
		expect(commandsSource).toMatch(/fs_bridge_roots/);
		expect(commandsSource).toMatch(/fs_bridge_list_dir/);
		expect(commandsSource).toMatch(/fs_bridge_read_file/);
		expect(commandsSource).toMatch(/fs_bridge_write_atomic/);
		expect(commandsSource).toMatch(/export async function fsBridgeRoots/);
		expect(commandsSource).toMatch(/export async function fsBridgeListDir/);
		expect(commandsSource).toMatch(/export async function fsBridgeReadFile/);
		expect(commandsSource).toMatch(/export async function fsBridgeWriteAtomic/);
	});

	it('documents allowlist Import/staging and not Content Manager', () => {
		expect(commandsSource).toMatch(/EliteEW\/Import/);
		expect(commandsSource).toMatch(/not a Content Manager replacement/i);
		expect(rustCore).toMatch(/EliteEW\/Import/);
		expect(rustCore).toMatch(/fs_bridge\/staging/);
		expect(rustCore).toMatch(/tauri_fs_deny/);
		expect(rustCore).toMatch(/write_atomic/);
		expect(rustCmd).toMatch(/#\[tauri::command\][\s\S]*fs_bridge_write_atomic/);
		expect(rustCmd).toMatch(/require_main_window/);
	});

	it('product capability never grants fs_bridge', () => {
		const product = JSON.parse(
			readFileSync(join(here, '../../../src-tauri/capabilities/product.json'), 'utf8')
		) as { permissions: string[] };
		expect(product.permissions.join('\n')).not.toMatch(/fs-bridge|fs_bridge/);
	});

	it('main capability keeps fs_bridge for launcher Import/staging', () => {
		const main = JSON.parse(
			readFileSync(join(here, '../../../src-tauri/capabilities/default.json'), 'utf8')
		) as { permissions: string[] };
		expect(main.permissions).toEqual(
			expect.arrayContaining([
				'allow-fs-bridge-roots',
				'allow-fs-bridge-list-dir',
				'allow-fs-bridge-read-file',
				'allow-fs-bridge-write-atomic',
			])
		);
	});
});
