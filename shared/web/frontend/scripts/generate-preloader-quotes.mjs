#!/usr/bin/env node
/**
 * Sync and validate EliteEW quote catalog for static HTML preloader.
 * Source: src/components/ui/eliteQuotes/catalog/*.json
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(here, '..');
const catalogDir = join(
	frontendRoot,
	'src/components/ui/eliteQuotes/catalog'
);
const publicJsonPath = join(frontendRoot, 'public/elite-quotes.json');
const publicInlinePath = join(frontendRoot, 'public/elite-quotes-inline.js');
const MAX_TEXT_LEN = 120;

const checkOnly = process.argv.includes('--check');

function loadCatalog() {
	const files = readdirSync(catalogDir)
		.filter((name) => name.endsWith('.json'))
		.sort();
	const merged = [];
	const seen = new Set();
	const stats = {};

	for (const file of files) {
		const category = file.replace(/\.json$/, '');
		const entries = JSON.parse(
			readFileSync(join(catalogDir, file), 'utf8')
		);
		stats[category] = entries.length;

		for (const entry of entries) {
			for (const field of ['id', 'author', 'text', 'category']) {
				if (!entry[field] || typeof entry[field] !== 'string') {
					throw new Error(`${file}: missing ${field} on ${entry.id ?? '?'}`);
				}
			}
			if (entry.category !== category) {
				throw new Error(
					`${file}: ${entry.id} category ${entry.category} != ${category}`
				);
			}
			if (seen.has(entry.id)) {
				throw new Error(`Duplicate quote id: ${entry.id}`);
			}
			if (entry.text.length > MAX_TEXT_LEN) {
				throw new Error(
					`${entry.id}: text too long (${entry.text.length} > ${MAX_TEXT_LEN})`
				);
			}
			seen.add(entry.id);
			merged.push(entry);
		}
	}

	if (merged.length < 60) {
		throw new Error(`Catalog too small: ${merged.length} quotes (need >= 60)`);
	}

	merged.sort((a, b) => a.id.localeCompare(b.id, 'ru'));
	return { merged, stats };
}

const { merged, stats } = loadCatalog();

if (checkOnly) {
	console.log(
		`[preloader:quotes:check] ok — ${merged.length} quotes`,
		stats
	);
	process.exit(0);
}

writeFileSync(publicJsonPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
writeFileSync(
	publicInlinePath,
	`window.__ELITEEW_QUOTES__ = ${JSON.stringify(merged, null, 2)};\n`,
	'utf8'
);

console.log(
	`[preloader:quotes] synced ${merged.length} quotes`,
	stats,
	'→ public/elite-quotes.json + elite-quotes-inline.js'
);
