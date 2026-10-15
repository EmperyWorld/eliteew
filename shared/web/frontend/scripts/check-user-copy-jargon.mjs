#!/usr/bin/env node
/**
 * Scan user-facing i18n JSON for operator jargon (plan 20 guard-rail).
 * Exits 1 when forbidden terms appear outside documented support-only subtrees.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesRoot = join(__dirname, '../src/i18n/locales');

const FORBIDDEN =
	/\b(shell_state|persist_patch_queue|412|etag|reconcile|socket\.io|payload)\b/i;

/** JSON dot-path prefixes excluded from scan (operator/support; parallel agents own settings/tray). */
const EXCLUDED_PREFIXES = [
	'adminPresence',
	'adminUsersHub',
	'adminShell',
	'adminDiagnosticReport',
	'adminUserDetail',
	'ugsHub',
	'ewaCompanionAdmin',
	'ewDeskAdmin',
	'settings',
	'settingsPanel',
	'taskbar.trayUgs',
];

function isExcluded(path) {
	return EXCLUDED_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}.`)
	);
}

function flattenStrings(obj, prefix = '') {
	const rows = [];
	if (typeof obj === 'string') {
		if (!isExcluded(prefix)) rows.push({ path: prefix, value: obj });
		return rows;
	}
	if (!obj || typeof obj !== 'object') return rows;
	for (const [key, value] of Object.entries(obj)) {
		const next = prefix ? `${prefix}.${key}` : key;
		rows.push(...flattenStrings(value, next));
	}
	return rows;
}

function loadJson(relPath) {
	return JSON.parse(readFileSync(join(localesRoot, relPath), 'utf8'));
}

const violations = [];

for (const lang of ['en', 'ru']) {
	const desktopUi = loadJson(`${lang}/desktopUi.json`);
	for (const { path, value } of flattenStrings(desktopUi)) {
		if (FORBIDDEN.test(value)) {
			violations.push(`${lang}/desktopUi.json → ${path}`);
		}
	}

	const marketing = loadJson(`${lang}/marketing.json`);
	for (const { path, value } of flattenStrings(
		marketing.ewaCompanion ?? {},
		'ewaCompanion'
	)) {
		if (FORBIDDEN.test(value)) {
			violations.push(`${lang}/marketing.json → ${path}`);
		}
	}
}

if (violations.length > 0) {
	console.error('[copy:check] Forbidden jargon in user-facing i18n:\n');
	for (const line of violations) {
		console.error(`  ${line}`);
	}
	process.exit(1);
}

console.log('[copy:check] OK — no forbidden jargon in guarded user i18n paths.');
