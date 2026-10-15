#!/usr/bin/env node
/**
 * Slice a full OpenAPI export into pilot JSON files under openapi/pilot/.
 *
 * Input (default): ../../documentation/api/eliteew-openapi-export.json
 *   Generate first: pnpm run openapi:export  (requires Docker API container)
 *
 * Usage:
 *   node scripts/openapi-extract-pilots.mjs
 *   OPENAPI_EXPORT=/path/to/openapi.json node scripts/openapi-extract-pilots.mjs
 *   OPENAPI_MARKETING_FULL=1 node scripts/openapi-extract-pilots.mjs   # full marketing slice (large)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.join(__dirname, '..');
/** shared/web/frontend -> repo root (three levels up). */
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

/** @typedef {{ out: string, pathPrefixes?: string[], pathExact?: string[] }} PilotSpec */

function loadMarketingCabinetPilotPaths() {
	const raw = JSON.parse(fs.readFileSync(MARKETING_CABINET_PATHS_FILE, 'utf8'));
	const list = raw.paths;
	if (!Array.isArray(list) || !list.every((x) => typeof x === 'string')) {
		throw new Error(
			`Invalid ${MARKETING_CABINET_PATHS_FILE}: expected { paths: string[] }`
		);
	}
	return list;
}

/**
 * Default pilots: prefix slices + narrow marketing/exact lists.
 *
 * Hand-maintained overlays (NOT fully regenerated here — narrative + Zod consumers stay hand):
 * - ewa-companion-chat.openapi.json — after FastAPI SSE models (Wave B5), sync shared
 *   component schemas (SurfaceBlock + CompanionChatStream*) from regenerable ewa /
 *   router OpenAPI; keep stream path `oneOf` / description in the hand file.
 * - ewa-companion-admin.openapi.json (narrow admin task-runs docs)
 * - ewa-desktop-orchestration.openapi.json (narrow orch docs when richer than export)
 *
 * Full `/api/v1/ewa` inventory lives in ewa.openapi.json (prefix extract). Regenerable
 * export now documents `text/event-stream` $ref for B5a stream routes (not opaque {}).
 */
const PILOTS_LITE = /** @type {PilotSpec[]} */ ([
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
]);

const PILOTS_FULL_MARKETING = /** @type {PilotSpec[]} */ ([
	{ out: 'marketing-cabinet-full.openapi.json', pathPrefixes: ['/api/v1/marketing-cabinet'] },
]);

function collectRefsFromValue(value, refs) {
	if (value === null || value === undefined) {
		return;
	}
	if (typeof value === 'string') {
		if (value.startsWith('#/components/schemas/')) {
			refs.add(value.slice('#/components/schemas/'.length));
		}
		return;
	}
	if (Array.isArray(value)) {
		for (const x of value) collectRefsFromValue(x, refs);
		return;
	}
	if (typeof value === 'object') {
		for (const k of Object.keys(value)) {
			collectRefsFromValue(value[k], refs);
		}
	}
}

function closureSchemas(allSchemas, rootNames) {
	const needed = new Set(rootNames);
	let prev = -1;
	while (needed.size !== prev) {
		prev = needed.size;
		for (const name of [...needed]) {
			const schema = allSchemas[name];
			if (!schema || typeof schema !== 'object') continue;
			const refs = new Set();
			collectRefsFromValue(schema, refs);
			for (const r of refs) {
				if (allSchemas[r]) needed.add(r);
			}
		}
	}
	const out = {};
	for (const n of needed) {
		if (allSchemas[n]) out[n] = allSchemas[n];
	}
	return out;
}

/**
 * @param {Record<string, unknown>} paths
 * @param {string[]|undefined} prefixes
 * @param {string[]|undefined} exactList
 */
function filterPaths(paths, prefixes, exactList) {
	const out = {};
	if (!paths || typeof paths !== 'object') return out;
	if (exactList?.length) {
		for (const p of exactList) {
			if (paths[p]) out[p] = paths[p];
		}
		return out;
	}
	if (prefixes?.length) {
		for (const [p, item] of Object.entries(paths)) {
			if (prefixes.some((pre) => p === pre || p.startsWith(`${pre}/`))) {
				out[p] = item;
			}
		}
	}
	return out;
}

/**
 * @param {Record<string, unknown>} spec
 * @param {PilotSpec} pilot
 */
/**
 * FastAPI does not always list 304 on these GETs in the export; patch pilot specs
 * so generated docs / contract tests match runtime (ETag + If-None-Match).
 * @param {Record<string, unknown>} slice
 * @param {string} pilotFilename e.g. desktop.openapi.json
 */
function patchConditionalGetsInPilot(slice, pilotFilename) {
	/** @type {Record<string, string[]>} */
	const byPilot = {
		'desktop.openapi.json': [
			'/api/v1/desktop/config',
			'/api/v1/desktop/shell-state',
			'/api/v1/desktop/installed',
		],
		'friends.openapi.json': ['/api/v1/friends/overview'],
	};
	const pathKeys = byPilot[pilotFilename];
	if (!pathKeys?.length) return;

	const ifNoneMatchParam = {
		name: 'If-None-Match',
		in: 'header',
		required: false,
		schema: { type: 'string' },
		description:
			'Optional. Prior ETag value; server returns 304 when the JSON body is unchanged.',
	};
	const etagHeader = {
		ETag: {
			schema: { type: 'string' },
			description: 'Quoted SHA-256 of canonical JSON response body.',
		},
	};
	const response304 = {
		description:
			'Not Modified — empty body; reuse the JSON from the last 200 for this URL.',
		headers: {
			ETag: {
				schema: { type: 'string' },
				description: 'Same entity tag as for 200.',
			},
		},
	};

	for (const pathKey of pathKeys) {
		const pathObj = slice.paths[pathKey];
		if (!pathObj || typeof pathObj !== 'object') continue;
		const getOp = pathObj.get;
		if (!getOp || typeof getOp !== 'object') continue;
		getOp.parameters = [...(getOp.parameters || []), ifNoneMatchParam];
		if (getOp.responses?.['200'] && typeof getOp.responses['200'] === 'object') {
			const r200 = getOp.responses['200'];
			r200.headers = { ...(r200.headers || {}), ...etagHeader };
		}
		getOp.responses = { ...getOp.responses, 304: response304 };
	}
}

/** Fallback when FastAPI export still uses empty `{}` for these responses (until response_model is in deployed export). */
const DESKTOP_RECENT_LIBRARY_SCHEMAS = {
	DesktopRecentFileRow: {
		properties: {
			id: { type: 'string', title: 'Id' },
			name: { type: 'string', title: 'Name' },
			type: {
				type: 'string',
				title: 'Type',
				description:
					'Unified content: document|image|video|audio|folder|…; projects slice uses type project.',
			},
			path: { type: 'string', title: 'Path' },
			openedAt: {
				type: 'string',
				format: 'date-time',
				title: 'Openedat',
			},
		},
		type: 'object',
		required: ['id', 'name', 'type', 'path', 'openedAt'],
		title: 'DesktopRecentFileRow',
	},
	DesktopRecentContentFeedResponse: {
		properties: {
			opened: {
				items: { $ref: '#/components/schemas/DesktopRecentFileRow' },
				type: 'array',
				title: 'Opened',
			},
			added: {
				items: { $ref: '#/components/schemas/DesktopRecentFileRow' },
				type: 'array',
				title: 'Added',
			},
			generated: {
				items: { $ref: '#/components/schemas/DesktopRecentFileRow' },
				type: 'array',
				title: 'Generated',
			},
			uploaded: {
				items: { $ref: '#/components/schemas/DesktopRecentFileRow' },
				type: 'array',
				title: 'Uploaded',
			},
			projects: {
				items: { $ref: '#/components/schemas/DesktopRecentFileRow' },
				type: 'array',
				title: 'Projects',
			},
		},
		type: 'object',
		required: ['opened', 'added', 'generated', 'uploaded', 'projects'],
		title: 'DesktopRecentContentFeedResponse',
	},
};

/**
 * @param {{ paths?: Record<string, unknown>; components?: { schemas?: Record<string, unknown> } }} slice
 */
function patchDesktopRecentLibraryFeed(slice) {
	const feedGet = slice.paths?.['/api/v1/desktop/recent-content-feed']?.get;
	const rfGet = slice.paths?.['/api/v1/desktop/recent-files']?.get;
	if (
		!feedGet ||
		typeof feedGet !== 'object' ||
		!rfGet ||
		typeof rfGet !== 'object'
	) {
		return;
	}
	const isEmpty = (s) =>
		!s || typeof s !== 'object' || Object.keys(s).length === 0;
	const feed200 =
		feedGet.responses?.['200']?.content?.['application/json']?.schema;
	const rf200 = rfGet.responses?.['200']?.content?.['application/json']?.schema;
	if (!isEmpty(feed200) && !isEmpty(rf200)) {
		return;
	}
	if (!slice.components) {
		slice.components = { schemas: {} };
	}
	if (!slice.components.schemas) {
		slice.components.schemas = {};
	}
	Object.assign(slice.components.schemas, DESKTOP_RECENT_LIBRARY_SCHEMAS);
	if (isEmpty(rf200)) {
		rfGet.responses['200'].content['application/json'].schema = {
			items: { $ref: '#/components/schemas/DesktopRecentFileRow' },
			type: 'array',
			title: 'Response Get Recent Files Api V1 Desktop Recent Files Get',
		};
	}
	if (isEmpty(feed200)) {
		feedGet.responses['200'].content['application/json'].schema = {
			$ref: '#/components/schemas/DesktopRecentContentFeedResponse',
		};
		const projectsLine =
			"- projects: user's marketing projects (companies owned by user), by updated_at / created_at";
		const d = typeof feedGet.description === 'string' ? feedGet.description : '';
		if (!d.includes('projects:')) {
			feedGet.description = [d.replace(/\s*$/, ''), projectsLine]
				.filter(Boolean)
				.join('\n');
		}
	}
}

function extractPilot(spec, pilot) {
	const paths = filterPaths(
		spec.paths,
		pilot.pathPrefixes,
		pilot.pathExact
	);
	const label =
		pilot.pathExact?.[0] ||
		pilot.pathPrefixes?.[0] ||
		pilot.out.replace('.openapi.json', '');
	const rootRefs = new Set();
	collectRefsFromValue(paths, rootRefs);
	const all = spec.components?.schemas || {};
	const schemas = closureSchemas(all, rootRefs);
	return {
		openapi: spec.openapi || '3.0.3',
		info: {
			title: `EliteEW pilot (${label})`,
			version: spec.info?.version || '0.0.1',
			description:
				'Sliced from eliteew-openapi-export.json — regenerate with openapi-extract-pilots.mjs',
		},
		paths,
		components: Object.keys(schemas).length ? { schemas } : {},
	};
}

function main() {
	const src = process.env.OPENAPI_EXPORT || DEFAULT_EXPORT;
	if (!fs.existsSync(src)) {
		console.error(
			`Missing OpenAPI export: ${src}\n` +
				'Run: cd shared/web/frontend && pnpm run openapi:export\n' +
				'(local API container) or pnpm run openapi:export:prod-core (SSH → prod-core baked API)'
		);
		process.exit(1);
	}
	const raw = fs.readFileSync(src, 'utf8');
	const spec = JSON.parse(raw);
	if (!spec.paths) {
		console.error('Invalid OpenAPI: no paths');
		process.exit(1);
	}

	fs.mkdirSync(PILOT_DIR, { recursive: true });
	let pilots = [...PILOTS_LITE];
	if (process.env.OPENAPI_MARKETING_FULL === '1') {
		pilots.push(...PILOTS_FULL_MARKETING);
	}
	const only = (process.env.OPENAPI_PILOT_ONLY || '').trim();
	if (only) {
		pilots = pilots.filter(
			(p) => p.out === only || p.out === `${only}.openapi.json`
		);
		if (!pilots.length) {
			console.error(`OPENAPI_PILOT_ONLY=${only}: no matching pilot`);
			process.exit(1);
		}
	}

	for (const pilot of pilots) {
		const slice = extractPilot(spec, pilot);
		patchConditionalGetsInPilot(slice, pilot.out);
		if (pilot.out === 'desktop.openapi.json') {
			patchDesktopRecentLibraryFeed(slice);
		}
		const dest = path.join(PILOT_DIR, pilot.out);
		fs.writeFileSync(dest, JSON.stringify(slice, null, 2), 'utf8');
		console.error(
			`Wrote ${path.relative(REPO_ROOT, dest)} (${Object.keys(slice.paths).length} paths)`
		);
	}
}

main();
