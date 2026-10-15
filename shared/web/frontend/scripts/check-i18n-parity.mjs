#!/usr/bin/env node
/**
 * Compare JSON key paths between src/i18n/locales/en and ru (same filename pairs).
 * Exit 1 if any key is missing on either side.
 */
import fs from 'node:fs';
import path from 'node:path';

const localesRoot = path.join(process.cwd(), 'src', 'i18n', 'locales');
const enDir = path.join(localesRoot, 'en');
const ruDir = path.join(localesRoot, 'ru');

function flattenKeys(value, prefix = '') {
	const keys = [];
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		if (prefix) keys.push(prefix);
		return keys;
	}
	for (const [k, v] of Object.entries(value)) {
		const p = prefix ? `${prefix}.${k}` : k;
		if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
			keys.push(...flattenKeys(v, p));
		} else {
			keys.push(p);
		}
	}
	return keys;
}

function loadJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

if (!fs.existsSync(enDir) || !fs.existsSync(ruDir)) {
	console.error('[i18n-parity] Missing en/ or ru/ under locales');
	process.exit(1);
}

const enFiles = fs
	.readdirSync(enDir)
	.filter((f) => f.endsWith('.json'))
	.sort();

let failed = false;

for (const name of enFiles) {
	const enPath = path.join(enDir, name);
	const ruPath = path.join(ruDir, name);
	if (!fs.existsSync(ruPath)) {
		console.error(`[i18n-parity] Missing ru counterpart: ${name}`);
		failed = true;
		continue;
	}
	const enKeys = new Set(flattenKeys(loadJson(enPath)));
	const ruKeys = new Set(flattenKeys(loadJson(ruPath)));
	const missingInRu = [...enKeys].filter((k) => !ruKeys.has(k));
	const extraInRu = [...ruKeys].filter((k) => !enKeys.has(k));
	if (missingInRu.length) {
		failed = true;
		console.error(`[i18n-parity] Missing in ru: ${name}`);
		for (const k of missingInRu) console.error(`  ${k}`);
	}
	if (extraInRu.length) {
		console.warn(
			`[i18n-parity] Info: ${name} — ${extraInRu.length} key(s) only in ru (e.g. plural forms); not an error`
		);
	}
}

if (failed) {
	process.exit(1);
}
console.log('[i18n-parity] OK: every en key exists in ru for all JSON pairs');
