#!/usr/bin/env node
/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compare OpenAPI pilot path counts against the full export prefixes / exact lists.
 * Fails when a regenerable pilot is behind (or ahead of) the export slice.
 *
 * Invariants:
 * - Hand-maintained SSE overlays (ewa-companion-*) are skipped.
 * - Exit 0 when all regenerable pilots match; exit 1 on drift or missing export.
 *
 * Related:
 * - scripts/openapi-extract-pilots.mjs
 * - documentation/api/FRONTEND-BACKEND-HTTP.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(FRONTEND_ROOT, '..', '..', '..');
const DEFAULT_EXPORT = path.join(
	REPO_ROOT,
	'documentation',
	'api',
	'eliteew-openapi-export.json'
);
const PILOT_DIR = path.join(FRONTEND_ROOT, 'openapi', 'pilot');
const MARKETING_CABINET_PATHS_FILE = path.join(
	FRONTEND_ROOT,
	'openapi',
	'pilot-marketing-cabinet-paths.json'
);

/** @typedef {{ out: string, pathPrefixes?: string[], pathExact?: string[], skip?: boolean }} PilotSpec */

function loadMarketingCabinetPilotPaths() {
	const raw = JSON.parse(fs.readFileSync(MARKETING_CABINET_PATHS_FILE, 'utf8'));
	const list = raw.paths;
	if (!Array.isArray(list) || !list.every((x) => typeof x === 'string')) {
		throw new Error(`Invalid ${MARKETING_CABINET_PATHS_FILE}`);
	}
	return list;
}

const PILOTS = /** @type {PilotSpec[]} */ ([
	{ out: 'friends.openapi.json', pathPrefixes: ['/api/v1/friends'] },
	{ out: 'gaf-chat.openapi.json', pathPrefixes: ['/api/v1/gaf-chat'] },
	{
		out: 'marketing-cabinet.openapi.json',
		pathExact: loadMarketingCabinetPilotPaths(),
	},
	{ out: 'content.openapi.json', pathPrefixes: ['/api/v1/content'] },
	{ out: 'desktop.openapi.json', pathPrefixes: ['/api/v1/desktop'] },
	{ out: 'ugs.openapi.json', pathPrefixes: ['/api/v1/ugs'] },
	{
		out: 'product-desktop.openapi.json',
		pathPrefixes: ['/api/v1/product-desktop'],
	},
	{
		out: 'professional-worlds.openapi.json',
		pathPrefixes: ['/api/v1/professional-worlds'],
	},
	{ out: 'voice-gateway.openapi.json', pathPrefixes: ['/api/v1/voice-gateway'] },
	{ out: 'ewa.openapi.json', pathPrefixes: ['/api/v1/ewa'] },
	{
		out: 'doc-editor-v2.openapi.json',
		pathPrefixes: ['/api/v1/doc-editor-v2'],
	},
	{ out: 'kbsew.openapi.json', pathPrefixes: ['/api/v1/kbsew'] },
	{
		out: 'marketing-cabinet-rag.openapi.json',
		pathExact: [
			'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources',
			'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/semantic-search',
			'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/content/{content_id}',
			'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/from-imc-run/{imc_research_run_id}',
		],
	},
	{
		out: 'projects-members.openapi.json',
		pathExact: [
			'/api/v1/projects/{project_id}/members',
			'/api/v1/projects/{project_id}/members/{member_id}',
		],
	},
	{
		out: 'companies-projects.openapi.json',
		pathExact: [
			'/api/v1/companies',
			'/api/v1/companies/{company_id}',
			'/api/v1/companies/slug/{slug}',
			'/api/v1/projects',
			'/api/v1/projects/{project_id}',
			'/api/v1/projects/{project_id}/transfer-lead',
		],
	},
	{
		out: 'live-jobs-summary.openapi.json',
		pathExact: [
			'/api/v1/marketing-cabinet/projects/{project_id}/live-jobs-summary',
			'/api/v1/marketing-cabinet/companies/{company_id}/live-jobs-summary',
		],
	},
	{ out: 'music-forge.openapi.json', pathPrefixes: ['/api/v1/music-forge'] },
	{ out: 'ebrowser.openapi.json', pathPrefixes: ['/api/v1/ebrowser'] },
	{
		out: 'marketing-cabinet-full.openapi.json',
		pathPrefixes: ['/api/v1/marketing-cabinet'],
		skip: process.env.OPENAPI_MARKETING_FULL !== '1',
	},
]);

function expectedPathCount(exportPaths, pilot) {
	if (pilot.pathExact?.length) {
		return pilot.pathExact.filter((p) => Boolean(exportPaths[p])).length;
	}
	const prefixes = pilot.pathPrefixes || [];
	return Object.keys(exportPaths).filter((p) =>
		prefixes.some((pre) => p === pre || p.startsWith(`${pre}/`))
	).length;
}

function main() {
	const src = process.env.OPENAPI_EXPORT || DEFAULT_EXPORT;
	if (!fs.existsSync(src)) {
		console.error(`Missing OpenAPI export: ${src}`);
		process.exit(1);
	}
	const spec = JSON.parse(fs.readFileSync(src, 'utf8'));
	const exportPaths = spec.paths || {};
	let drift = 0;

	for (const pilot of PILOTS) {
		if (pilot.skip) continue;
		const pilotPath = path.join(PILOT_DIR, pilot.out);
		if (!fs.existsSync(pilotPath)) {
			console.error(`MISSING pilot ${pilot.out}`);
			drift += 1;
			continue;
		}
		const pilotSpec = JSON.parse(fs.readFileSync(pilotPath, 'utf8'));
		const actual = Object.keys(pilotSpec.paths || {}).length;
		const expected = expectedPathCount(exportPaths, pilot);
		const status = actual === expected ? 'ok' : 'DRIFT';
		if (status !== 'ok') drift += 1;
		console.log(
			`${status.padEnd(5)} ${pilot.out}: pilot=${actual} export=${expected}`
		);
	}

	if (drift > 0) {
		console.error(
			`\nopenapi:check-pilot-freshness: ${drift} pilot(s) out of sync with export. Run openapi:extract-pilots.`
		);
		process.exit(1);
	}
	console.log('\nopenapi:check-pilot-freshness: all regenerable pilots match export.');
}

main();
