/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve optional Playwright storage state for UGS admin E2E contour.
 *
 * Related:
 * - e2e/ugs-hub-admin-queue-ops.spec.ts
 * - documentation/product/desktop/DESKTOP-SHELL-E2E-CI.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nodeEnv } from './desktopShellE2eGate';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveUgsAdminStorageStatePath(): string | undefined {
	const fromEnv = nodeEnv('PLAYWRIGHT_UGS_ADMIN_STORAGE_STATE');
	if (fromEnv) {
		const resolved = path.isAbsolute(fromEnv)
			? fromEnv
			: path.join(e2eDir, fromEnv);
		if (fs.existsSync(resolved)) {
			return resolved;
		}
		console.warn(
			`[playwright] PLAYWRIGHT_UGS_ADMIN_STORAGE_STATE points to missing file: ${resolved}`
		);
		return undefined;
	}

	const defaultPath = path.join(
		e2eDir,
		'.auth',
		'ugs-admin-storage-state.json'
	);
	if (fs.existsSync(defaultPath)) {
		return defaultPath;
	}

	return undefined;
}

export const ugsAdminE2eStorageAvailable = Boolean(
	resolveUgsAdminStorageStatePath()
);
